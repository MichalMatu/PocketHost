import { execFile as callbackExecFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomBytes, randomUUID } from 'node:crypto';
import {
  existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, renameSync,
  rmSync, statSync, writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const execFile = promisify(callbackExecFile);
const BIN = '/data/data/com.termux/files/usr/bin';
const MAX_TEXT = 256 * 1024;
const MAX_LIST = 200;
const NAME = /^[a-z0-9][a-z0-9+.-]{0,79}$/;
const EXT = /\.(?:txt|md|json|html|css|js|mjs|ts|tsx|svg|yaml|yml|xml|csv|log)$/i;

export interface HostCommandResult {
  exit: number;
  output: string;
}
export type Exec = (command: string, args: string[], opts?: {
  timeout: number; maxBuffer: number; env?: NodeJS.ProcessEnv;
}) => Promise<HostCommandResult>;

export async function executeFixed(command: string, args: string[], opts?: {
  timeout: number; maxBuffer: number; env?: NodeJS.ProcessEnv;
}): Promise<HostCommandResult> {
  const { stdout, stderr } = await execFile(command, args, {
    shell: false,
    windowsHide: true,
    timeout: opts?.timeout ?? 120000,
    maxBuffer: opts?.maxBuffer ?? 64 * 1024,
    env: opts?.env,
  });
  return { exit: 0, output: (stdout + '\n' + stderr).slice(-12000) };
}

export type PackageAction = 'refresh' | 'install' | 'remove' | 'upgrade' | 'upgrade-all';

/** A fixed executable + argv; never a shell string or caller-supplied binary. */
export async function applyPackageAction(
  action: PackageAction,
  name: string | undefined,
  run: Exec = executeFixed,
): Promise<HostCommandResult> {
  if (!['refresh', 'install', 'remove', 'upgrade', 'upgrade-all'].includes(action))
    throw new RangeError('Unsupported package operation');
  if (['install', 'remove', 'upgrade'].includes(action) && (!name || !NAME.test(name)))
    throw new RangeError('Invalid Termux package name');
  if (name && !NAME.test(name)) throw new RangeError('Invalid Termux package name');
  const options: Record<PackageAction, string[]> = {
    refresh: ['update'],
    install: ['-y', 'install', name!],
    remove: ['-y', 'remove', name!],
    upgrade: ['-y', 'install', '--only-upgrade', name!],
    'upgrade-all': ['-y', 'upgrade'],
  };
  // Use Debian apt engine already shipped with Termux; do not implement a second resolver.
  return run(path.join(BIN, 'apt-get'), options[action], {
    timeout: 10 * 60 * 1000, maxBuffer: 128 * 1024,
  });
}

export interface WorkspaceEntry {
  name: string;
  kind: 'file' | 'directory';
  bytes: number;
}
export type FileAction = 'mkdir' | 'save' | 'rename' | 'delete';

/**
 * User-owned scratch workspace. General Termux directories and existing
 * application/site data are not imported or modified by H3 operations.
 */
export class WorkspaceFiles {
  readonly root: string;
  constructor(root = path.join(os.homedir(), 'Projects', 'PocketHost-H3-Workspace')) {
    this.root = root;
  }
  private ensureRoot(): void {
    const parent = path.dirname(this.root);
    if (!existsSync(parent)) mkdirSync(parent, { recursive: true, mode: 0o700 });
    if (lstatSync(parent).isSymbolicLink() || !lstatSync(parent).isDirectory())
      throw new Error('Unsafe workspace parent');
    if (!existsSync(this.root)) mkdirSync(this.root, { mode: 0o700 });
    const stat = lstatSync(this.root);
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('Unsafe workspace root');
  }
  private locate(relative: string, allowMissing = false): string {
    if (typeof relative !== 'string' || relative.length > 240 || relative.startsWith('/') ||
        relative.includes('\\') || relative.includes('\0') ||
        relative.split('/').some(part => !part || part === '.' || part === '..' || part.startsWith('.')))
      throw new RangeError('Unsafe relative workspace path');
    const parts = relative.split('/');
    if (parts.length > 8) throw new RangeError('Workspace nesting exceeded');
    this.ensureRoot();
    let current = this.root;
    for (let i = 0; i < parts.length; i++) {
      current = path.join(current, parts[i]!);
      if (existsSync(current)) {
        const stat = lstatSync(current);
        if (stat.isSymbolicLink() || (!stat.isFile() && !stat.isDirectory()))
          throw new Error('Unsafe workspace entry');
      } else if (!allowMissing || i < parts.length - 1) {
        throw new Error('Workspace entry is absent');
      }
    }
    return current;
  }
  list(relative = ''): WorkspaceEntry[] {
    this.ensureRoot();
    const folder = relative ? this.locate(relative) : this.root;
    if (!lstatSync(folder).isDirectory()) throw new RangeError('Not a directory');
    const found: WorkspaceEntry[] = [];
    for (const item of readdirSync(folder, { withFileTypes: true })) {
      if (item.name.startsWith('.')) continue;
      if (item.isSymbolicLink() || (!item.isFile() && !item.isDirectory())) continue;
      if (found.length >= MAX_LIST) break;
      const stat = lstatSync(path.join(folder, item.name));
      found.push({
        name: item.name,
        kind: item.isDirectory() ? 'directory' : 'file',
        bytes: item.isFile() ? stat.size : 0,
      });
    }
    return found.sort((a, b) => a.name.localeCompare(b.name));
  }
  read(relative: string): string {
    if (!EXT.test(relative)) throw new RangeError('Not a previewable text format');
    const file = this.locate(relative);
    const stat = lstatSync(file);
    if (!stat.isFile() || stat.size > MAX_TEXT) throw new RangeError('File exceeds preview limit');
    return readFileSync(file, 'utf8');
  }
  apply(action: FileAction, relative: string, payload?: { content?: string; destination?: string }): void {
    if (!['mkdir', 'save', 'rename', 'delete'].includes(action))
      throw new RangeError('Invalid file action');
    if (action === 'mkdir') {
      const target = this.locate(relative, true);
      mkdirSync(target, { mode: 0o700 }); // existing directory is not overwritten
    } else if (action === 'save') {
      if (!EXT.test(relative) || typeof payload?.content !== 'string' ||
          Buffer.byteLength(payload.content, 'utf8') > MAX_TEXT)
        throw new RangeError('Invalid or oversized text document');
      const file = this.locate(relative, true);
      if (existsSync(file) && !lstatSync(file).isFile())
        throw new RangeError('Not a text file');
      const temp = path.join(path.dirname(file), '.' + randomUUID() + '.tmp');
      writeFileSync(temp, payload.content, { flag: 'wx', mode: 0o600 });
      try { renameSync(temp, file); } catch (err) { rmSync(temp, { force: true }); throw err; }
    } else if (action === 'rename') {
      const source = this.locate(relative);
      const destination = this.locate(payload?.destination ?? '', true);
      if (existsSync(destination)) throw new Error('Destination exists; overwrite denied');
      renameSync(source, destination);
    } else {
      const target = this.locate(relative);
      if (lstatSync(target).isDirectory() && readdirSync(target).length)
        throw new Error('Delete empty directories only');
      rmSync(target);
    }
  }
}

export interface BackupRecord {
  name: string;
  createdAt: string;
  files: number;
}
/**
 * Entirely independent workspace snapshots using existing node:fs primitives.
 * No secrets or owned production-site data are included.
 */
export class WorkspaceBackups {
  constructor(
    private readonly files: WorkspaceFiles,
    private readonly storage = path.join(os.homedir(), '.local', 'state', 'pockethost', 'h3-snapshots'),
  ) {}
  private root(): string {
    mkdirSync(this.storage, { recursive: true, mode: 0o700 });
    if (lstatSync(this.storage).isSymbolicLink() || !lstatSync(this.storage).isDirectory())
      throw new Error('Unsafe snapshot storage');
    return this.storage;
  }
  private snapshotName(name: string): void {
    if (!/^snapshot-[0-9]{8}-[a-f0-9]{12}$/.test(name)) throw new RangeError('Invalid snapshot name');
  }
  list(): BackupRecord[] {
    const root = this.root();
    return readdirSync(root, { withFileTypes: true }).filter(entry =>
      entry.isDirectory() && !entry.isSymbolicLink() && /^snapshot-[0-9]{8}-[a-f0-9]{12}$/.test(entry.name),
    ).slice(0, 40).map(entry => {
      const folder = path.join(root, entry.name);
      const manifest = JSON.parse(readFileSync(path.join(folder, 'manifest.json'), 'utf8')) as BackupRecord;
      if (manifest.name !== entry.name || !Number.isInteger(manifest.files)) throw new Error('Invalid snapshot');
      return manifest;
    }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  private capture(destination: string): number {
    const root = this.files.root;
    this.files.list();
    let count = 0, total = 0;
    const stack: Array<{ source: string; target: string; level: number }> =
      [{ source: root, target: destination, level: 0 }];
    while (stack.length) {
      const dir = stack.pop()!;
      if (dir.level > 8) throw new RangeError('Workspace depth exceeded');
      mkdirSync(dir.target, { recursive: true, mode: 0o700 });
      for (const entry of readdirSync(dir.source, { withFileTypes: true })) {
        if (entry.name.startsWith('.') || entry.isSymbolicLink()) throw new Error('Hidden or linked entry refused');
        if (entry.isDirectory()) stack.push({
          source: path.join(dir.source, entry.name),
          target: path.join(dir.target, entry.name), level: dir.level + 1,
        });
        else if (entry.isFile()) {
          const source = path.join(dir.source, entry.name);
          const bytes = statSync(source).size;
          if (++count > 200 || (total += bytes) > 8 * 1024 * 1024)
            throw new RangeError('Workspace snapshot budget exceeded');
          writeFileSync(path.join(dir.target, entry.name), readFileSync(source), { mode: 0o600, flag: 'wx' });
        } else throw new Error('Unsupported entry');
      }
    }
    return count;
  }
  create(): BackupRecord {
    const name = 'snapshot-' + new Date().toISOString().slice(0, 10).replaceAll('-', '') + '-' +
      randomBytes(6).toString('hex');
    const folder = path.join(this.root(), name);
    mkdirSync(folder, { mode: 0o700 });
    try {
      const files = this.capture(path.join(folder, 'data'));
      const manifest = { name, createdAt: new Date().toISOString(), files };
      writeFileSync(path.join(folder, 'manifest.json'), JSON.stringify(manifest), { flag: 'wx', mode: 0o600 });
      return manifest;
    } catch (error) {
      rmSync(folder, { recursive: true, force: true });
      throw error;
    }
  }
  restore(name: string): BackupRecord {
    this.snapshotName(name);
    const record = this.list().find(item => item.name === name);
    if (!record) throw new RangeError('Unknown workspace snapshot');
    // Restore via a fresh isolated staging directory, then atomically swap
    // the owned workspace only; preserve the former directory for recovery.
    const folder = path.join(this.root(), name, 'data');
    const staging = this.files.root + '.restore-' + randomUUID();
    const previous = this.files.root + '.before-restore-' + randomUUID();
    if (existsSync(staging) || existsSync(previous)) throw new Error('Restore collision');
    const sourceFiles = new WorkspaceFiles(folder);
    try {
      new WorkspaceBackups(sourceFiles, this.storage).capture(staging);
      this.files.list();
      renameSync(this.files.root, previous);
      try { renameSync(staging, this.files.root); }
      catch (err) { renameSync(previous, this.files.root); throw err; }
      // Preserve previous workspace in a sidecar; never silently delete it.
      return record;
    } finally {
      if (existsSync(staging)) rmSync(staging, { recursive: true, force: true });
    }
  }
  delete(name: string): void {
    this.snapshotName(name);
    if (!this.list().some(item => item.name === name)) throw new RangeError('Unknown snapshot');
    rmSync(path.join(this.root(), name), { recursive: true, force: false });
  }
}
