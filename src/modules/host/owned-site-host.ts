import { spawn } from 'node:child_process';
import {
  closeSync,
  copyFileSync,
  existsSync,
  fstatSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  readSync,
  readlinkSync,
  realpathSync,
  renameSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:net';
import {
  OWNED_DEMO_ID,
  type DemoVersion,
  type OwnedDemoDeployment,
  type OwnedDemoProject,
  type OwnedSitePort,
  type OwnedSiteSnapshot,
} from '../../shared/owned-site.ts';

/**
 * Fixed, private, developer-only single-site adapter.
 * It never lists or operates on discovered processes and never accepts a path,
 * port, PID or shell command from an HTTP request.
 */
const PORT = 18787;
const SERVER_SCRIPT = path.resolve(import.meta.dirname, 'owned-site-server.mjs');
const MARKER_FILE = '.pockethost-owner.json';
const MAX_LOG_BYTES = 8192;

interface Marker {
  schema: 1;
  id: typeof OWNED_DEMO_ID;
  ownership: 'pockethost';
  instance: string;
  port: number;
  contentVersion: DemoVersion;
  previousVersion: DemoVersion | null;
  process: { pid: number; startTicks: string } | null;
  history?: OwnedDemoDeployment[];
}

function verifyPlainDirectory(folder: string): void {
  const stat = lstatSync(folder);
  if (!stat.isDirectory() || stat.isSymbolicLink() || realpathSync(folder) !== folder) {
    throw new Error('Refusing a noncanonical or linked PocketHost directory');
  }
}

function writeAtomic(folder: string, name: string, contents: string): void {
  const temp = path.join(folder, `.${randomUUID()}.tmp`);
  writeFileSync(temp, contents, { mode: 0o600, flag: 'wx' });
  renameSync(temp, path.join(folder, name));
}

function startTicks(pid: number): string | null {
  if (!Number.isSafeInteger(pid) || pid < 2) return null;
  try {
    const raw = readFileSync(`/proc/${pid}/stat`, 'utf8');
    const fields = raw
      .slice(raw.lastIndexOf(')') + 2)
      .trim()
      .split(/\s+/);
    const ticks = fields[19];
    return ticks && /^\d+$/.test(ticks) ? ticks : null;
  } catch {
    return null;
  }
}

function processPresent(pid: number): boolean {
  return existsSync(`/proc/${pid}/stat`);
}

function processIsOwned(marker: Marker, site: string): boolean {
  const p = marker.process;
  if (!p || startTicks(p.pid) !== p.startTicks) return false;
  try {
    const cwd = readlinkSync(`/proc/${p.pid}/cwd`);
    const argv = readFileSync(`/proc/${p.pid}/cmdline`, 'utf8');
    return (
      cwd === site &&
      argv.includes(SERVER_SCRIPT) &&
      argv.includes(marker.instance) &&
      argv.includes(String(marker.port))
    );
  } catch {
    return false;
  }
}

async function availablePort(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = createServer();
    socket.once('error', () => resolve(false));
    socket.listen(port, '127.0.0.1', () => socket.close(() => resolve(true)));
  });
}

function staticDocument(version: DemoVersion): string {
  const label = version === 1 ? 'First local site' : 'Updated local site';
  return [
    '<!doctype html><html lang="en"><head><meta charset="UTF-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<title>PocketHost test site</title></head><body>',
    '<main style="font-family:system-ui;max-width:55ch;margin:15vh auto;padding:1rem">',
    `<h1>${label}</h1><p>PocketHost managed demo · v${version} · loopback only.</p></main>`,
    '</body></html>',
  ].join('\n');
}

export class OwnedDemoHost implements OwnedSitePort {
  private readonly root: string;
  private readonly site: string;
  private readonly port: number;
  private lifecycleQueue: Promise<void> = Promise.resolve();

  constructor(root?: string, port = PORT) {
    const home = realpathSync(os.homedir());
    const parent = path.join(home, 'Projects');
    // Runtime may set a fixture directory only through code, never through HTTP.
    this.root = root ?? path.join(parent, 'PocketHost-OwnedSites');
    this.site = path.join(this.root, OWNED_DEMO_ID);
    if (!Number.isSafeInteger(port) || port < 1024 || port > 65535) {
      throw new RangeError('Invalid dedicated demo port');
    }
    this.port = port;
  }

  private enqueueLifecycle(action: () => Promise<OwnedSiteSnapshot>): Promise<OwnedSiteSnapshot> {
    const result = this.lifecycleQueue.then(action, action);
    this.lifecycleQueue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  private markerPath(): string {
    return path.join(this.site, MARKER_FILE);
  }

  private read(): Marker | null {
    if (!existsSync(this.site)) return null;
    verifyPlainDirectory(this.root);
    verifyPlainDirectory(this.site);
    const file = this.markerPath();
    if (!existsSync(file)) throw new Error('Existing directory is not PocketHost-owned');
    const stat = lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('Invalid ownership marker');
    const data: unknown = JSON.parse(readFileSync(file, 'utf8'));
    if (!data || typeof data !== 'object') throw new Error('Invalid ownership record');
    const item = data as Marker;
    if (
      item.schema !== 1 ||
      item.id !== OWNED_DEMO_ID ||
      item.ownership !== 'pockethost' ||
      item.port !== this.port ||
      !/^[0-9a-f-]{36}$/.test(item.instance) ||
      (item.contentVersion !== 1 && item.contentVersion !== 2) ||
      (item.previousVersion !== null && item.previousVersion !== 1 && item.previousVersion !== 2) ||
      (item.process !== null &&
        (!item.process ||
          !Number.isSafeInteger(item.process.pid) ||
          item.process.pid < 2 ||
          typeof item.process.startTicks !== 'string' ||
          !/^\d+$/.test(item.process.startTicks)))
      ||
      (item.history !== undefined &&
        (!Array.isArray(item.history) ||
          item.history.length > 32 ||
          item.history.some(
            (event) =>
              !event ||
              typeof event.at !== 'string' ||
              event.at.length > 40 ||
              !['create', 'publish', 'rollback'].includes(event.action) ||
              (event.from !== null && event.from !== 1 && event.from !== 2) ||
              (event.to !== 1 && event.to !== 2),
          )))
    ) {
      throw new Error('Ownership record failed validation');
    }
    return item;
  }

  private mustRead(): Marker {
    const item = this.read();
    if (!item) throw new Error('Create a PocketHost-owned test site first');
    return item;
  }

  private save(item: Marker): void {
    writeAtomic(this.site, MARKER_FILE, JSON.stringify(item) + '\n');
  }

  private addDeployment(
    item: Marker,
    action: OwnedDemoDeployment['action'],
    from: DemoVersion | null,
    to: DemoVersion,
  ): void {
    item.history = [
      ...(item.history ?? []).slice(-31),
      { at: new Date().toISOString(), action, from, to },
    ];
  }

  /** Read metadata only from the exact owner's private marker, not inventory. */
  inspectProject(): OwnedDemoProject {
    const marker = this.read();
    const state = marker ? this.status(marker) : 'absent';
    const verified = marker !== null && state === 'running' && processIsOwned(marker, this.site);
    return {
      id: OWNED_DEMO_ID,
      name: 'PocketHost Demo',
      description: 'Isolated, manually operated two-release HTML test application',
      type: 'static-html',
      dataDirectory: 'PocketHost-OwnedSites/pockethost-demo',
      state,
      port: this.port,
      url: `http://127.0.0.1:${this.port}/`,
      contentVersion: marker?.contentVersion ?? null,
      previousVersion: marker?.previousVersion ?? null,
      pid: verified ? marker.process!.pid : null,
      startTicks: verified ? marker.process!.startTicks : null,
      history: (marker?.history ?? []).slice(-25).reverse(),
    };
  }

  private status(item: Marker): OwnedSiteSnapshot['state'] {
    if (!item.process) return 'stopped';
    if (processIsOwned(item, this.site)) return 'running';
    return processPresent(item.process.pid) ? 'unknown' : 'stopped';
  }

  inspect(): OwnedSiteSnapshot {
    const item = this.read();
    return {
      version: 1,
      id: OWNED_DEMO_ID,
      ownership: item ? 'pockethost' : 'none',
      state: item ? this.status(item) : 'absent',
      port: this.port,
      url: `http://127.0.0.1:${this.port}/`,
      contentVersion: item?.contentVersion ?? null,
      previousVersion: item?.previousVersion ?? null,
      canRollback: item?.previousVersion !== null && item?.previousVersion !== undefined,
    };
  }

  create(): OwnedSiteSnapshot {
    if (this.read()) return this.inspect();
    const parent = path.dirname(this.root);
    verifyPlainDirectory(parent);
    if (!existsSync(this.root)) mkdirSync(this.root, { mode: 0o700 });
    verifyPlainDirectory(this.root);
    mkdirSync(this.site, { mode: 0o700 });
    verifyPlainDirectory(this.site);
    writeFileSync(path.join(this.site, 'index-v1.html'), staticDocument(1), {
      mode: 0o600,
      flag: 'wx',
    });
    copyFileSync(path.join(this.site, 'index-v1.html'), path.join(this.site, 'index.html'));
    this.save({
      schema: 1,
      id: OWNED_DEMO_ID,
      ownership: 'pockethost',
      instance: randomUUID(),
      port: this.port,
      contentVersion: 1,
      previousVersion: null,
      process: null,
      history: [{ at: new Date().toISOString(), action: 'create', from: null, to: 1 }],
    });
    return this.inspect();
  }

  start(): Promise<OwnedSiteSnapshot> {
    return this.enqueueLifecycle(() => this.startInternal());
  }

  private async startInternal(): Promise<OwnedSiteSnapshot> {
    const item = this.mustRead();
    if (this.status(item) === 'running') return this.inspect();
    if (item.process && processPresent(item.process.pid)) {
      throw new Error('Unverified process identity: fail closed without stopping anything');
    }
    if (!(await availablePort(item.port))) throw new Error('Dedicated demo port already occupied');

    const log = openSync(path.join(this.site, 'activity.log'), 'a', 0o600);
    let child;
    try {
      child = spawn(process.execPath, [SERVER_SCRIPT, String(item.port), item.instance], {
        cwd: this.site,
        shell: false,
        detached: true,
        env: { PATH: process.env.PATH ?? '', HOME: os.homedir() },
        stdio: ['ignore', log, log],
      });
    } finally {
      closeSync(log);
    }
    child.on('error', () => {
      // Report startup failure to the caller without crashing the admin process.
    });
    if (!child.pid) throw new Error('Failed to start owned test site');

    let ticks: string | null = null;
    for (let i = 0; i < 30; i++) {
      ticks = startTicks(child.pid);
      if (ticks) break;
      await new Promise((resolve) => setTimeout(resolve, 35));
    }
    if (!ticks) throw new Error('Cannot verify new child process start time');
    item.process = { pid: child.pid, startTicks: ticks };
    this.save(item);
    child.unref();

    for (let i = 0; i < 30; i++) {
      if (!processIsOwned(item, this.site)) break;
      try {
        const response = await fetch(`http://127.0.0.1:${item.port}/`, {
          signal: AbortSignal.timeout(500),
        });
        if (response.ok && response.headers.get('x-pockethost-instance') === item.instance) {
          return this.inspect();
        }
      } catch {
        // Child is starting, or the port is not ready yet.
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    // No failed readiness check may leave an untracked owned process.
    try {
      await this.stopInternal();
    } catch {
      // Keep the marker for explicit diagnosis if safe cleanup is unavailable.
    }
    throw new Error('Owned test site did not pass the ready check');
  }

  stop(): Promise<OwnedSiteSnapshot> {
    return this.enqueueLifecycle(() => this.stopInternal());
  }

  private async stopInternal(): Promise<OwnedSiteSnapshot> {
    const item = this.mustRead();
    if (!item.process) return this.inspect();
    if (!processPresent(item.process.pid)) {
      item.process = null;
      this.save(item);
      return this.inspect();
    }
    if (!processIsOwned(item, this.site)) {
      throw new Error('Unverified process identity: stop denied');
    }
    // Kill only the exact verified PocketHost child; never kill a process group.
    process.kill(item.process.pid, 'SIGTERM');
    for (let i = 0; i < 35; i++) {
      if (!processIsOwned(item, this.site)) {
        item.process = null;
        this.save(item);
        return this.inspect();
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error('Graceful stop timed out; no forced termination attempted');
  }

  publish(target: DemoVersion): OwnedSiteSnapshot {
    const item = this.mustRead();
    if (this.status(item) === 'unknown') throw new Error('Unverified process identity');
    if (target !== 1 && target !== 2) throw new RangeError('Unsupported demo version');
    // A repeated publish of the current version must not create another undo point.
    if (target === item.contentVersion) return this.inspect();
    const archive = path.join(this.site, `index-v${target}.html`);
    if (!existsSync(archive)) {
      writeFileSync(archive, staticDocument(target), { flag: 'wx', mode: 0o600 });
    }
    writeAtomic(this.site, 'index.html', readFileSync(archive, 'utf8'));
    this.addDeployment(item, 'publish', item.contentVersion, target);
    item.previousVersion = item.contentVersion;
    item.contentVersion = target;
    this.save(item);
    return this.inspect();
  }

  rollback(): OwnedSiteSnapshot {
    const item = this.mustRead();
    if (this.status(item) === 'unknown') throw new Error('Unverified process identity');
    if (item.previousVersion === null) throw new RangeError('No prior demo version');
    const archive = path.join(this.site, `index-v${item.previousVersion}.html`);
    const html = readFileSync(archive, 'utf8');
    writeAtomic(this.site, 'index.html', html);
    this.addDeployment(item, 'rollback', item.contentVersion, item.previousVersion);
    item.contentVersion = item.previousVersion;
    // Consume the one-step undo. A second rollback must not redeploy the superseded release.
    item.previousVersion = null;
    this.save(item);
    return this.inspect();
  }

  async health(): Promise<boolean> {
    const item = this.read();
    if (!item || this.status(item) !== 'running' || !processIsOwned(item, this.site)) {
      return false;
    }
    try {
      const response = await fetch(`http://127.0.0.1:${this.port}/`, {
        signal: AbortSignal.timeout(1500),
      });
      return response.status === 200 && response.headers.get('x-pockethost-instance') === item.instance;
    } catch {
      return false;
    }
  }

  readLogs(): ReadonlyArray<string> {
    this.mustRead();
    const log = path.join(this.site, 'activity.log');
    if (!existsSync(log)) return [];
    const stat = lstatSync(log);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('Unsafe log location');
    const fd = openSync(log, 'r');
    let text = '';
    try {
      const size = fstatSync(fd).size;
      const count = Math.min(size, MAX_LOG_BYTES);
      const buffer = Buffer.alloc(count);
      readSync(fd, buffer, 0, count, size - count);
      text = buffer.toString('utf8');
    } finally {
      closeSync(fd);
    }
    return text
      .split('\n')
      .filter(Boolean)
      .slice(-25)
      .map((line) => line.slice(0, 200));
  }
}
