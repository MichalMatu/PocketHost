import { randomBytes, randomUUID } from 'node:crypto';
import {
  existsSync,
  lstatSync,
  mkdirSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { executeFixed, type Exec, type HostCommandResult, type WorkspaceFiles } from './termux-admin.ts';

const RESTIC_BIN = '/data/data/com.termux/files/usr/bin/restic';
const MAX_SNAPSHOTS = 40;
const SNAPSHOT_ID = /^[a-f0-9]{64}$/;

export interface ResticSnapshot {
  id: string;
  time: string;
  paths: string[];
}

/**
 * Native Restic integration, restricted to the independently owned H3
 * workspace. Never accepts a caller-supplied executable, repository,
 * backup source, password file or arbitrary restore destination.
 */
export class ResticWorkspaceAdmin {
  private readonly files: WorkspaceFiles;
  private readonly state: string;

  constructor(
    files: WorkspaceFiles,
    state = path.join(os.homedir(), '.local', 'state', 'pockethost', 'h3-restic'),
  ) {
    this.files = files;
    this.state = state;
  }

  private prepare(createKey = false): { repository: string; passwordFile: string } {
    this.files.list();
    if (!existsSync(this.state)) mkdirSync(this.state, { recursive: true, mode: 0o700 });
    const dir = lstatSync(this.state);
    if (!dir.isDirectory() || dir.isSymbolicLink()) throw new Error('Unsafe Restic state');
    const repository = path.join(this.state, 'repo');
    if (existsSync(repository)) {
      const stat = lstatSync(repository);
      if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('Unsafe Restic repository');
    }
    const passwordFile = path.join(this.state, 'password');
    if (!existsSync(passwordFile) && createKey) {
      writeFileSync(passwordFile, randomBytes(48).toString('base64url') + '\n', {
        flag: 'wx',
        mode: 0o600,
      });
    }
    if (!existsSync(passwordFile)) throw new Error('Restic repository not initialized');
    const passwordStat = lstatSync(passwordFile);
    if (!passwordStat.isFile() || passwordStat.isSymbolicLink() ||
        passwordStat.size < 32 || passwordStat.size > 200 || (passwordStat.mode & 0o077) !== 0)
      throw new Error('Unsafe Restic password file');
    return { repository, passwordFile };
  }

  private isInitialized(repository: string): boolean {
    const config = path.join(repository, 'config');
    if (!existsSync(config)) return false;
    const stat = lstatSync(config);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('Unsafe Restic config');
    return true;
  }

  private async restic(
    args: string[],
    run: Exec,
    timeout: number,
    createKey = false,
  ): Promise<HostCommandResult> {
    const { repository, passwordFile } = this.prepare(createKey);
    return run(RESTIC_BIN, ['-r', repository, ...args], {
      timeout,
      maxBuffer: 192000,
      outputLimit: 170000,
      env: {
        ...process.env,
        RESTIC_PASSWORD: undefined,
        RESTIC_PASSWORD_COMMAND: undefined,
        RESTIC_REPOSITORY: undefined,
        RESTIC_PASSWORD_FILE: passwordFile,
      },
    });
  }

  async initialize(run: Exec = executeFixed): Promise<{ initialized: true }> {
    const { repository } = this.prepare(true);
    if (!this.isInitialized(repository)) {
      await this.restic(['init'], run, 100000);
      if (!this.isInitialized(repository)) throw new Error('Restic repository creation incomplete');
    }
    return { initialized: true };
  }

  async backup(run: Exec = executeFixed): Promise<HostCommandResult> {
    await this.initialize(run);
    return this.restic(
      ['backup', '--tag', 'pockethost-h3', '--', this.files.root],
      run,
      600000,
    );
  }

  async snapshots(run: Exec = executeFixed): Promise<ResticSnapshot[]> {
    const { repository } = this.prepare();
    if (!this.isInitialized(repository)) throw new Error('Restic repository not initialized');
    const result = await this.restic(['snapshots', '--json', '--tag', 'pockethost-h3'], run, 40000);
    const data: unknown = JSON.parse(result.output.trim());
    if (!Array.isArray(data) || data.length > 2000) throw new Error('Invalid Restic snapshot inventory');
    const records: ResticSnapshot[] = [];
    for (const item of data) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
      const snapshot = item as Record<string, unknown>;
      if (typeof snapshot.id !== 'string' || !SNAPSHOT_ID.test(snapshot.id) ||
          typeof snapshot.time !== 'string' || snapshot.time.length > 60 ||
          !Array.isArray(snapshot.paths) || snapshot.paths.length > 8 ||
          !snapshot.paths.every(value => typeof value === 'string' && value.length < 256))
        continue;
      if (!snapshot.paths.includes(this.files.root)) continue;
      records.push({ id: snapshot.id, time: snapshot.time, paths: [this.files.root] });
    }
    return records.sort((a, b) => b.time.localeCompare(a.time)).slice(0, MAX_SNAPSHOTS);
  }

  async check(run: Exec = executeFixed): Promise<HostCommandResult> {
    const { repository } = this.prepare();
    if (!this.isInitialized(repository)) throw new Error('Restic repository not initialized');
    return this.restic(['check'], run, 600000);
  }

  async restoreToStaging(id: string, run: Exec = executeFixed): Promise<{ restoredTo: string }> {
    if (!SNAPSHOT_ID.test(id)) throw new RangeError('Invalid Restic snapshot ID');
    const known = await this.snapshots(run);
    if (!known.some(item => item.id === id)) throw new RangeError('Unknown owned snapshot');
    const destination = path.join(this.state, 'restores', 'restore-' + randomUUID());
    mkdirSync(path.dirname(destination), { recursive: true, mode: 0o700 });
    if (existsSync(destination)) throw new Error('Restore staging collision');
    await this.restic(['restore', id, '--target', destination], run, 600000);
    if (!existsSync(destination) || !statSync(destination).isDirectory() ||
        lstatSync(destination).isSymbolicLink())
      throw new Error('Restic staging failed verification');
    return { restoredTo: destination };
  }

  async forget(id: string, run: Exec = executeFixed): Promise<HostCommandResult> {
    if (!SNAPSHOT_ID.test(id)) throw new RangeError('Invalid Restic snapshot ID');
    const known = await this.snapshots(run);
    if (!known.some(item => item.id === id)) throw new RangeError('Unknown owned snapshot');
    return this.restic(['forget', '--prune', id], run, 600000);
  }

  private scopeRoots(scope: 'home' | 'prefix' | 'all'): string[] {
    const home = os.homedir();
    const prefix = '/data/data/com.termux/files/usr';
    if (scope === 'home') return [home];
    if (scope === 'prefix') return [prefix];
    if (scope === 'all') return [home, prefix];
    throw new RangeError('Unknown backup scope');
  }

  /** Real encrypted backup of chosen Termux scope; never recursively backs up the repository/key. */
  async backupScope(
    scope: 'home' | 'prefix' | 'all',
    run: Exec = executeFixed,
  ): Promise<HostCommandResult> {
    const roots = this.scopeRoots(scope);
    await this.initialize(run);
    return this.restic([
      'backup', '--tag', 'pockethost-h34-' + scope,
      '--exclude', this.state,
      '--', ...roots,
    ], run, 600000);
  }

  async scopeSnapshots(
    scope: 'home' | 'prefix' | 'all',
    run: Exec = executeFixed,
  ): Promise<ResticSnapshot[]> {
    const roots = this.scopeRoots(scope);
    const { repository } = this.prepare();
    if (!this.isInitialized(repository)) throw new Error('Restic repository not initialized');
    const result = await this.restic([
      'snapshots', '--json', '--tag', 'pockethost-h34-' + scope,
    ], run, 40000);
    const data: unknown = JSON.parse(result.output.trim());
    if (!Array.isArray(data) || data.length > 2000) throw new Error('Invalid system snapshot inventory');
    const records: ResticSnapshot[] = [];
    for (const item of data) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
      const snapshot = item as Record<string, unknown>;
      if (typeof snapshot.id !== 'string' || !SNAPSHOT_ID.test(snapshot.id) ||
          typeof snapshot.time !== 'string' || snapshot.time.length > 60 ||
          !Array.isArray(snapshot.paths) || snapshot.paths.length !== roots.length ||
          !roots.every(root => (snapshot.paths as string[]).includes(root)))
        continue;
      records.push({ id: snapshot.id, time: snapshot.time, paths: roots });
    }
    return records.sort((a, b) => b.time.localeCompare(a.time)).slice(0, MAX_SNAPSHOTS);
  }

  async restoreScopeToStaging(
    scope: 'home' | 'prefix' | 'all',
    id: string,
    run: Exec = executeFixed,
  ): Promise<{ restoredTo: string }> {
    if (!SNAPSHOT_ID.test(id)) throw new RangeError('Invalid Restic snapshot ID');
    const snapshots = await this.scopeSnapshots(scope, run);
    if (!snapshots.some(item => item.id === id)) throw new Error('Snapshot not in selected scope');
    const destination = path.join(this.state, 'restores', 'system-' + randomUUID());
    mkdirSync(path.dirname(destination), { recursive: true, mode: 0o700 });
    if (existsSync(destination)) throw new Error('Staging directory already exists');
    await this.restic(['restore', id, '--target', destination], run, 600000);
    if (!existsSync(destination) || !lstatSync(destination).isDirectory() ||
        lstatSync(destination).isSymbolicLink())
      throw new Error('System staging restore incomplete');
    return { restoredTo: destination };
  }

  async forgetScope(
    scope: 'home' | 'prefix' | 'all',
    id: string,
    run: Exec = executeFixed,
  ): Promise<HostCommandResult> {
    if (!SNAPSHOT_ID.test(id)) throw new RangeError('Invalid Restic snapshot ID');
    const snapshots = await this.scopeSnapshots(scope, run);
    if (!snapshots.some(item => item.id === id)) throw new Error('Unknown selected-scope snapshot');
    return this.restic(['forget', '--prune', id], run, 600000);
  }

  /** Summary only; encrypted repository key is never returned in the API. */
  status(): { initialized: boolean; repositoryPresent: boolean; keyPresent: boolean } {
    const repository = path.join(this.state, 'repo');
    const key = path.join(this.state, 'password');
    const present = existsSync(repository);
    if (!present && !existsSync(key)) return {
      initialized: false, repositoryPresent: false, keyPresent: false,
    };
    const prepared = this.prepare();
    return {
      initialized: this.isInitialized(prepared.repository),
      repositoryPresent: present,
      keyPresent: true,
    };
  }
}
