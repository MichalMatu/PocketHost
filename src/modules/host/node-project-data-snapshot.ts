import { createHash, randomUUID } from 'node:crypto';
import {
  closeSync,
  constants,
  existsSync,
  fstatSync,
  lstatSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { NodeProjectDataScope } from './node-project-data-scope.ts';

const SNAPSHOT_ID = /^snapshot-[a-f0-9]{32}$/;
const MAX_MANIFEST_BYTES = 64 * 1024;
const MAX_FILES = 200;
const MAX_DIRECTORIES = 200;
const MAX_SNAPSHOT_ENTRIES = 64;
const DATA_CATEGORIES = new Set(['uploads', 'db', 'state']);
const CHILD_NAME = /^[\p{L}\p{N}][\p{L}\p{N}._-]*$/u;
const MAX_BYTES = 32 * 1024 * 1024;
const MAX_FILE_BYTES = 16 * 1024 * 1024;
const MAX_DEPTH = 6;

type FileDigest = { path: string; bytes: number; sha256: string };
type SnapshotContents = { directories: string[]; files: FileDigest[] };
type SnapshotManifest = {
  schema: 1 | 2;
  projectId: string;
  createdAt: string;
  directories?: string[]; // v2: include empty directories; v1 had files only
  files: FileDigest[];
};

function validDataPath(relative: string, directory: boolean): boolean {
  const parts = relative.split('/');
  const maxParts = directory ? MAX_DEPTH : MAX_DEPTH + 1;
  return (
    parts.length >= (directory ? 1 : 2) &&
    parts.length <= maxParts &&
    DATA_CATEGORIES.has(parts[0]!) &&
    parts.slice(1).every((name) => name.length <= 120 && CHILD_NAME.test(name))
  );
}
export interface NodeDataSnapshotIndexEntry {
  snapshot: string;
  createdAt: string;
  schema: 1 | 2;
  files: number;
  bytes: number;
  directories: number | null;
  integrity: 'not-checked';
}

export interface NodeDataSnapshotResult {
  snapshot: string;
  projectId: string;
  files: number;
  bytes: number;
}

/**
 * Local, detached, offline-only Node app data snapshots. Never copies source
 * releases, activates an app, or restores into the running data directory.
 * Mutations are not exposed by the PocketHost API.
 */
export class NodeProjectDataSnapshots {
  private readonly sourceRoot: string;
  private readonly snapshotRoot: string;
  private readonly scope: NodeProjectDataScope;

  constructor(
    projectRoot = path.join(os.homedir(), 'PocketHost-NodeProjects'),
    sourceRoot = path.join(os.homedir(), '.local', 'state', 'pockethost', 'node-project-data'),
    snapshotRoot = path.join(
      os.homedir(),
      '.local',
      'state',
      'pockethost',
      'node-project-data-snapshots',
    ),
  ) {
    const roots = [projectRoot, sourceRoot, snapshotRoot].map((value) => {
      if (!path.isAbsolute(value) || path.resolve(value) !== value) {
        throw new RangeError('Expected canonical absolute Node data root');
      }
      return value;
    });
    for (let i = 0; i < roots.length; i++) {
      for (let j = i + 1; j < roots.length; j++) {
        if (
          roots[i] === roots[j] ||
          roots[i]!.startsWith(roots[j]! + path.sep) ||
          roots[j]!.startsWith(roots[i]! + path.sep)
        ) {
          throw new RangeError('Source, application data and snapshots must be independent');
        }
      }
    }
    this.projectsRoot = projectRoot;
    this.sourceRoot = sourceRoot;
    this.snapshotRoot = snapshotRoot;
    this.scope = new NodeProjectDataScope(projectRoot, sourceRoot);
  }

  private privateEntry(filename: string, isDirectory: boolean): void {
    const stat = lstatSync(filename);
    if (
      stat.isSymbolicLink() ||
      (isDirectory ? !stat.isDirectory() : !stat.isFile() || stat.nlink !== 1) ||
      stat.uid !== process.getuid?.() ||
      (stat.mode & 0o077) !== 0 ||
      (isDirectory && realpathSync(filename) !== filename)
    ) {
      throw new Error('Untrusted Node data snapshot entry');
    }
  }

  private ownedStorage(create: boolean): void {
    if (!existsSync(this.snapshotRoot)) {
      if (!create) throw new Error('Node data snapshot storage not configured');
      this.privateEntry(path.dirname(this.snapshotRoot), true);
      mkdirSync(this.snapshotRoot, { mode: 0o700 });
    }
    this.privateEntry(this.snapshotRoot, true);
  }

  private ownedData(
    root: string,
    projectId: string,
  ): { directories: string[]; files: string[]; bytes: number } {
    const report = new NodeProjectDataScope(this.projectRoot(), root).inspect(projectId);
    if (report.state !== 'owned-private') {
      throw new Error('No explicitly provisioned private Node project data');
    }
    // The live shared data root may hold many separately owned projects.
    // A detached snapshot or staging restore must contain exactly one.
    const entries = readdirSync(root);
    if (root !== this.sourceRoot && (entries.length !== 1 || entries[0] !== projectId)) {
      throw new Error('Snapshot data includes unexpected projects');
    }
    const directories: string[] = [];
    const files: string[] = [];
    const visit = (folder: string, relative: string, depth: number): void => {
      if (depth > MAX_DEPTH) throw new RangeError('Node data depth limit');
      this.privateEntry(folder, true);
      for (const entry of readdirSync(folder, { withFileTypes: true })) {
        const name = relative ? relative + '/' + entry.name : entry.name;
        const absolute = path.join(folder, entry.name);
        if (entry.isDirectory()) {
          if (!validDataPath(name, true)) throw new Error('Invalid Node data directory');
          directories.push(name);
          if (directories.length > MAX_DIRECTORIES) {
            throw new RangeError('Node data directory budget exceeded');
          }
          visit(absolute, name, depth + 1);
        } else {
          this.privateEntry(absolute, false);
          files.push(name);
        }
      }
    };
    visit(path.join(root, projectId), '', 0);
    files.sort();
    directories.sort();
    if (files.length !== report.fileCount) throw new Error('Node data files changed');
    return { directories, files, bytes: report.totalBytes };
  }

  // The verified project catalog is the only source of owned Node project IDs.
  private projectRoot(): string {
    return this.projectsRoot;
  }
  private readonly projectsRoot: string;

  private readPrivateFile(filename: string): Buffer {
    this.privateEntry(filename, false);
    const before = lstatSync(filename);
    if (before.size > MAX_FILE_BYTES) throw new RangeError('Node app data file too large');
    const fd = openSync(filename, constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
      const opened = fstatSync(fd);
      if (
        opened.ino !== before.ino ||
        opened.size !== before.size ||
        opened.mtimeMs !== before.mtimeMs ||
        opened.nlink !== 1
      ) {
        throw new Error('Node app data file changed during snapshot');
      }
      const bytes = readFileSync(fd);
      const after = fstatSync(fd);
      const pathname = lstatSync(filename);
      if (
        after.ino !== before.ino ||
        after.size !== before.size ||
        after.mtimeMs !== before.mtimeMs ||
        pathname.ino !== before.ino ||
        bytes.length !== before.size
      ) {
        throw new Error('Node app data file changed during snapshot');
      }
      return bytes;
    } finally {
      closeSync(fd);
    }
  }

  private collect(root: string, projectId: string, destination?: string): SnapshotContents {
    const inventory = this.ownedData(root, projectId);
    const files: FileDigest[] = [];
    if (destination) {
      for (const relative of inventory.directories) {
        mkdirSync(path.join(destination, projectId, relative), {
          recursive: true,
          mode: 0o700,
        });
      }
    }
    let total = 0;
    for (const relative of inventory.files) {
      const bytes = this.readPrivateFile(path.join(root, projectId, relative));
      total += bytes.length;
      if (files.length >= MAX_FILES || total > MAX_BYTES) {
        throw new RangeError('Node data snapshot budget exceeded');
      }
      files.push({
        path: relative,
        bytes: bytes.length,
        sha256: createHash('sha256').update(bytes).digest('hex'),
      });
      if (destination) {
        const target = path.join(destination, projectId, relative);
        mkdirSync(path.dirname(target), { recursive: true, mode: 0o700 });
        writeFileSync(target, bytes, { flag: 'wx', mode: 0o600 });
      }
    }
    if (total !== inventory.bytes) {
      throw new Error('Node app data changed during snapshot');
    }
    return { directories: inventory.directories, files };
  }

  private manifest(snapshot: string, projectId?: string): SnapshotManifest {
    if (!SNAPSHOT_ID.test(snapshot)) throw new RangeError('Invalid Node data snapshot ID');
    const folder = path.join(this.snapshotRoot, snapshot);
    this.privateEntry(folder, true);
    if (readdirSync(folder).sort().join(',') !== 'data,manifest.json') {
      throw new Error('Unexpected Node data snapshot structure');
    }
    const filename = path.join(folder, 'manifest.json');
    this.privateEntry(filename, false);
    if (lstatSync(filename).size > MAX_MANIFEST_BYTES) {
      throw new Error('Node data manifest size exceeded');
    }
    const raw: unknown = JSON.parse(this.readPrivateFile(filename).toString('utf8'));
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      throw new Error('Invalid Node snapshot manifest');
    }
    const item = raw as Record<string, unknown>;
    const keys = Object.keys(item).sort().join(',');
    const isV1 = item.schema === 1 && keys === 'createdAt,files,projectId,schema';
    const isV2 = item.schema === 2 && keys === 'createdAt,directories,files,projectId,schema';
    if (
      (!isV1 && !isV2) ||
      typeof item.projectId !== 'string' ||
      !/^node-[a-f0-9]{32}$/.test(item.projectId) ||
      (projectId !== undefined && item.projectId !== projectId) ||
      typeof item.createdAt !== 'string' ||
      !Number.isFinite(Date.parse(item.createdAt)) ||
      !Array.isArray(item.files) ||
      item.files.length > MAX_FILES ||
      (isV2 && (!Array.isArray(item.directories) || item.directories.length > MAX_DIRECTORIES))
    ) {
      throw new Error('Untrusted Node snapshot manifest');
    }
    if (isV2) {
      const directories = item.directories as unknown[];
      let previousDirectory = '';
      const present = new Set<string>();
      for (const relative of directories) {
        if (
          typeof relative !== 'string' ||
          relative <= previousDirectory ||
          !validDataPath(relative, true)
        ) {
          throw new Error('Invalid Node snapshot directory metadata');
        }
        const parts = relative.split('/');
        if (parts.length > 1 && !present.has(parts.slice(0, -1).join('/'))) {
          throw new Error('Node snapshot directory parent is missing');
        }
        present.add(relative);
        previousDirectory = relative;
      }
    }
    const files = item.files as unknown[];
    let bytes = 0;
    let previous = '';
    for (const file of files) {
      if (!file || typeof file !== 'object' || Array.isArray(file)) {
        throw new Error('Invalid Node snapshot file digest');
      }
      const entry = file as Record<string, unknown>;
      if (
        Object.keys(entry).sort().join(',') !== 'bytes,path,sha256' ||
        typeof entry.path !== 'string' ||
        entry.path <= previous ||
        !validDataPath(entry.path, false) ||
        (isV2 &&
          !(item.directories as string[]).includes(entry.path.split('/').slice(0, -1).join('/'))) ||
        !Number.isSafeInteger(entry.bytes) ||
        (entry.bytes as number) < 0 ||
        (entry.bytes as number) > MAX_FILE_BYTES ||
        typeof entry.sha256 !== 'string' ||
        !/^[a-f0-9]{64}$/.test(entry.sha256)
      ) {
        throw new Error('Invalid Node snapshot file metadata');
      }
      previous = entry.path;
      bytes += entry.bytes as number;
      if (bytes > MAX_BYTES) throw new RangeError('Snapshot content exceeds limit');
    }
    return item as SnapshotManifest;
  }

  /**
   * Owner-scoped snapshot metadata only. No integrity verification or restore
   * capability is inferred from a manifest entry.
   */
  listSnapshots(projectId: string): NodeDataSnapshotIndexEntry[] {
    this.scope.inspect(projectId);
    if (!existsSync(this.snapshotRoot)) return [];
    this.ownedStorage(false);
    const names = readdirSync(this.snapshotRoot);
    if (names.length > MAX_SNAPSHOT_ENTRIES) {
      throw new RangeError('Node snapshot index size exceeded');
    }
    const snapshots: NodeDataSnapshotIndexEntry[] = [];
    for (const name of names) {
      this.privateEntry(path.join(this.snapshotRoot, name), true);
      if (name === 'restores' || name.startsWith('.pending-snapshot-')) {
        if (name !== 'restores' && !/^\.pending-snapshot-[a-f0-9]{32}$/.test(name)) {
          throw new Error('Unexpected Node snapshot pending entry');
        }
        continue;
      }
      if (!SNAPSHOT_ID.test(name)) throw new Error('Unexpected Node snapshot storage entry');
      const manifest = this.manifest(name);
      if (manifest.projectId !== projectId) continue;
      snapshots.push({
        snapshot: name,
        createdAt: manifest.createdAt,
        schema: manifest.schema,
        files: manifest.files.length,
        bytes: manifest.files.reduce((sum, file) => sum + file.bytes, 0),
        directories: manifest.schema === 2 ? manifest.directories!.length : null,
        integrity: 'not-checked',
      });
    }
    return snapshots.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  /**
   * Read-only on-demand archive verification. Matches stored file bytes and
   * directory inventory to the manifest; does NOT prove database consistency
   * at the time of the original capture or authorize a restore.
   */
  verifySnapshot(
    projectId: string,
    snapshot: string,
  ): {
    snapshot: string;
    integrity: 'verified';
    files: number;
    bytes: number;
    directories: number | null;
  } {
    this.scope.inspect(projectId);
    this.ownedStorage(false);
    const manifest = this.validatedSnapshot(snapshot, projectId);
    return {
      snapshot,
      integrity: 'verified',
      files: manifest.files.length,
      bytes: manifest.files.reduce((total, entry) => total + entry.bytes, 0),
      directories: manifest.schema === 2 ? manifest.directories!.length : null,
    };
  }

  private validatedSnapshot(snapshot: string, projectId: string): SnapshotManifest {
    const manifest = this.manifest(snapshot, projectId);
    const actual = this.collect(path.join(this.snapshotRoot, snapshot, 'data'), projectId);
    if (
      JSON.stringify(actual.files) !== JSON.stringify(manifest.files) ||
      (manifest.schema === 2 &&
        JSON.stringify(actual.directories) !== JSON.stringify(manifest.directories))
    ) {
      throw new Error('Snapshot file or directory integrity mismatch');
    }
    return manifest;
  }

  create(
    projectId: string,
    approved: boolean,
    assertOffline: () => boolean,
  ): NodeDataSnapshotResult {
    if (approved !== true) throw new Error('Explicit Node data backup approval required');
    if (typeof assertOffline !== 'function' || !assertOffline()) {
      throw new Error('Verified offline Node project state required');
    }
    if (this.scope.inspect(projectId).state !== 'owned-private') {
      throw new Error('Node app data is not provisioned');
    }
    this.ownedStorage(true);
    const id = 'snapshot-' + randomUUID().replaceAll('-', '');
    const pending = path.join(this.snapshotRoot, '.pending-' + id);
    mkdirSync(pending, { mode: 0o700 });
    try {
      const data = path.join(pending, 'data');
      mkdirSync(data, { mode: 0o700 });
      mkdirSync(path.join(data, projectId), { mode: 0o700 });
      const copied = this.collect(this.sourceRoot, projectId, data);
      const manifest: SnapshotManifest = {
        schema: 2,
        projectId,
        createdAt: new Date().toISOString(),
        ...copied,
      };
      if (!assertOffline()) throw new Error('Node project became active during backup');
      const second = this.collect(this.sourceRoot, projectId);
      if (JSON.stringify(second) !== JSON.stringify(copied)) {
        throw new Error('Node data changed during snapshot');
      }
      writeFileSync(path.join(pending, 'manifest.json'), JSON.stringify(manifest), {
        flag: 'wx',
        mode: 0o600,
      });
      renameSync(pending, path.join(this.snapshotRoot, id));
      return {
        snapshot: id,
        projectId,
        files: manifest.files.length,
        bytes: manifest.files.reduce((sum, entry) => sum + entry.bytes, 0),
      };
    } finally {
      if (existsSync(pending)) {
        this.privateEntry(pending, true);
        rmSync(pending, { recursive: true });
      }
    }
  }

  restoreToStaging(
    projectId: string,
    snapshot: string,
    approved: boolean,
  ): { restoredTo: string; projectId: string; files: number } {
    if (approved !== true) throw new Error('Explicit staging-only restore approval required');
    this.ownedStorage(false);
    const manifest = this.validatedSnapshot(snapshot, projectId);
    const restores = path.join(this.snapshotRoot, 'restores');
    if (!existsSync(restores)) mkdirSync(restores, { mode: 0o700 });
    this.privateEntry(restores, true);
    const staging = path.join(restores, 'restore-' + randomUUID().replaceAll('-', ''));
    mkdirSync(staging, { mode: 0o700 });
    try {
      mkdirSync(path.join(staging, projectId), { mode: 0o700 });
      const copied = this.collect(
        path.join(this.snapshotRoot, snapshot, 'data'),
        projectId,
        staging,
      );
      if (
        JSON.stringify(copied.files) !== JSON.stringify(manifest.files) ||
        (manifest.schema === 2 &&
          JSON.stringify(copied.directories) !== JSON.stringify(manifest.directories))
      ) {
        throw new Error('Staged Node data does not match verified snapshot');
      }
      this.ownedData(staging, projectId);
      return { restoredTo: staging, projectId, files: manifest.files.length };
    } catch (error) {
      this.privateEntry(staging, true);
      rmSync(staging, { recursive: true });
      throw error;
    }
  }
}
