import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  closeSync,
  existsSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  readlinkSync,
  realpathSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { createServer } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import {
  OWNED_PHOTOMAP_ID,
  OWNED_PHOTOMAP_PORT,
  type PhotoMapRuntimePort,
  type PhotoMapRuntimeSnapshot,
} from '../../shared/photomap-runtime.ts';

const RELEASE = 'import-20261106';
const MAX_MANIFEST = 65536;
const VERSION = /^[a-z0-9][a-z0-9-]{1,63}$/;
const LOG_LIMIT = 65536;

type RecordData = Record<string, unknown>;

interface OwnedMarker {
  schema: 1;
  owner: 'pockethost';
  instance: typeof OWNED_PHOTOMAP_ID;
  release: typeof RELEASE;
  runtimeVersion: string;
  pid: number;
  startTicks: string;
  executable: string;
  cwd: string;
  argvSha256: string;
}

function directory(folder: string): void {
  const stat = lstatSync(folder);
  if (!stat.isDirectory() || stat.isSymbolicLink() || realpathSync(folder) !== folder) {
    throw new Error('Managed PhotoMap directory is not canonical');
  }
}

function json(file: string): RecordData {
  const stat = lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > MAX_MANIFEST) {
    throw new Error('Unsafe PhotoMap runtime manifest');
  }
  const data: unknown = JSON.parse(readFileSync(file, 'utf8'));
  if (!data || Array.isArray(data) || typeof data !== 'object') {
    throw new Error('Malformed PhotoMap runtime manifest');
  }
  return data as RecordData;
}

function owner(item: RecordData): void {
  if (
    item.schema_version !== 1 ||
    item.owner !== 'pockethost' ||
    item.instance_id !== OWNED_PHOTOMAP_ID
  ) {
    throw new Error('PhotoMap runtime ownership mismatch');
  }
}

function startTicks(pid: number): string | null {
  if (!Number.isSafeInteger(pid) || pid < 2) return null;
  try {
    const raw = readFileSync('/proc/' + pid + '/stat', 'utf8');
    const fields = raw.slice(raw.lastIndexOf(')') + 2).trim().split(/\s+/);
    return /^\d+$/.test(fields[19] ?? '') ? fields[19] : null;
  } catch {
    return null;
  }
}

function digest(args: ReadonlyArray<string>): string {
  return createHash('sha256').update(JSON.stringify(args)).digest('hex');
}

function portFree(): Promise<boolean> {
  return new Promise((resolve) => {
    const listener = createServer();
    listener.once('error', () => resolve(false));
    listener.listen(OWNED_PHOTOMAP_PORT, '127.0.0.1', () =>
      listener.close(() => resolve(true)),
    );
  });
}

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface LaunchPlan {
  version: string;
  versionRoot: string;
  executable: string;
  args: string[];
  source: string;
}

/**
 * Project-local PhotoMap runtime candidate. The imported device manifests are
 * disabled, so this adapter cannot launch anything before a separate approved
 * isolated-rootfs/profile transaction. No automatic startup is implemented.
 */
export class ManagedPhotoMapRuntimeHost implements PhotoMapRuntimePort {
  private readonly root: string;
  private readonly instance: string;
  private readonly state: string;

  constructor(root = path.join(realpathSync(os.homedir()), 'Projects', 'PocketHost-Managed')) {
    this.root = root;
    this.instance = path.join(root, 'instances', OWNED_PHOTOMAP_ID);
    this.state = path.join(this.instance, 'runtime', 'state');
  }

  private metadata(): { runtime: RecordData; current: RecordData } {
    directory(this.root);
    directory(path.join(this.root, 'instances'));
    directory(this.instance);
    directory(path.join(this.instance, 'manifests'));
    const runtime = json(path.join(this.instance, 'manifests', 'runtime.json'));
    const current = json(path.join(this.instance, 'current.json'));
    owner(runtime);
    owner(current);
    if (
      current.selected_release !== RELEASE ||
      runtime.runtime_kind !== 'debian-proot' ||
      runtime.port !== OWNED_PHOTOMAP_PORT ||
      runtime.autostart !== false
    ) {
      throw new Error('Managed PhotoMap release or runtime changed');
    }
    return { runtime, current };
  }

  private plan(): LaunchPlan | null {
    const { runtime } = this.metadata();
    if (
      runtime.enabled !== true ||
      runtime.launch_allowed !== true ||
      runtime.managed_proot_snapshot !== true
    ) {
      return null;
    }
    const active = json(path.join(this.instance, 'runtime', 'active-version.json'));
    owner(active);
    const version = active.selected_runtime;
    if (typeof version !== 'string' || !VERSION.test(version)) {
      throw new Error('Unsafe runtime version');
    }
    const base = path.join(this.instance, 'runtime', 'versions');
    directory(path.join(this.instance, 'runtime'));
    directory(base);
    const versionRoot = path.join(base, version);
    directory(versionRoot);
    const profile = json(path.join(versionRoot, 'profile.json'));
    owner(profile);
    if (
      profile.source_release !== RELEASE ||
      profile.runtime_version !== version ||
      profile.isolated_rootfs !== true ||
      profile.autostart !== false ||
      profile.port !== OWNED_PHOTOMAP_PORT ||
      typeof profile.requirements_sha256 !== 'string' ||
      !/^[a-f0-9]{64}$/.test(profile.requirements_sha256)
    ) {
      throw new Error('Unsafe runtime version profile');
    }
    const source = path.join(this.instance, 'releases', RELEASE, 'source');
    directory(path.join(this.instance, 'releases'));
    directory(path.join(this.instance, 'releases', RELEASE));
    directory(source);
    const req = path.join(source, 'backend', 'requirements.txt');
    if (digestFile(req) !== profile.requirements_sha256 || existsSync(path.join(source, '.env'))) {
      throw new Error('Runtime source dependency or environment mismatch');
    }
    const rootfs = path.join(versionRoot, 'rootfs');
    const work = path.join(versionRoot, 'work');
    for (const folder of [
      rootfs,
      work,
      path.join(work, 'database'),
      path.join(work, 'storage'),
      path.join(work, 'storage', 'private'),
      path.join(work, 'storage', 'public'),
    ]) {
      directory(folder);
    }
    if (
      !existsSync(path.join(work, 'database', 'app.db')) ||
      !existsSync(path.join(source, 'frontend', 'dist', 'index.html'))
    ) {
      throw new Error('PhotoMap isolated working data or frontend missing');
    }
    const prefix = process.env.PREFIX ?? '';
    if (
      prefix !== '/data/data/com.termux/files/usr' &&
      prefix !== '/data/user/0/com.termux/files/usr'
    ) {
      throw new Error('This runtime requires an exact Termux installation');
    }
    const executable = realpathSync(path.join(prefix, 'bin', 'proot'));
    const args = [
      '-R',
      rootfs,
      '-b',
      source + ':/mnt/source',
      '-b',
      path.join(work, 'database') + ':/mnt/data',
      '-b',
      path.join(work, 'storage') + ':/mnt/storage',
      '-w',
      '/mnt/source',
      '/opt/pockethost-venv/bin/python',
      '-m',
      'uvicorn',
      'server:create_app',
      '--factory',
      '--host',
      '127.0.0.1',
      '--port',
      String(OWNED_PHOTOMAP_PORT),
      '--lifespan',
      'off',
      '--no-server-header',
    ];
    return { version, versionRoot, executable, args, source };
  }

  private marker(): OwnedMarker | null {
    const file = path.join(this.state, 'active.json');
    if (!existsSync(file)) return null;
    directory(this.state);
    const item = json(file) as unknown as OwnedMarker;
    if (
      item.schema !== 1 ||
      item.owner !== 'pockethost' ||
      item.instance !== OWNED_PHOTOMAP_ID ||
      item.release !== RELEASE ||
      !VERSION.test(item.runtimeVersion) ||
      !Number.isSafeInteger(item.pid) ||
      item.pid < 2 ||
      !/^\d+$/.test(item.startTicks) ||
      !/^[a-f0-9]{64}$/.test(item.argvSha256)
    ) {
      throw new Error('Unsafe PhotoMap process marker');
    }
    return item;
  }

  private owned(marker: OwnedMarker, plan: LaunchPlan): boolean {
    if (
      marker.runtimeVersion !== plan.version ||
      marker.executable !== plan.executable ||
      marker.cwd !== plan.versionRoot ||
      marker.argvSha256 !== digest(plan.args) ||
      startTicks(marker.pid) !== marker.startTicks
    ) {
      return false;
    }
    try {
      const exe = readlinkSync('/proc/' + marker.pid + '/exe');
      const cwd = readlinkSync('/proc/' + marker.pid + '/cwd');
      const argv = readFileSync('/proc/' + marker.pid + '/cmdline', 'utf8')
        .split('\0')
        .filter(Boolean);
      return (
        exe === plan.executable &&
        cwd === plan.versionRoot &&
        digest(argv.slice(1)) === marker.argvSha256
      );
    } catch {
      return false;
    }
  }

  inspect(): PhotoMapRuntimeSnapshot {
    const plan = this.plan();
    const basic: PhotoMapRuntimeSnapshot = {
      version: 1,
      id: OWNED_PHOTOMAP_ID,
      ownership: 'pockethost',
      sourceRelease: RELEASE,
      runtimeVersion: plan?.version ?? null,
      state: 'disabled',
      port: OWNED_PHOTOMAP_PORT,
      autostart: false,
      manualStartAllowed: false,
      healthy: null,
    };
    if (!plan) return basic;
    const marker = this.marker();
    const state = !marker
      ? 'stopped'
      : this.owned(marker, plan)
        ? 'running'
        : startTicks(marker.pid) === null
          ? 'stopped'
          : 'unknown';
    return { ...basic, state, manualStartAllowed: true };
  }

  private event(message: string): void {
    if (!existsSync(this.state)) return;
    directory(this.state);
    const file = path.join(this.state, 'events.log');
    if (existsSync(file) && lstatSync(file).size > LOG_LIMIT) {
      unlinkSync(file);
    }
    writeFileSync(file, new Date().toISOString() + ' ' + message + '\n', {
      flag: 'a',
      mode: 0o600,
    });
  }

  async start(): Promise<PhotoMapRuntimeSnapshot> {
    const plan = this.plan();
    if (!plan) throw new Error('PhotoMap runtime not approved for launch');
    const current = this.inspect();
    if (current.state === 'running') return current;
    if (current.state !== 'stopped' || this.marker()) {
      throw new Error('Unverified PhotoMap process state; start denied');
    }
    if (!(await portFree())) throw new Error('PhotoMap port already in use');
    directory(this.state);
    const claim = path.join(this.state, 'start.claim');
    const handle = openSync(claim, 'wx', 0o600);
    closeSync(handle);
    try {
      const child = spawn(plan.executable, plan.args, {
        cwd: plan.versionRoot,
        shell: false,
        detached: true,
        stdio: 'ignore',
        env: {
          PATH: process.env.PREFIX + '/bin',
          HOME: plan.versionRoot,
          PYTHONDONTWRITEBYTECODE: '1',
          PHOTOMAP_ENV: 'development',
          PHOTOMAP_DATA_DIR: '/mnt/data',
          DATABASE_URL: 'sqlite:////mnt/data/app.db',
          PHOTOMAP_STORAGE_DIR: '/mnt/storage',
          PHOTOMAP_FRONTEND_DIST_DIR: '/mnt/source/frontend/dist',
          PHOTOMAP_ALLOWED_HOSTS: 'localhost,127.0.0.1',
          FRONTEND_ORIGINS: 'http://127.0.0.1:8010,http://localhost:8010',
        },
      });
      child.on('error', () => {
        // A failed native spawn never permits PID-only cleanup.
      });
      if (!child.pid) throw new Error('PRoot spawn did not return an owned PID');
      let ticks: string | null = null;
      for (let i = 0; i < 30; i++) {
        ticks = startTicks(child.pid);
        if (ticks) break;
        await pause(40);
      }
      if (!ticks) throw new Error('Cannot attest PRoot process start ticks');
      const marker: OwnedMarker = {
        schema: 1,
        owner: 'pockethost',
        instance: OWNED_PHOTOMAP_ID,
        release: RELEASE,
        runtimeVersion: plan.version,
        pid: child.pid,
        startTicks: ticks,
        executable: plan.executable,
        cwd: plan.versionRoot,
        argvSha256: digest(plan.args),
      };
      writeFileSync(path.join(this.state, 'active.json'), JSON.stringify(marker) + '\n', {
        flag: 'wx',
        mode: 0o600,
      });
      child.unref();
      this.event('manual-start-requested');
      for (let i = 0; i < 45; i++) {
        if (!this.owned(marker, plan)) break;
        if (await this.health()) return this.inspect();
        await pause(110);
      }
      try {
        if (this.owned(marker, plan)) await this.stop();
      } catch {
        // Retain the marker if the process cannot be safely stopped.
      }
      throw new Error('PhotoMap managed health acceptance failed');
    } finally {
      unlinkSync(claim);
    }
  }

  async stop(): Promise<PhotoMapRuntimeSnapshot> {
    const plan = this.plan();
    if (!plan) throw new Error('PhotoMap runtime not approved for stop');
    const marker = this.marker();
    if (!marker) return this.inspect();
    if (!this.owned(marker, plan)) {
      throw new Error('Unverified PhotoMap process identity; stop denied');
    }
    process.kill(marker.pid, 'SIGTERM');
    for (let i = 0; i < 40; i++) {
      if (startTicks(marker.pid) === null && (await portFree())) {
        unlinkSync(path.join(this.state, 'active.json'));
        this.event('manual-stop-completed');
        return this.inspect();
      }
      await pause(100);
    }
    throw new Error('PhotoMap graceful stop uncertain; marker retained');
  }

  async health(): Promise<boolean> {
    const plan = this.plan();
    const marker = plan ? this.marker() : null;
    if (!plan || !marker || !this.owned(marker, plan)) return false;
    try {
      const res = await fetch('http://127.0.0.1:8010/health', {
        signal: AbortSignal.timeout(1000),
      });
      return res.status === 200;
    } catch {
      return false;
    }
  }

  readLogs(): ReadonlyArray<string> {
    if (!existsSync(this.state)) return [];
    directory(this.state);
    const file = path.join(this.state, 'events.log');
    if (!existsSync(file)) return [];
    const stat = lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > LOG_LIMIT * 2) {
      throw new Error('Unsafe managed runtime log');
    }
    return readFileSync(file, 'utf8')
      .split('\n')
      .filter(Boolean)
      .slice(-40)
      .map((line) => line.slice(0, 240));
  }
}

function digestFile(file: string): string {
  const stat = lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > MAX_MANIFEST) {
    throw new Error('Unsafe requirements file');
  }
  return createHash('sha256').update(readFileSync(file)).digest('hex');
}
