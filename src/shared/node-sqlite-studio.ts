/** Pure browser/server contract for bounded, project-scoped read-only SQLite inspection. */
export const SQLITE_PAGE_SIZE = 20;
export const SQLITE_MAX_PAGE = 50;
export const SQLITE_MAX_COLUMNS = 24;
export const SQLITE_MAX_TABLES = 128;
export const SQLITE_MAX_RESPONSE_BYTES = 256 * 1024;
export const SQLITE_TEXT_BYTES = 64;
export const SQLITE_BLOB_BYTES = 16;
export const SQLITE_ID = /^[a-f0-9]{64}$/;

const states = [
  'available',
  'not-configured',
  'offline-only',
  'locked',
  'corrupt',
  'unsupported',
  'stale',
  'busy',
  'unavailable',
] as const;
export type SqliteState = (typeof states)[number];
export type SqliteMode = 'read-only' | 'live-wal' | 'offline';
export type SqliteDatabase = {
  id: string;
  name: string;
  bytes: number;
  state: SqliteState;
  mode: SqliteMode | null;
};
export type SqliteTable = {
  id: string;
  name: string;
  type: 'table' | 'view' | 'virtual';
  columns: number;
  state: 'available' | 'unsupported';
};
export type SqliteColumn = {
  name: string;
  type: string;
  notNull: boolean;
  primaryKey: number;
  generated: boolean;
};
export type SqliteCell = {
  kind: 'null' | 'integer' | 'real' | 'text' | 'blob';
  value: string | null;
  bytes: number | null;
  truncated: boolean;
};
export type SqliteQuery = { databaseId: string | null; tableId: string | null; page: number };
export type SqliteRead =
  | { kind: 'catalog'; projectId: string; state: SqliteState; databases: SqliteDatabase[] }
  | {
      kind: 'tables';
      projectId: string;
      databaseId: string;
      state: SqliteState;
      mode: SqliteMode | null;
      tables: SqliteTable[];
    }
  | {
      kind: 'rows';
      projectId: string;
      databaseId: string;
      tableId: string;
      state: SqliteState;
      mode: SqliteMode | null;
      page: number;
      columns: SqliteColumn[];
      rows: SqliteCell[][];
      hasMore: boolean;
    };

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function integer(value: unknown, max: number): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= max;
}
function str(value: unknown, max: number): value is string {
  return typeof value === 'string' && value.length <= max;
}
function id(value: unknown): value is string {
  return typeof value === 'string' && SQLITE_ID.test(value);
}
function state(value: unknown): value is SqliteState {
  return states.some((item) => item === value);
}
function mode(value: unknown): value is SqliteMode | null {
  return value === null || value === 'read-only' || value === 'live-wal' || value === 'offline';
}
function distinct<T extends { id: string }>(items: T[]): boolean {
  return new Set(items.map((item) => item.id)).size === items.length;
}
function database(value: unknown): value is SqliteDatabase {
  return (
    record(value) &&
    id(value.id) &&
    str(value.name, 800) &&
    integer(value.bytes, 16 * 1024 * 1024) &&
    state(value.state) &&
    mode(value.mode) &&
    (value.state === 'available') === (value.mode !== null)
  );
}
function table(value: unknown): value is SqliteTable {
  return (
    record(value) &&
    id(value.id) &&
    str(value.name, 240) &&
    (value.type === 'table' || value.type === 'view' || value.type === 'virtual') &&
    integer(value.columns, 32767) &&
    (value.state === 'available' || value.state === 'unsupported') &&
    (value.state !== 'available' ||
      (value.type !== 'virtual' && value.columns > 0 && value.columns <= SQLITE_MAX_COLUMNS))
  );
}
function column(value: unknown): value is SqliteColumn {
  return (
    record(value) &&
    str(value.name, 240) &&
    str(value.type, 160) &&
    typeof value.notNull === 'boolean' &&
    integer(value.primaryKey, SQLITE_MAX_COLUMNS) &&
    typeof value.generated === 'boolean'
  );
}
function cell(value: unknown): value is SqliteCell {
  if (!record(value) || typeof value.truncated !== 'boolean') return false;
  if (value.kind === 'null') {
    return value.value === null && value.bytes === null && !value.truncated;
  }
  if (value.kind === 'integer' || value.kind === 'real') {
    return str(value.value, 64) && value.bytes === null && !value.truncated;
  }
  if (!integer(value.bytes, 16 * 1024 * 1024)) return false;
  if (value.kind === 'text') {
    return (
      str(value.value, SQLITE_TEXT_BYTES) && value.truncated === value.bytes > SQLITE_TEXT_BYTES
    );
  }
  if (value.kind === 'blob') {
    return (
      str(value.value, SQLITE_BLOB_BYTES * 2) &&
      /^[a-f0-9]*$/i.test(value.value) &&
      value.value.length === Math.min(value.bytes, SQLITE_BLOB_BYTES) * 2 &&
      value.truncated === value.bytes > SQLITE_BLOB_BYTES
    );
  }
  return false;
}

/** Validate identity, discriminant, bounds and failed-result emptiness on both sides. */
export function parseSqliteRead(value: unknown, projectId: string, query: SqliteQuery): SqliteRead {
  const fail = (): never => {
    throw new Error('Invalid SQLite Studio response');
  };
  if (!record(value) || value.projectId !== projectId || !state(value.state)) return fail();
  if (query.databaseId === null) {
    if (
      value.kind !== 'catalog' ||
      !Array.isArray(value.databases) ||
      value.databases.length > 200 ||
      !value.databases.every(database) ||
      !distinct(value.databases) ||
      (value.state !== 'available' && value.databases.length > 0)
    )
      return fail();
    return { kind: 'catalog', projectId, state: value.state, databases: value.databases };
  }
  if (
    value.databaseId !== query.databaseId ||
    !mode(value.mode) ||
    (value.state === 'available') !== (value.mode !== null)
  )
    return fail();
  if (query.tableId === null) {
    if (
      value.kind !== 'tables' ||
      !Array.isArray(value.tables) ||
      value.tables.length > SQLITE_MAX_TABLES ||
      !value.tables.every(table) ||
      !distinct(value.tables) ||
      (value.state !== 'available' && value.tables.length > 0)
    )
      return fail();
    return {
      kind: 'tables',
      projectId,
      databaseId: query.databaseId,
      state: value.state,
      mode: value.mode,
      tables: value.tables,
    };
  }
  if (
    value.kind !== 'rows' ||
    value.tableId !== query.tableId ||
    value.page !== query.page ||
    !Array.isArray(value.columns) ||
    value.columns.length > SQLITE_MAX_COLUMNS ||
    !value.columns.every(column) ||
    !Array.isArray(value.rows) ||
    value.rows.length > SQLITE_PAGE_SIZE ||
    typeof value.hasMore !== 'boolean' ||
    !value.rows.every(
      (row: unknown) =>
        Array.isArray(row) &&
        row.length === (value.columns as SqliteColumn[]).length &&
        row.every(cell),
    ) ||
    (value.state !== 'available' &&
      (value.columns.length > 0 || value.rows.length > 0 || value.hasMore)) ||
    (value.state === 'available' && value.columns.length === 0) ||
    (value.hasMore && value.rows.length !== SQLITE_PAGE_SIZE)
  )
    return fail();
  return {
    kind: 'rows',
    projectId,
    databaseId: query.databaseId,
    tableId: query.tableId,
    state: value.state,
    mode: value.mode,
    page: query.page,
    columns: value.columns,
    rows: value.rows,
    hasMore: value.hasMore,
  };
}
