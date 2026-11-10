import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import {
  lstatSync,
  mkdirSync,
  openSync,
  closeSync,
  readFileSync,
  readlinkSync,
  realpathSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { createServer } from 'node:net';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { NodeProjectHost } from './node-project-host.ts';
import { TermuxServiceAdmin } from './termux-service-admin.ts';
import { reviewNodeToolchain } from '../../shared/node-dependency-plan.ts';

const PREFIX = '/data/data/com.termux/files/usr';
const FIRST_PORT = 19300;
const PORT_COUNT = 32;
const ID = /^node-[a-f0-9]{32}$/;
const RELEASE = /^r-[a-f0-9]{32}$/;
const UNIT_MARKER = '.pockethost-node-unit.json';
const RUNTIME_MARKER = '.pockethost-node-runtime.json';
const MAX_HISTORY = 24;

type ProcessProof = { pid: number; ticks: string };
type RuntimeRecord = {
  schema: 1;
  owner: 'pockethost-node-runit';
  projectId: string;
  unit: string;
  port: number;
  desired: 'stopped' | 'running';
  activeRelease: string | null;
  lastGoodRelease: string | null;
  process: ProcessProof | null;
  readinessNonce: string;
  history: { at: string; action: 'start' | 'update' | 'stop' | 'failed' | 'rollback'; release: string }[];
};
type UnitRecord = {
  schema: 1;
  owner: 'pockethost-node-runit';
  projectId: string;
  unit: string;
  port: number;
  runDigest: string;
  readinessNonce: string;
};

function unitName(id: string): string {
  if (!ID.test(id)) throw new RangeError('Invalid owned Node identity');
  return 'pockethost-node-' + id.slice(5);
}
function checkedDirectory(folder: string): void {
  const s = lstatSync(folder);
  if (!s.isDirectory() || s.isSymbolicLink() || realpathSync(folder) !== folder ||
    s.uid !== process.getuid?.()) throw new Error('Untrusted Node runtime directory');
}
function privateText(filename: string, max = 16384): string {
  const s = lstatSync(filename);
  if (!s.isFile() || s.isSymbolicLink() || s.nlink !== 1 || s.uid !== process.getuid?.() ||
    (s.mode & 0o077) !== 0 || s.size > max) throw new Error('Untrusted Node runtime file');
  return readFileSync(filename, 'utf8');
}
function absent(name: string): boolean {
  try { lstatSync(name); return false; }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return true;
    throw error;
  }
}
function atomic(folder: string, name: string, content: string, mode = 0o600): void {
  checkedDirectory(folder);
  const target = path.join(folder, name);
  if (!absent(target)) privateText(target);
  const temp = path.join(folder, '.node-' + randomUUID());
  writeFileSync(temp, content, { flag: 'wx', mode });
  try { renameSync(temp, target); }
  finally { if (!absent(temp)) rmSync(temp); }
}
function quote(input: string): string {
  return "'" + input.replaceAll("'", "'\\''") + "'";
}
function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
function runScript(folder: string, port: number, readinessNonce: string): string {
  return '#!' + PREFIX + '/bin/sh\nset -eu\ncd ' + quote(folder) +
    '\nexport PORT=' + quote(String(port)) +
    '\nexport POCKETHOST_READINESS_NONCE=' + quote(readinessNonce) +
    '\nexec ' + quote(PREFIX + '/bin/node') + ' ' + quote(path.join(folder, 'server.mjs')) + '\n';
}
function observedTicks(pid: number): string | null {
  try {
    const raw = readFileSync('/proc/' + pid + '/stat', 'utf8');
    const ticks = raw.slice(raw.lastIndexOf(')') + 2).trim().split(/\s+/)[19];
    return ticks && /^\d+$/.test(ticks) ? ticks : null;
  } catch { return null; }
}
function pause(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 250));
}
function portFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const s = createServer();
    s.once('error', () => resolve(false));
    s.listen(port, '127.0.0.1', () => s.close(() => resolve(true)));
  });
}
function ready(port: number, nonce: string): Promise<boolean> {
  return new Promise((resolve) => {
    const request = http.get({
      hostname: '127.0.0.1', port, path: '/__pockethost/ready', timeout: 600,
      agent: false,
    }, (response) => {
      response.resume();
      resolve(response.statusCode === 200 && response.headers['x-pockethost-ready'] === nonce);
    });
    request.on('timeout', () => request.destroy());
    request.on('error', () => resolve(false));
  });
}
function stored(raw: string, id: string): RuntimeRecord {
  const v: unknown = JSON.parse(raw);
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error('Invalid Node runtime state');
  const s = v as RuntimeRecord;
  if (s.schema !== 1 || s.owner !== 'pockethost-node-runit' || s.projectId !== id ||
    s.unit !== unitName(id) || !Number.isSafeInteger(s.port) ||
    s.port < FIRST_PORT || s.port >= FIRST_PORT + PORT_COUNT ||
    !['running', 'stopped'].includes(s.desired) ||
    typeof s.readinessNonce !== 'string' ||
    !/^[a-f0-9]{48}$/.test(s.readinessNonce) ||
    (s.activeRelease !== null && !RELEASE.test(s.activeRelease)) ||
    (s.lastGoodRelease !== null && !RELEASE.test(s.lastGoodRelease)) ||
    (s.process !== null && (!Number.isSafeInteger(s.process.pid) || s.process.pid < 2 ||
      !/^\d+$/.test(s.process.ticks))) ||
    !Array.isArray(s.history) || s.history.length > MAX_HISTORY ||
    s.history.some((event) => !event || !RELEASE.test(event.release) ||
      !['start', 'update', 'stop', 'failed', 'rollback'].includes(event.action) ||
      !Number.isFinite(Date.parse(event.at)))) {
    throw new Error('Unsafe Node runtime record');
  }
  return s;
}

/**
 * M3 Node releases use the EXISTING Termux runit and registered service API.
 * A 'once' start cannot override a manual down marker or enable boot autostart.
 * Never touch a discovered service, even if its name looks like PocketHost.
 */
export class NodeRunitHost {
  private readonly projectRoot: string;
  private readonly serviceRoot: string;
  private readonly logRoot: string;
  private readonly projects: NodeProjectHost;
  private readonly admin: TermuxServiceAdmin;
  constructor(
    projectRoot = path.join(os.homedir(), 'PocketHost-NodeProjects'),
    serviceRoot = path.join(PREFIX, 'var', 'service'),
    logRoot = path.join(PREFIX, 'var', 'log', 'sv'),
  ) {
    this.projectRoot = projectRoot;
    this.serviceRoot = serviceRoot;
    this.logRoot = logRoot;
    this.projects = new NodeProjectHost(projectRoot);
    this.admin = new TermuxServiceAdmin(serviceRoot);
  }
  private context(id: string): { folder: string; unit: string; service: string } {
    const project = this.projects.inspect(id);
    if (project.id !== id) throw new Error('Node project mismatch');
    const folder = path.join(this.projectRoot, id);
    checkedDirectory(folder);
    return { folder, unit: unitName(id), service: path.join(this.serviceRoot, unitName(id)) };
  }
  private record(id: string): RuntimeRecord | null {
    const { folder, service } = this.context(id);
    const marker = path.join(folder, RUNTIME_MARKER);
    if (absent(marker)) {
      if (!absent(service)) throw new Error('Unregistered runit unit collision');
      return null;
    }
    const data = stored(privateText(marker), id);
    this.verifyUnit(id, data);
    return data;
  }
  private verifyUnit(id: string, record: RuntimeRecord): void {
    const { service, unit } = this.context(id);
    checkedDirectory(this.serviceRoot);
    checkedDirectory(service);
    const marker: unknown = JSON.parse(privateText(path.join(service, UNIT_MARKER)));
    if (!marker || typeof marker !== 'object' || Array.isArray(marker))
      throw new Error('Invalid unit provenance');
    const m = marker as UnitRecord;
    if (m.schema !== 1 || m.owner !== 'pockethost-node-runit' ||
      m.projectId !== id || m.unit !== unit || m.port !== record.port ||
      !/^[a-f0-9]{64}$/.test(m.runDigest) ||
      m.readinessNonce !== record.readinessNonce ||
      digest(privateText(path.join(service, 'run'))) !== m.runDigest)
      throw new Error('Node runit service identity changed');
    const down = path.join(service, 'down');
    if (absent(down)) throw new Error('Owned Node unit must remain manually disabled');
    privateText(down, 64);
    const listing = this.admin.list(() => 'unknown');
    if (!listing.some((entry) => entry.name === unit && entry.registered && !entry.protected))
      throw new Error('Node unit is not in verified runit registry');
  }
  private unitState(id: string): 'running' | 'down' | 'unknown' {
    const { service } = this.context(id);
    const result = spawnSync(PREFIX + '/bin/sv', ['status', service], {
      shell: false, encoding: 'utf8', timeout: 1500, maxBuffer: 2048,
    });
    if (result.error || result.status !== 0) return 'unknown';
    if (result.stdout.startsWith('down:')) return 'down';
    if (result.stdout.startsWith('run:')) return 'running';
    return 'unknown';
  }
  private observe(id: string, release: string): ProcessProof | 'down' | 'unknown' {
    const { service } = this.context(id);
    const running = this.unitState(id);
    if (running !== 'running') return running === 'down' ? 'down' : 'unknown';
    const result = spawnSync(PREFIX + '/bin/sv', ['status', service], {
      shell: false, encoding: 'utf8', timeout: 1500, maxBuffer: 2048,
    });
    if (result.error || result.status !== 0) return 'unknown';
    if (result.stdout.startsWith('down:')) return 'down';
    if (!result.stdout.startsWith('run:')) return 'unknown';
    const match = /\(pid (\d+)\)/.exec(result.stdout);
    if (!match) return 'unknown';
    const pid = Number(match[1]);
    const ticks = observedTicks(pid);
    if (!ticks) return 'unknown';
    try {
      const releaseFolder = this.projects.release(id, release).folder;
      const argv = readFileSync('/proc/' + pid + '/cmdline', 'utf8').split('\0');
      if (statSync('/proc/' + pid).uid !== process.getuid?.() ||
        readlinkSync('/proc/' + pid + '/cwd') !== releaseFolder ||
        !argv.includes(path.join(releaseFolder, 'server.mjs')) ||
        !argv.includes(PREFIX + '/bin/node')) return 'unknown';
    } catch { return 'unknown'; }
    return { pid, ticks };
  }
  private writeState(id: string, state: RuntimeRecord): void {
    const { folder } = this.context(id);
    atomic(folder, RUNTIME_MARKER, JSON.stringify(state) + '\n');
  }
  private script(id: string, release: string, port: number, nonce: string): void {
    const { service } = this.context(id);
    const folder = this.projects.release(id, release).folder;
    const source = runScript(folder, port, nonce);
    atomic(service, 'run', source, 0o700);
    atomic(service, UNIT_MARKER, JSON.stringify({
      schema: 1, owner: 'pockethost-node-runit', projectId: id,
      unit: unitName(id), port, runDigest: digest(source),
      readinessNonce: nonce,
    }) + '\n');
  }
  private history(state: RuntimeRecord, action: RuntimeRecord['history'][number]['action'],
    release: string): void {
    state.history.push({ at: new Date().toISOString(), action, release });
    if (state.history.length > MAX_HISTORY) state.history.shift();
  }
  preview(id: string): {
    release: string | null; port: number | null; missingTools: string[];
    conflicts: string[]; dependencyCount: number | null; allowed: boolean; reason: string;
  } {
    const project = this.projects.inspect(id);
    const state = this.record(id);
    const release = project.candidateRelease;
    if (!release) return { release: null, port: state?.port ?? null,
      missingTools: [], conflicts: [], dependencyCount: null, allowed: false,
      reason: 'stage-source-first' };
    const { plan } = this.projects.release(id, release);
    const node = spawnSync(PREFIX + '/bin/node', ['--version'], {
      encoding: 'utf8', shell: false, timeout: 1500, maxBuffer: 128,
    });
    const npm = spawnSync(PREFIX + '/bin/npm', ['--version'], {
      encoding: 'utf8', shell: false, timeout: 1500, maxBuffer: 128,
    });
    const tools = reviewNodeToolchain(plan, {
      node: node.status === 0 ? node.stdout.trim() : null,
      npm: npm.status === 0 ? npm.stdout.trim() : null,
    });
    const clean = plan.dependencyCount === 0 && plan.commands.build === null;
    return {
      release, port: state?.port ?? null, missingTools: tools.missingTools,
      conflicts: tools.conflicts, dependencyCount: plan.dependencyCount,
      allowed: tools.status !== 'blocked' && clean,
      reason: tools.status === 'blocked' ? 'missing-or-unsupported-toolchain' :
        clean ? 'ready-for-explicit-local-deploy' : 'dependencies-or-build-need-separate-approval',
    };
  }
  status(id: string): { state: 'not-provisioned' | 'stopped' | 'running' | 'unknown';
    port: number | null; activeRelease: string | null; lastGoodRelease: string | null;
    desired: 'stopped' | 'running'; history: RuntimeRecord['history'] } {
    const state = this.record(id);
    if (!state) return { state: 'not-provisioned', port: null,
      activeRelease: null, lastGoodRelease: null, desired: 'stopped', history: [] };
    const current = state.activeRelease
      ? this.observe(id, state.activeRelease)
      : this.unitState(id) === 'down' ? 'down' : 'unknown';
    const matches = current !== 'down' && current !== 'unknown' &&
      state.process?.pid === current.pid && state.process.ticks === current.ticks;
    return {
      state: current === 'down' ? 'stopped' : matches ? 'running' : 'unknown',
      port: state.port, activeRelease: state.activeRelease,
      lastGoodRelease: state.lastGoodRelease, desired: state.desired,
      history: state.history,
    };
  }
  /** New runit directories are discovered asynchronously by the installed service-daemon. */
  private async awaitSupervisor(id: string): Promise<void> {
    const { service } = this.context(id);
    for (let n = 0; n < 120; n++) {
      const status = spawnSync(PREFIX + '/bin/sv', ['status', service], {
        shell: false, encoding: 'utf8', timeout: 1500, maxBuffer: 2048,
      });
      if (status.status === 0 && /^(?:run|down): /.test(status.stdout)) return;
      await pause();
    }
    throw new Error('Existing Termux runit did not discover owned Node unit');
  }
  private async settle(id: string, release: string, port: number, nonce: string): Promise<ProcessProof> {
    for (let n = 0; n < 40; n++) {
      const proof = this.observe(id, release);
      if (proof !== 'down' && proof !== 'unknown' && await ready(port, nonce)) {
        const after = this.observe(id, release);
        if (after !== 'down' && after !== 'unknown' &&
          after.pid === proof.pid && after.ticks === proof.ticks) return proof;
      }
      await pause();
    }
    throw new Error('Node runtime failed exact-owner readiness');
  }
  private async halt(id: string, state: RuntimeRecord): Promise<void> {
    if (!state.activeRelease) {
      if (this.unitState(id) !== 'down') throw new Error('Unattributed runit process: stop refused');
      return;
    }
    const process = this.observe(id, state.activeRelease);
    if (process === 'unknown' || (process !== 'down' &&
      (!state.process || state.process.pid !== process.pid ||
        state.process.ticks !== process.ticks)))
      throw new Error('Unsafe runit owner identity: stop refused');
    const result = await this.admin.apply('stop', state.unit);
    if (result.result?.exit !== 0) throw new Error('Runit stop rejected');
    for (let i = 0; i < 40; i++) {
      if (this.observe(id, state.activeRelease) === 'down' &&
        await portFree(state.port)) return;
      await pause();
    }
    throw new Error('Owned Node process stop not verified');
  }
  private async initialize(id: string, port: number, release: string): Promise<RuntimeRecord> {
    checkedDirectory(this.serviceRoot);
    checkedDirectory(this.logRoot);
    const { service, unit } = this.context(id);
    if (!absent(service)) throw new Error('Existing service cannot be adopted');
    const log = path.join(this.logRoot, unit);
    if (!absent(log)) throw new Error('Existing log path cannot be adopted');
    mkdirSync(service, { mode: 0o700 });
    mkdirSync(path.join(service, 'log'), { mode: 0o700 });
    mkdirSync(log, { mode: 0o700 });
    writeFileSync(path.join(service, 'down'), '', { flag: 'wx', mode: 0o600 });
    writeFileSync(path.join(service, 'log', 'run'),
      '#!' + PREFIX + '/bin/sh\nexec ' + quote(PREFIX + '/bin/svlogd') +
      ' -tt ' + quote(log) + '\n', { flag: 'wx', mode: 0o700 });
    const nonce = randomBytes(24).toString('hex');
    this.script(id, release, port, nonce);
    const state: RuntimeRecord = { schema: 1, owner: 'pockethost-node-runit',
      projectId: id, unit, port, desired: 'stopped', activeRelease: null,
      lastGoodRelease: null, process: null, readinessNonce: nonce, history: [] };
    this.writeState(id, state);
    await this.admin.apply('register', unit);
    return state;
  }
  async deploy(id: string, release: string, approved: boolean): Promise<ReturnType<NodeRunitHost['status']>> {
    if (approved !== true) throw new Error('Explicit owned runtime approval required');
    const plan = this.preview(id);
    if (!plan.allowed || plan.release !== release || !RELEASE.test(release))
      throw new Error('Dependency/toolchain plan not authorized');
    const { folder } = this.context(id);
    const globalLock = path.join(this.projectRoot, '.node-ports.lock');
    const globalFd = openSync(globalLock, 'wx', 0o600);
    closeSync(globalFd);
    const lock = path.join(folder, '.node-runtime.lock');
    try {
      const fd = openSync(lock, 'wx', 0o600);
      closeSync(fd);
    } catch (error) {
      rmSync(globalLock, { force: true });
      throw error;
    }
    try {
      let state = this.record(id);
      if (!state) {
        const reservations = new Set<number>();
        for (const otherProject of this.projects.list()) {
          if (otherProject.id === id) continue;
          const other = this.record(otherProject.id);
          if (other) reservations.add(other.port);
        }
        for (let port = FIRST_PORT; port < FIRST_PORT + PORT_COUNT; port++) {
          if (!reservations.has(port) && await portFree(port)) {
            state = await this.initialize(id, port, release);
            break;
          }
        }
        if (!state) throw new Error('No unreserved loopback Node port');
      }
      if (state.activeRelease) await this.halt(id, state);
      else if (!await portFree(state.port)) throw new Error('Owned port not free');
      await this.awaitSupervisor(id);
      const prior = state.lastGoodRelease;
      const nonce = randomBytes(24).toString('hex');
      this.script(id, release, state.port, nonce);
      state.readinessNonce = nonce;
      try {
        const result = await this.admin.apply('once', state.unit);
        if (result.result?.exit !== 0) throw new Error('Runit one-shot start rejected');
        const proof = await this.settle(id, release, state.port, nonce);
        state.activeRelease = release;
        state.lastGoodRelease = release;
        state.process = proof;
        state.desired = 'running';
        this.history(state, prior ? 'update' : 'start', release);
        this.writeState(id, state);
      } catch (error) {
        this.history(state, 'failed', release);
        state.desired = 'stopped';
        state.process = null;
        state.activeRelease = null;
        this.writeState(id, state);
        // Do not signal an unknown process; retain evidence and refuse adoption.
        const observed = this.observe(id, release, state.port);
        if (observed !== 'down') {
          if (observed === 'unknown') throw new Error('Failed start identity unknown; manual review required');
          const result = await this.admin.apply('stop', state.unit);
          if (result.result?.exit !== 0) throw new Error('Failed start cleanup refused');
        }
        if (prior) {
          for (let n = 0; n < 40 && !await portFree(state.port); n++) await pause();
          if (!await portFree(state.port)) throw new Error('Failed release still occupies port');
          const restoreNonce = randomBytes(24).toString('hex');
          this.script(id, prior, state.port, restoreNonce);
          state.readinessNonce = restoreNonce;
          const result = await this.admin.apply('once', state.unit);
          if (result.result?.exit !== 0) throw new Error('Rollback start refused');
          const proof = await this.settle(id, prior, state.port, restoreNonce);
          state.activeRelease = prior;
          state.lastGoodRelease = prior;
          state.process = proof;
          state.desired = 'running';
          this.history(state, 'rollback', prior);
          this.writeState(id, state);
        }
        throw error;
      }
      return this.status(id);
    } finally {
      rmSync(lock, { force: true });
      rmSync(globalLock, { force: true });
    }
  }
  async stop(id: string, approved: boolean): Promise<ReturnType<NodeRunitHost['status']>> {
    if (approved !== true) throw new Error('Explicit owned stop required');
    const { folder } = this.context(id);
    const lock = path.join(folder, '.node-runtime.lock');
    const fd = openSync(lock, 'wx', 0o600);
    closeSync(fd);
    try {
      const state = this.record(id);
      if (!state) throw new Error('No owned Node unit to stop');
      await this.halt(id, state);
      state.process = null;
      state.desired = 'stopped';
      if (state.activeRelease) this.history(state, 'stop', state.activeRelease);
      this.writeState(id, state);
      return this.status(id);
    } finally { rmSync(lock, { force: true }); }
  }
  logs(id: string): { lines: string[] } {
    const state = this.record(id);
    if (!state) return { lines: [] };
    return this.admin.logs(state.unit);
  }
}
