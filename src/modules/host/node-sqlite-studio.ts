import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { closeSync, constants, fstatSync, openSync, readSync, type Stats } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { NodeProjectDataScope } from './node-project-data-scope.ts';
import {
  parseSqliteRead,
  SQLITE_ID,
  SQLITE_MAX_PAGE,
  SQLITE_MAX_RESPONSE_BYTES,
  type SqliteDatabase,
  type SqliteMode,
  type SqliteQuery,
  type SqliteRead,
  type SqliteState,
} from '../../shared/node-sqlite-studio.ts';

const reader = fileURLToPath(new URL('./node-sqlite-reader.mjs', import.meta.url));
type ScopedFile = ReturnType<NodeProjectDataScope['inspectSqliteFiles']>['files'][number];
type Identity = { dev: number; ino: number; size: number; ctimeMs: number; mtimeMs: number };
type Candidate = {
  entry: SqliteDatabase;
  file: ScopedFile;
  sidecars: Record<string, Identity | null>;
};
type RuntimeStatus = { state: string; desired: string };
const identity = (stat: Stats): Identity => ({
  dev: stat.dev,
  ino: stat.ino,
  size: stat.size,
  ctimeMs: stat.ctimeMs,
  mtimeMs: stat.mtimeMs,
});
const same = (a: Identity, b: Identity): boolean =>
  a.dev === b.dev &&
  a.ino === b.ino &&
  a.size === b.size &&
  a.ctimeMs === b.ctimeMs &&
  a.mtimeMs === b.mtimeMs;

export function parseSqliteQuery(url: string): SqliteQuery {
  if (url.length > 512) throw new RangeError('SQLite URL budget');
  const separator = url.indexOf('?');
  const params = new URLSearchParams(separator < 0 ? '' : url.slice(separator + 1));
  for (const key of params.keys()) {
    if (!['db', 'table', 'page'].includes(key) || params.getAll(key).length !== 1) {
      throw new RangeError('Invalid SQLite query parameters');
    }
  }
  const databaseId = params.get('db');
  const tableId = params.get('table');
  const pageText = params.get('page');
  if (
    (databaseId !== null && !SQLITE_ID.test(databaseId)) ||
    (tableId !== null && (!databaseId || !SQLITE_ID.test(tableId))) ||
    (pageText !== null &&
      (!tableId || !/^[1-9][0-9]?$/.test(pageText) || Number(pageText) > SQLITE_MAX_PAGE))
  )
    throw new RangeError('Invalid SQLite selection');
  return { databaseId, tableId, page: pageText === null ? 1 : Number(pageText) };
}

function header(file: ScopedFile): Buffer | null {
  if (file.stat.size < 100) return null;
  const fd = openSync(file.absolute, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const stat = fstatSync(fd);
    if (!stat.isFile() || stat.nlink !== 1 || !same(identity(stat), identity(file.stat))) {
      throw new Error('SQLite file changed');
    }
    const bytes = Buffer.alloc(100);
    if (
      readSync(fd, bytes, 0, bytes.length, 0) !== bytes.length ||
      !same(identity(fstatSync(fd)), identity(stat))
    )
      throw new Error('SQLite header changed');
    return bytes.subarray(0, 16).equals(Buffer.from('SQLite format 3\0')) ? bytes : null;
  } finally {
    closeSync(fd);
  }
}
function readiness(
  file: ScopedFile,
  sidecars: Record<string, Identity | null>,
  offline: boolean,
): { state: SqliteState; mode: SqliteMode | null } {
  try {
    const bytes = header(file);
    if (!bytes) return { state: 'corrupt', mode: null };
    const wal = bytes[18] === 2 && bytes[19] === 2;
    const rollback = bytes[18] === 1 && bytes[19] === 1;
    if (!wal && !rollback) return { state: 'unsupported', mode: null };
    if (sidecars['-journal']) return { state: 'locked', mode: null };
    const hasWal = !!sidecars['-wal'];
    const hasShm = !!sidecars['-shm'];
    if (wal && hasWal && hasShm) return { state: 'available', mode: 'live-wal' };
    if (wal && !hasWal && !hasShm && offline) return { state: 'available', mode: 'offline' };
    if (rollback && !hasWal && !hasShm) return { state: 'available', mode: 'read-only' };
    return { state: 'offline-only', mode: null };
  } catch {
    return { state: 'stale', mode: null };
  }
}
function empty(projectId: string, query: SqliteQuery, state: SqliteState): SqliteRead {
  if (!query.databaseId) return { kind: 'catalog', projectId, state, databases: [] };
  if (!query.tableId)
    return {
      kind: 'tables',
      projectId,
      databaseId: query.databaseId,
      state,
      mode: null,
      tables: [],
    };
  return {
    kind: 'rows',
    projectId,
    databaseId: query.databaseId,
    tableId: query.tableId,
    state,
    mode: null,
    page: query.page,
    columns: [],
    rows: [],
    hasMore: false,
  };
}
function launch(input: object): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    const child = execFile(
      process.execPath,
      ['--max-old-space-size=48', reader],
      {
        timeout: 3000,
        killSignal: 'SIGKILL',
        maxBuffer: SQLITE_MAX_RESPONSE_BYTES,
        encoding: 'utf8',
      },
      (error, stdout) => {
        if (error) {
          resolve({
            state:
              error.killed || error.code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER'
                ? 'busy'
                : 'unavailable',
          });
          return;
        }
        try {
          const result: unknown = JSON.parse(stdout);
          if (!result || typeof result !== 'object' || Array.isArray(result)) throw new Error();
          resolve(result as Record<string, unknown>);
        } catch {
          resolve({ state: 'unavailable' });
        }
      },
    );
    child.stdin?.on('error', () => {
      /* The terminal child callback owns the outcome. */
    });
    child.stdin?.end(JSON.stringify(input));
  });
}

/** No global file discovery or database writes. One on-demand native reader at a time. */
export class NodeSqliteStudio {
  private active = false;
  private readonly scope: NodeProjectDataScope;
  private readonly runtime: (projectId: string) => RuntimeStatus;

  constructor(
    scope = new NodeProjectDataScope(),
    runtime: (projectId: string) => RuntimeStatus = () => ({
      state: 'unknown',
      desired: 'running',
    }),
  ) {
    this.scope = scope;
    this.runtime = runtime;
  }

  private offline(projectId: string): boolean {
    try {
      const status = this.runtime(projectId);
      return status.state === 'stopped' && status.desired === 'stopped';
    } catch {
      return false;
    }
  }

  private catalog(projectId: string): { configured: boolean; candidates: Candidate[] } {
    const { configured, files } = this.scope.inspectSqliteFiles(projectId);
    const indexed = new Map(files.map((file) => [file.relative, file]));
    const offline = this.offline(projectId);
    const candidates = files
      .filter((file) => /\.(?:db|sqlite|sqlite3)$/i.test(file.relative))
      .map((file): Candidate => {
        const sidecars: Record<string, Identity | null> = {};
        for (const suffix of ['-wal', '-shm', '-journal']) {
          const side = indexed.get(file.relative + suffix);
          sidecars[suffix] = side ? identity(side.stat) : null;
        }
        const id = createHash('sha256')
          .update(JSON.stringify([projectId, file.relative, identity(file.stat)]))
          .digest('hex');
        const entry = {
          id,
          name: file.relative,
          bytes: file.stat.size,
          ...readiness(file, sidecars, offline),
        };
        return { entry, file, sidecars };
      })
      .sort((a, b) => a.entry.name.localeCompare(b.entry.name));
    return { configured, candidates };
  }

  async read(projectId: string, query: SqliteQuery): Promise<SqliteRead> {
    try {
      const { configured, candidates } = this.catalog(projectId);
      if (!configured) return empty(projectId, query, 'not-configured');
      if (!query.databaseId)
        return parseSqliteRead(
          {
            kind: 'catalog',
            projectId,
            state: 'available',
            databases: candidates.map(({ entry }) => entry),
          },
          projectId,
          query,
        );
      const candidate = candidates.find(({ entry }) => entry.id === query.databaseId);
      if (!candidate) return empty(projectId, query, 'stale');
      const { entry, file, sidecars } = candidate;
      if (entry.state !== 'available' || !entry.mode) return empty(projectId, query, entry.state);
      if (this.active) return empty(projectId, query, 'busy');
      this.active = true;
      try {
        const result = await launch({
          filename: file.absolute,
          main: identity(file.stat),
          sidecars,
          databaseId: query.databaseId,
          tableId: query.tableId,
          page: query.page,
          mode: entry.mode,
        });
        // Re-attest project, path, file version and read mode after the child exits.
        const fresh = this.catalog(projectId).candidates.find((item) => item.entry.id === entry.id);
        if (
          !fresh ||
          fresh.entry.mode !== entry.mode ||
          ['-wal', '-shm', '-journal'].some((suffix) => {
            const a = sidecars[suffix];
            const b = fresh.sidecars[suffix];
            return a && b ? a.dev !== b.dev || a.ino !== b.ino : a !== b;
          })
        )
          return empty(projectId, query, 'stale');
        const base = empty(projectId, query, 'unavailable');
        const response = parseSqliteRead(
          {
            ...base,
            ...result,
            mode: result.state === 'available' ? entry.mode : null,
          },
          projectId,
          query,
        );
        return Buffer.byteLength(JSON.stringify(response)) <= SQLITE_MAX_RESPONSE_BYTES
          ? response
          : empty(projectId, query, 'unsupported');
      } finally {
        this.active = false;
      }
    } catch {
      return empty(projectId, query, 'unavailable');
    }
  }
}
