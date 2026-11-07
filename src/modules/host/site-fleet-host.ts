import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import {
  closeSync,
  existsSync,
  fstatSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  readSync,
  readdirSync,
  readlinkSync,
  realpathSync,
  renameSync,
  writeFileSync,
} from 'node:fs';
import { createServer } from 'node:net';
import os from 'node:os';
import path from 'node:path';

export const SITE_LIMIT = 8;
export const SITE_PORT_FIRST = 19080;
const SITE_PORT_COUNT = 16;
const ROOT_NAME = 'PocketHost-UserSites';
const MARKER_NAME = '.pockethost-site.json';
const SITE_SCRIPT = path.resolve(import.meta.dirname, 'site-fleet-server.mjs');
const ID = /^site-[a-f0-9]{32}$/;
const RELEASE = /^r-[a-f0-9]{32}$/;
const MAX_FILE = 2 * 1024 * 1024;
const MAX_TOTAL = 8 * 1024 * 1024;
const ALLOWED_ASSETS = new Set([
  'html',
  'htm',
  'css',
  'js',
  'mjs',
  'json',
  'txt',
  'svg',
  'png',
  'jpg',
  'jpeg',
  'webp',
  'gif',
  'ico',
  'woff',
  'woff2',
  'ttf',
  'otf',
  'wasm',
]);

export interface SiteDeployment {
  at: string;
  action: 'publish' | 'rollback';
  from: string | null;
  to: string;
}
interface RecordOnDisk {
  schema: 1;
  id: string;
  name: string;
  owner: 'pockethost-h2';
  instance: string;
  port: number;
  activeRelease: string | null;
  previousRelease: string | null;
  process: { pid: number; ticks: string; startedAt: string } | null;
  createdAt: string;
  history: SiteDeployment[];
}
export interface FleetProject {
  id: string;
  name: string;
  kind: 'static-site';
  state: 'stopped' | 'running' | 'unknown';
  port: number;
  activeRelease: string | null;
  previousRelease: string | null;
  canRollback: boolean;
  pid: number | null;
  startTicks: string | null;
  fileCount: number;
  bytes: number;
  releases: number;
  memoryBytes: number | null;
  uptimeSeconds: number | null;
  healthy: boolean | null;
  history: SiteDeployment[];
}
export interface FleetFile {
  name: string;
  bytes: Buffer;
}

function directory(folder: string): void {
  const s = lstatSync(folder);
  if (!s.isDirectory() || s.isSymbolicLink() || realpathSync(folder) !== folder)
    throw new Error('Site directory not canonical or linked');
}
function fileAt(folder: string, name: string): Buffer {
  const filename = path.join(folder, name);
  const stat = lstatSync(filename);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > MAX_FILE)
    throw new Error('Unsafe owned static asset');
  return readFileSync(filename);
}
function atomic(folder: string, name: string, contents: string): void {
  const temporary = path.join(folder, '.' + randomUUID() + '.tmp');
  writeFileSync(temporary, contents, { flag: 'wx', mode: 0o600 });
  renameSync(temporary, path.join(folder, name));
}
function ticks(pid: number): string | null {
  if (!Number.isSafeInteger(pid) || pid < 2) return null;
  try {
    const stat = readFileSync('/proc/' + pid + '/stat', 'utf8');
    const value = stat
      .slice(stat.lastIndexOf(')') + 2)
      .trim()
      .split(/\s+/)[19];
    return value && /^\d+$/.test(value) ? value : null;
  } catch {
    return null;
  }
}
function present(pid: number): boolean {
  return existsSync('/proc/' + pid + '/stat');
}
function owned(marker: RecordOnDisk, directoryPath: string): boolean {
  const child = marker.process;
  if (!child || ticks(child.pid) !== child.ticks) return false;
  try {
    const argv = readFileSync('/proc/' + child.pid + '/cmdline', 'utf8').split('\0');
    return (
      readlinkSync('/proc/' + child.pid + '/cwd') === directoryPath &&
      argv.includes(SITE_SCRIPT) &&
      argv.includes(marker.id) &&
      argv.includes(marker.instance) &&
      argv.includes(String(marker.port))
    );
  } catch {
    return false;
  }
}
function state(marker: RecordOnDisk, dir: string): FleetProject['state'] {
  if (!marker.process) return 'stopped';
  if (owned(marker, dir)) return 'running';
  return present(marker.process.pid) ? 'unknown' : 'stopped';
}
function validateName(name: unknown): string {
  if (
    typeof name !== 'string' ||
    name.trim().length < 2 ||
    name.trim().length > 60 ||
    !/^[\p{L}\p{N}][\p{L}\p{N} ._-]*$/u.test(name.trim())
  )
    throw new RangeError('Site name must contain 2–60 safe characters');
  return name.trim();
}
function assetName(name: unknown): string {
  if (
    typeof name !== 'string' ||
    name.length > 180 ||
    name.includes('\\') ||
    name.includes('\0') ||
    name.startsWith('/') ||
    /[?#:]/.test(name)
  )
    throw new RangeError('Unsafe asset path');
  const parts = name.split('/');
  const ext = parts.at(-1)?.split('.').at(-1)?.toLowerCase();
  if (
    parts.length > 6 ||
    parts.some((x) => !x || x === '..' || x === '.' || x.startsWith('.')) ||
    !parts.every((x) => /^[\p{L}\p{N}_ ()@+-][\p{L}\p{N}_. ()@+-]*$/u.test(x)) ||
    !ext ||
    !ALLOWED_ASSETS.has(ext)
  )
    throw new RangeError('Asset path denied');
  return name;
}
function requireRelease(root: string, release: string): string {
  if (!RELEASE.test(release)) throw new Error('Invalid owned release identity');
  const folder = path.join(root, 'releases', release);
  directory(folder);
  if (!fileAt(folder, 'index.html').length) throw new Error('Missing owned homepage');
  return folder;
}
function portFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer();
    server.once('error', () => resolve(false));
    server.listen(port, '127.0.0.1', () => server.close(() => resolve(true)));
  });
}
function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class SiteFleetHost {
  private readonly root: string;
  private readonly firstPort: number;
  private queue: Promise<void> = Promise.resolve();

  constructor(root?: string, firstPort = SITE_PORT_FIRST) {
    this.root = root ?? path.join(realpathSync(os.homedir()), 'Projects', ROOT_NAME);
    if (!Number.isSafeInteger(firstPort) || firstPort < 1024 || firstPort + SITE_PORT_COUNT > 65535)
      throw new RangeError('Invalid site port pool');
    this.firstPort = firstPort;
  }
  private lock<T>(action: () => Promise<T> | T): Promise<T> {
    const result = this.queue.then(action, action);
    this.queue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }
  private ensureRoot(): void {
    directory(path.dirname(this.root));
    if (!existsSync(this.root)) mkdirSync(this.root, { mode: 0o700 });
    directory(this.root);
  }
  private ids(): string[] {
    if (!existsSync(this.root)) return [];
    directory(this.root);
    return readdirSync(this.root, { withFileTypes: true })
      .filter((item) => {
        if (!ID.test(item.name)) return false;
        if (!item.isDirectory() || item.isSymbolicLink())
          throw new Error('Unsafe site inventory entry');
        return true;
      })
      .map((item) => item.name)
      .sort();
  }
  private site(id: string): string {
    if (!ID.test(id)) throw new RangeError('Unknown site identifier');
    return path.join(this.root, id);
  }
  private record(id: string): RecordOnDisk {
    const folder = this.site(id);
    directory(this.root);
    directory(folder);
    const raw = fileAt(folder, MARKER_NAME);
    if (raw.length > 8192) throw new Error('Oversized site ownership record');
    const m: unknown = JSON.parse(raw.toString('utf8'));
    if (!m || typeof m !== 'object') throw new Error('Missing owner');
    const v = m as RecordOnDisk;
    if (
      v.schema !== 1 ||
      v.id !== id ||
      v.owner !== 'pockethost-h2' ||
      typeof v.instance !== 'string' ||
      !/^[0-9a-f-]{36}$/.test(v.instance) ||
      validateName(v.name) !== v.name ||
      !Number.isSafeInteger(v.port) ||
      v.port < this.firstPort ||
      v.port >= this.firstPort + SITE_PORT_COUNT ||
      (v.activeRelease !== null && !RELEASE.test(v.activeRelease)) ||
      (v.previousRelease !== null && !RELEASE.test(v.previousRelease)) ||
      typeof v.createdAt !== 'string' ||
      v.createdAt.length > 40 ||
      !Array.isArray(v.history) ||
      v.history.length > 32 ||
      v.history.some(
        (h) =>
          !h ||
          typeof h.at !== 'string' ||
          h.at.length > 40 ||
          !['publish', 'rollback'].includes(h.action) ||
          (h.from !== null && !RELEASE.test(h.from)) ||
          !RELEASE.test(h.to),
      ) ||
      (v.process !== null &&
        (!v.process ||
          !Number.isSafeInteger(v.process.pid) ||
          v.process.pid < 2 ||
          !/^\d+$/.test(v.process.ticks) ||
          typeof v.process.startedAt !== 'string' ||
          v.process.startedAt.length > 40))
    )
      throw new Error('Invalid owned site marker');
    directory(path.join(folder, 'releases'));
    if (v.activeRelease) requireRelease(folder, v.activeRelease);
    if (v.previousRelease) requireRelease(folder, v.previousRelease);
    return v;
  }
  private save(id: string, record: RecordOnDisk): void {
    atomic(this.site(id), MARKER_NAME, JSON.stringify(record) + '\n');
  }
  private counts(id: string, release: string | null): { files: number; bytes: number } {
    if (!release) return { files: 0, bytes: 0 };
    const root = requireRelease(this.site(id), release);
    const pending = [root];
    let files = 0;
    let bytes = 0;
    while (pending.length) {
      const parent = pending.pop()!;
      directory(parent);
      for (const entry of readdirSync(parent, { withFileTypes: true })) {
        if (entry.isSymbolicLink()) throw new Error('Linked static asset rejected');
        const full = path.join(parent, entry.name);
        if (entry.isDirectory()) pending.push(full);
        else if (entry.isFile()) {
          const stat = lstatSync(full);
          if (stat.size > MAX_FILE || ++files > 100 || (bytes += stat.size) > MAX_TOTAL)
            throw new Error('Owned release asset budget exceeded');
        } else throw new Error('Unsafe static asset');
      }
    }
    return { files, bytes };
  }
  private details(id: string, item: RecordOnDisk): FleetProject {
    const stateNow = state(item, this.site(id));
    const live = stateNow === 'running';
    const counts = this.counts(id, item.activeRelease);
    const releaseRoot = path.join(this.site(id), 'releases');
    const releases = readdirSync(releaseRoot).filter((name) => RELEASE.test(name)).length;
    let memoryBytes: number | null = null;
    if (live && item.process) {
      try {
        const data = readFileSync('/proc/' + item.process.pid + '/status', 'utf8');
        const match = /^VmRSS:\s+(\d+)\s+kB/m.exec(data);
        if (match) memoryBytes = Number(match[1]) * 1024;
      } catch {
        /* Android may deny host metrics. */
      }
    }
    return {
      id,
      name: item.name,
      kind: 'static-site',
      state: stateNow,
      port: item.port,
      activeRelease: item.activeRelease,
      previousRelease: item.previousRelease,
      canRollback: item.previousRelease !== null,
      pid: live ? item.process!.pid : null,
      startTicks: live ? item.process!.ticks : null,
      fileCount: counts.files,
      bytes: counts.bytes,
      releases,
      memoryBytes,
      uptimeSeconds: live
        ? Math.max(0, Math.floor((Date.now() - Date.parse(item.process!.startedAt)) / 1000))
        : null,
      healthy: null,
      history: [...item.history].slice(-25).reverse(),
    };
  }
  list(): FleetProject[] {
    return this.ids().map((id) => this.details(id, this.record(id)));
  }
  inspect(id: string): FleetProject {
    return this.details(id, this.record(id));
  }
  async create(name: string): Promise<FleetProject> {
    return this.lock(async () => {
      const label = validateName(name);
      this.ensureRoot();
      const ids = this.ids();
      if (ids.length >= SITE_LIMIT) throw new RangeError('Site limit reached');
      const assigned = ids.map((id) => this.record(id).port);
      let port: number | null = null;
      for (let i = 0; i < SITE_PORT_COUNT; i++) {
        const candidate = this.firstPort + i;
        if (!assigned.includes(candidate) && (await portFree(candidate))) {
          port = candidate;
          break;
        }
      }
      if (port === null) throw new Error('No safe local port is free');
      const id = 'site-' + randomUUID().replaceAll('-', '');
      const folder = this.site(id);
      mkdirSync(folder, { mode: 0o700 });
      mkdirSync(path.join(folder, 'releases'), { mode: 0o700 });
      this.save(id, {
        schema: 1,
        id,
        name: label,
        owner: 'pockethost-h2',
        instance: randomUUID(),
        port,
        activeRelease: null,
        previousRelease: null,
        process: null,
        createdAt: new Date().toISOString(),
        history: [],
      });
      return this.inspect(id);
    });
  }
  async deploy(id: string, incoming: ReadonlyArray<FleetFile>): Promise<FleetProject> {
    return this.lock(() => {
      const item = this.record(id);
      if (state(item, this.site(id)) === 'unknown')
        throw new Error('Process identity uncertain; deployment denied');
      if (!incoming.length || incoming.length > 100)
        throw new RangeError('Invalid site file count');
      const seen = new Set<string>();
      let bytes = 0;
      const files = incoming.map((f) => {
        const filename = assetName(f.name);
        if (
          !Buffer.isBuffer(f.bytes) ||
          f.bytes.length > MAX_FILE ||
          (bytes += f.bytes.length) > MAX_TOTAL ||
          seen.has(filename.toLowerCase())
        )
          throw new RangeError('Unsafe site asset size or duplicate');
        seen.add(filename.toLowerCase());
        return { name: filename, bytes: f.bytes };
      });
      if (!files.find((f) => f.name === 'index.html' && f.bytes.length))
        throw new RangeError('Site requires root index.html');
      const dir = this.site(id);
      const releases = path.join(dir, 'releases');
      directory(releases);
      const entries = readdirSync(releases);
      if (entries.length >= 16) throw new RangeError('Owned release storage limit reached');
      const stage = mkdtempSync(path.join(releases, '.stage-'));
      directory(stage);
      for (const file of files) {
        const dest = path.join(stage, file.name);
        mkdirSync(path.dirname(dest), { recursive: true, mode: 0o700 });
        writeFileSync(dest, file.bytes, { mode: 0o600, flag: 'wx' });
      }
      const revision = 'r-' + randomUUID().replaceAll('-', '');
      renameSync(stage, path.join(releases, revision));
      const prior = item.activeRelease;
      item.activeRelease = revision;
      item.previousRelease = prior;
      item.history = [
        ...item.history.slice(-31),
        {
          at: new Date().toISOString(),
          action: 'publish' as const,
          from: prior,
          to: revision,
        },
      ];
      // The static server reads the marker for each request. If this fails,
      // the previous active release is still served; an orphan release is inert.
      this.save(id, item);
      return this.inspect(id);
    });
  }
  async rollback(id: string): Promise<FleetProject> {
    return this.lock(() => {
      const item = this.record(id);
      if (state(item, this.site(id)) === 'unknown' || !item.previousRelease)
        throw new RangeError('No safe previous owned release');
      requireRelease(this.site(id), item.previousRelease);
      const next = item.previousRelease;
      const old = item.activeRelease;
      item.activeRelease = next;
      item.previousRelease = null;
      item.history = [
        ...item.history.slice(-31),
        {
          at: new Date().toISOString(),
          action: 'rollback' as const,
          from: old,
          to: next,
        },
      ];
      this.save(id, item);
      return this.inspect(id);
    });
  }
  async health(id: string): Promise<boolean> {
    const item = this.record(id);
    if (state(item, this.site(id)) !== 'running') return false;
    try {
      const result = await fetch('http://127.0.0.1:' + item.port + '/', {
        signal: AbortSignal.timeout(1500),
      });
      return result.status === 200 && result.headers.get('x-pockethost-instance') === item.instance;
    } catch {
      return false;
    }
  }
  async start(id: string): Promise<FleetProject> {
    return this.lock(async () => {
      const item = this.record(id);
      if (!item.activeRelease) throw new RangeError('Publish the site before Start');
      const folder = this.site(id);
      if (state(item, folder) === 'running') return this.inspect(id);
      if (item.process && present(item.process.pid))
        throw new Error('Unverified process; Start denied');
      if (!(await portFree(item.port))) throw new Error('Owned port occupied by another listener');
      const logName = path.join(folder, 'activity.log');
      if (existsSync(logName)) {
        const stat = lstatSync(logName);
        if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('Unsafe owned log');
      }
      const log = openSync(logName, 'a', 0o600);
      let child;
      try {
        child = spawn(process.execPath, [SITE_SCRIPT, String(item.port), item.instance, item.id], {
          cwd: folder,
          detached: true,
          shell: false,
          env: { PATH: process.env.PATH ?? '', HOME: os.homedir() },
          stdio: ['ignore', log, log],
        });
      } finally {
        closeSync(log);
      }
      child.on('error', () => undefined);
      if (!child.pid) throw new Error('Owned site launch failed');
      let found: string | null = null;
      for (let i = 0; i < 30; i++) {
        found = ticks(child.pid);
        if (found) break;
        await wait(35);
      }
      if (!found) throw new Error('Unverified owned site spawn; manual recovery required');
      item.process = { pid: child.pid, ticks: found, startedAt: new Date().toISOString() };
      this.save(id, item);
      child.unref();
      for (let i = 0; i < 35; i++) {
        if (!owned(item, folder)) break;
        if (await this.health(id)) return this.inspect(id);
        await wait(120);
      }
      try {
        await this.stopInternal(id);
      } catch {
        /* Retain marker for investigation. */
      }
      throw new Error('Owned site readiness failed');
    });
  }
  async stop(id: string): Promise<FleetProject> {
    return this.lock(() => this.stopInternal(id));
  }
  private async stopInternal(id: string): Promise<FleetProject> {
    const item = this.record(id);
    if (!item.process) return this.inspect(id);
    const folder = this.site(id);
    if (!present(item.process.pid)) {
      if (!(await portFree(item.port))) throw new Error('Owned port still occupied: manual review');
      item.process = null;
      this.save(id, item);
      return this.inspect(id);
    }
    if (!owned(item, folder)) throw new Error('Unverified process: signal denied');
    process.kill(item.process.pid, 'SIGTERM');
    for (let i = 0; i < 45; i++) {
      if (!owned(item, folder) && (await portFree(item.port))) {
        item.process = null;
        this.save(id, item);
        return this.inspect(id);
      }
      await wait(100);
    }
    throw new Error('Graceful stop not verified; no forced kill');
  }
  async restart(id: string): Promise<FleetProject> {
    const current = this.inspect(id);
    if (current.state !== 'running')
      throw new RangeError('Only a verified running site can restart');
    await this.stop(id);
    return this.start(id);
  }
  logs(id: string): string[] {
    this.record(id);
    const filename = path.join(this.site(id), 'activity.log');
    if (!existsSync(filename)) return [];
    const stat = lstatSync(filename);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('Unsafe owned log');
    const fd = openSync(filename, 'r');
    try {
      const count = Math.min(fstatSync(fd).size, 8192);
      const buffer = Buffer.alloc(count);
      readSync(fd, buffer, 0, count, fstatSync(fd).size - count);
      return buffer
        .toString('utf8')
        .split('\n')
        .filter(Boolean)
        .slice(-25)
        .map((line) =>
          [...line]
            .filter((char) => {
              const code = char.charCodeAt(0);
              return code >= 32 && code !== 127;
            })
            .join('')
            .slice(0, 200),
        );
    } finally {
      closeSync(fd);
    }
  }
}
