import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import {
  constants,
  fstatSync,
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
import { NodeDependencyPreparer } from './node-dependency-preparer.ts';
import { NodeBuildPreparer } from './node-build-preparer.ts';
import { TermuxServiceAdmin } from './termux-service-admin.ts';
import {
  reviewNodeToolchain,
  SAFE_NPM_CI_COMMAND,
  SAFE_NPM_BUILD_CI_COMMAND,
  type NodeDependencyPlan,
} from '../../shared/node-dependency-plan.ts';
import { evaluateHealthPolicy, type HealthDecision } from '../../shared/hosting-health-policy.ts';
import {
  nodeHostingUnitName as unitName,
  projectNodeHostingDeclarations,
} from '../../shared/node-hosting-projection.ts';
import { createHostingRegistries } from '../../shared/hosting-registry.ts';

const PREFIX = '/data/data/com.termux/files/usr';
const FIRST_PORT = 19300;
const PORT_COUNT = 32;
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
  previousGoodRelease?: string | null;
  process: ProcessProof | null;
  readinessNonce: string;
  history: {
    at: string;
    action: 'start' | 'update' | 'stop' | 'failed' | 'rollback';
    release: string;
  }[];
};
type UnitRecord = {
  schema: 1;
  owner: 'pockethost-node-runit';
  projectId: string;
  unit: string;
  port: number;
  runDigest: string;
  logDigest: string;
  readinessNonce: string;
};

function checkedDirectory(folder: string): void {
  const s = lstatSync(folder);
  if (
    !s.isDirectory() ||
    s.isSymbolicLink() ||
    realpathSync(folder) !== folder ||
    s.uid !== process.getuid?.()
  )
    throw new Error('Untrusted Node runtime directory');
}
function privateText(filename: string, max = 16384): string {
  const s = lstatSync(filename);
  if (
    !s.isFile() ||
    s.isSymbolicLink() ||
    s.nlink !== 1 ||
    s.uid !== process.getuid?.() ||
    (s.mode & 0o077) !== 0 ||
    s.size > max
  )
    throw new Error('Untrusted Node runtime file');
  const fd = openSync(filename, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const current = fstatSync(fd);
    if (
      !current.isFile() ||
      current.nlink !== 1 ||
      current.ino !== s.ino ||
      current.dev !== s.dev ||
      current.uid !== s.uid ||
      (current.mode & 0o077) !== 0 ||
      current.size > max
    )
      throw new Error('Node runtime file changed during verification');
    return readFileSync(fd, 'utf8');
  } finally {
    closeSync(fd);
  }
}
function absent(name: string): boolean {
  try {
    lstatSync(name);
    return false;
  } catch (error) {
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
  try {
    renameSync(temp, target);
  } finally {
    if (!absent(temp)) rmSync(temp);
  }
}
function quote(input: string): string {
  return "'" + input.replaceAll("'", "'\\''") + "'";
}
function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
function nodeLogRun(logFolder: string): string {
  return (
    '#!' +
    PREFIX +
    '/bin/sh\nexec ' +
    quote(PREFIX + '/bin/svlogd') +
    ' -tt ' +
    quote(logFolder) +
    '\n'
  );
}
/** A clean env blocks accidental inheritance of PocketHost admin credentials. */
export function runScript(folder: string, port: number, readinessNonce: string): string {
  if (
    !path.isAbsolute(folder) ||
    !Number.isSafeInteger(port) ||
    port < FIRST_PORT ||
    port >= FIRST_PORT + PORT_COUNT ||
    !/^[a-f0-9]{48}$/.test(readinessNonce)
  ) {
    throw new RangeError('Invalid owned Node process launch');
  }
  return (
    '#!' +
    PREFIX +
    '/bin/sh\nset -eu\ncd ' +
    quote(folder) +
    '\nexec ' +
    quote(PREFIX + '/bin/env') +
    ' -i' +
    ' PATH=' +
    quote(PREFIX + '/bin') +
    ' HOME=' +
    quote(folder) +
    ' TMPDIR=' +
    quote(PREFIX + '/tmp') +
    ' NODE_ENV=' +
    quote('production') +
    ' PORT=' +
    quote(String(port)) +
    ' POCKETHOST_READINESS_NONCE=' +
    quote(readinessNonce) +
    ' ' +
    quote(PREFIX + '/bin/node') +
    ' ' +
    quote(path.join(folder, 'server.mjs')) +
    '\n'
  );
}
function observedTicks(pid: number): string | null {
  try {
    const raw = readFileSync('/proc/' + pid + '/stat', 'utf8');
    const ticks = raw
      .slice(raw.lastIndexOf(')') + 2)
      .trim()
      .split(/\s+/)[19];
    return ticks && /^\d+$/.test(ticks) ? ticks : null;
  } catch {
    return null;
  }
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
/** Reserve only currently unused, unregistered loopback ports in the fixed Node pool. */
export async function selectUnreservedNodePort(
  reserved: ReadonlySet<number>,
  free: (port: number) => Promise<boolean>,
): Promise<number> {
  for (let port = FIRST_PORT; port < FIRST_PORT + PORT_COUNT; port++) {
    if (!reserved.has(port) && (await free(port))) return port;
  }
  throw new Error('No unreserved loopback Node port');
}
/** Fixed loopback-only readiness probe; a foreign HTTP 200 never attests the release. */
export function probeOwnedNodeReadiness(port: number, nonce: string): Promise<boolean> {
  if (!Number.isSafeInteger(port) || port < 1024 || port > 65535 || !/^[a-f0-9]{48}$/.test(nonce))
    throw new RangeError('Unsafe Node readiness probe');
  return new Promise((resolve) => {
    const request = http.get(
      {
        hostname: '127.0.0.1',
        port,
        path: '/__pockethost/ready',
        timeout: 600,
        agent: false,
      },
      (response) => {
        response.resume();
        resolve(response.statusCode === 200 && response.headers['x-pockethost-ready'] === nonce);
      },
    );
    request.on('timeout', () => request.destroy());
    request.on('error', () => resolve(false));
  });
}
/** Bounded local HTTP observation. Never forwards admin headers or exposes HTML execution. */
export function readBoundedNodePreview(port: number): Promise<string> {
  if (!Number.isSafeInteger(port) || port < 1024 || port > 65535)
    throw new RangeError('Invalid local preview port');
  return new Promise((resolve, reject) => {
    const request = http.get(
      {
        hostname: '127.0.0.1',
        port,
        path: '/',
        agent: false,
        timeout: 1500,
        signal: AbortSignal.timeout(3000),
        headers: { accept: 'text/plain, text/html' },
      },
      (response) => {
        if (response.statusCode !== 200) {
          response.destroy();
          reject(new Error('Node preview returned non-success status'));
          return;
        }
        const chunks: Buffer[] = [];
        let total = 0;
        response.on('data', (part: Buffer | string) => {
          const bytes = Buffer.isBuffer(part) ? part : Buffer.from(part);
          total += bytes.length;
          if (total > 8192) {
            request.destroy(new Error('Node preview response exceeds safe budget'));
            return;
          }
          chunks.push(bytes);
        });
        response.once('end', () => {
          const clean = Buffer.concat(chunks)
            .toString('utf8')
            .split('')
            .filter((character) => {
              const code = character.charCodeAt(0);
              return (code > 31 && code !== 127) || code === 9 || code === 10;
            })
            .join('');
          resolve(clean);
        });
        response.once('error', reject);
      },
    );
    request.once('timeout', () => request.destroy(new Error('Node preview timeout')));
    request.once('error', reject);
  });
}
function stored(raw: string, id: string): RuntimeRecord {
  const v: unknown = JSON.parse(raw);
  if (!v || typeof v !== 'object' || Array.isArray(v))
    throw new Error('Invalid Node runtime state');
  const s = v as RuntimeRecord;
  if (
    s.schema !== 1 ||
    s.owner !== 'pockethost-node-runit' ||
    s.projectId !== id ||
    s.unit !== unitName(id) ||
    !Number.isSafeInteger(s.port) ||
    s.port < FIRST_PORT ||
    s.port >= FIRST_PORT + PORT_COUNT ||
    !['running', 'stopped'].includes(s.desired) ||
    typeof s.readinessNonce !== 'string' ||
    !/^[a-f0-9]{48}$/.test(s.readinessNonce) ||
    (s.activeRelease !== null && !RELEASE.test(s.activeRelease)) ||
    (s.lastGoodRelease !== null && !RELEASE.test(s.lastGoodRelease)) ||
    (s.previousGoodRelease !== undefined &&
      s.previousGoodRelease !== null &&
      !RELEASE.test(s.previousGoodRelease)) ||
    (s.process !== null &&
      (!Number.isSafeInteger(s.process.pid) ||
        s.process.pid < 2 ||
        !/^\d+$/.test(s.process.ticks))) ||
    !Array.isArray(s.history) ||
    s.history.length > MAX_HISTORY ||
    s.history.some(
      (event) =>
        !event ||
        !RELEASE.test(event.release) ||
        !['start', 'update', 'stop', 'failed', 'rollback'].includes(event.action) ||
        !Number.isFinite(Date.parse(event.at)),
    )
  ) {
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
    if (
      m.schema !== 1 ||
      m.owner !== 'pockethost-node-runit' ||
      m.projectId !== id ||
      m.unit !== unit ||
      m.port !== record.port ||
      !/^[a-f0-9]{64}$/.test(m.runDigest) ||
      m.readinessNonce !== record.readinessNonce ||
      digest(privateText(path.join(service, 'run'))) !== m.runDigest
    )
      throw new Error('Node runit service identity changed');
    const down = path.join(service, 'down');
    if (absent(down)) throw new Error('Owned Node unit must remain manually disabled');
    privateText(down, 64);
    checkedDirectory(path.join(service, 'log'));
    checkedDirectory(this.logRoot);
    checkedDirectory(path.join(this.logRoot, unit));
    const logSource = privateText(path.join(service, 'log', 'run'));
    if (
      !/^[a-f0-9]{64}$/.test(m.logDigest) ||
      m.logDigest !== digest(nodeLogRun(path.join(this.logRoot, unit))) ||
      digest(logSource) !== m.logDigest
    )
      throw new Error('Owned Node log supervisor identity changed');
    if (!this.admin.isRegistered(unit))
      throw new Error('Node unit is not in verified runit registry');
  }
  private unitState(id: string): 'running' | 'down' | 'unknown' {
    const { service } = this.context(id);
    const result = spawnSync(PREFIX + '/bin/sv', ['status', service], {
      shell: false,
      encoding: 'utf8',
      timeout: 1500,
      maxBuffer: 2048,
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
      shell: false,
      encoding: 'utf8',
      timeout: 1500,
      maxBuffer: 2048,
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
      if (
        statSync('/proc/' + pid).uid !== process.getuid?.() ||
        readlinkSync('/proc/' + pid + '/cwd') !== releaseFolder ||
        !argv.includes(path.join(releaseFolder, 'server.mjs')) ||
        !argv.includes(PREFIX + '/bin/node')
      )
        return 'unknown';
    } catch {
      return 'unknown';
    }
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
    const logSource = nodeLogRun(path.join(this.logRoot, unitName(id)));
    if (privateText(path.join(service, 'log', 'run')) !== logSource)
      throw new Error('Owned Node log run script differs from fixed specification');
    atomic(service, 'run', source, 0o700);
    atomic(
      service,
      UNIT_MARKER,
      JSON.stringify({
        schema: 1,
        owner: 'pockethost-node-runit',
        projectId: id,
        unit: unitName(id),
        port,
        runDigest: digest(source),
        logDigest: digest(logSource),
        readinessNonce: nonce,
      }) + '\n',
    );
  }
  private history(
    state: RuntimeRecord,
    action: RuntimeRecord['history'][number]['action'],
    release: string,
  ): void {
    state.history.push({ at: new Date().toISOString(), action, release });
    if (state.history.length > MAX_HISTORY) state.history.shift();
  }
  /** Read-only, bounded fixed-binary probes. No package install or service actions. */
  toolVersions(): { nodeVersion: string | null; npmVersion: string | null } {
    const node = spawnSync(PREFIX + '/bin/node', ['--version'], {
      encoding: 'utf8',
      shell: false,
      timeout: 1500,
      maxBuffer: 128,
    });
    const npm = spawnSync(PREFIX + '/bin/npm', ['--version'], {
      encoding: 'utf8',
      shell: false,
      timeout: 1500,
      maxBuffer: 128,
    });
    return {
      nodeVersion: node.status === 0 ? node.stdout.trim() : null,
      npmVersion: npm.status === 0 ? npm.stdout.trim() : null,
    };
  }
  private toolchain(plan: NodeDependencyPlan): {
    nodeVersion: string | null;
    npmVersion: string | null;
    status: 'blocked' | 'review-required';
    missingTools: string[];
    conflicts: string[];
  } {
    const { nodeVersion, npmVersion } = this.toolVersions();
    const tools = reviewNodeToolchain(plan, { node: nodeVersion, npm: npmVersion });
    return {
      nodeVersion,
      npmVersion,
      status: tools.status,
      missingTools: tools.missingTools,
      conflicts: tools.conflicts,
    };
  }
  /** Re-attest all installed bytes before any owned release activation. */
  private packagesReady(id: string, release: string, plan: NodeDependencyPlan): boolean {
    if (plan.dependencyCount === 0) return true;
    try {
      new NodeDependencyPreparer(this.projects, this.projectRoot, () => true)
        .verifyPrepared(id, release);
      return true;
    } catch {
      return false;
    }
  }
  private dependenciesReady(id: string, release: string, plan: NodeDependencyPlan): boolean {
    if (!this.packagesReady(id, release, plan)) return false;
    if (plan.commands.build === null) return true;
    try {
      new NodeBuildPreparer(this.projects, this.projectRoot, () => true)
        .verifyBuilt(id, release);
      return true;
    } catch {
      return false;
    }
  }
  preview(id: string): {
    release: string | null;
    port: number | null;
    missingTools: string[];
    nodeVersion: string | null;
    npmVersion: string | null;
    conflicts: string[];
    dependencyCount: number | null;
    allowed: boolean;
    dependencyIssues: string[];
    reason: string;
  } {
    const project = this.projects.inspect(id);
    const state = this.record(id);
    const release = project.candidateRelease;
    if (!release)
      return {
        release: null,
        port: state?.port ?? null,
        missingTools: [],
        conflicts: [],
        dependencyIssues: [],
        nodeVersion: null,
        npmVersion: null,
        dependencyCount: null,
        allowed: false,
        reason: 'stage-source-first',
      };
    const candidate = this.projects.candidates(id).find((entry) => entry.id === release);
    if (!candidate) throw new Error('Unknown Node candidate');
    const { dependencyPlan: plan, sourceIntegrity } = candidate;
    if (sourceIntegrity !== 'verified') {
      return {
        release,
        port: state?.port ?? null,
        nodeVersion: null,
        npmVersion: null,
        missingTools: [],
        conflicts: [],
        dependencyIssues: [],
        dependencyCount: plan.dependencyCount,
        allowed: false,
        reason: 'source-must-be-re-staged',
      };
    }
    const tools = this.toolchain(plan);
    const { nodeVersion, npmVersion } = tools;
    const clean = this.dependenciesReady(id, release, plan);
    const dependencyIssues = [
      ...plan.lockReview.missingDirectEntries.map((name) => 'missing-lock:' + name),
      ...plan.lockReview.unreviewedSources.map((name) => 'source-review:' + name),
      ...plan.lockReview.installScripts.map((name) => 'install-script:' + name),
    ];
    return {
      release,
      port: state?.port ?? null,
      missingTools: tools.missingTools,
      nodeVersion,
      npmVersion,
      conflicts: tools.conflicts,
      dependencyIssues,
      dependencyCount: plan.dependencyCount,
      allowed: tools.status !== 'blocked' && clean,
      reason:
        tools.status === 'blocked'
          ? 'missing-or-unsupported-toolchain'
          : clean
            ? 'ready-for-explicit-local-deploy'
            : plan.commands.build !== null && this.packagesReady(id, release, plan)
              ? 'build-artifact-not-verified'
              : 'dependencies-or-build-need-separate-approval',
    };
  }
  /** Review immutable candidate dependencies without npm, network or service writes. */
  reviewDependencySetup(id: string): {
    release: string;
    status: 'not-required' | 'review-required' | 'prepared' | 'blocked';
    dependencyCount: number;
    installRequired: boolean;
    buildRequired: boolean;
    installCommand: readonly string[] | null;
    buildCommand: readonly string[] | null;
    blockers: string[];
    executed: false;
  } {
    const candidate = this.projects.inspect(id).candidateRelease;
    if (!candidate) throw new RangeError('Stage a Node candidate before dependency review');
    const { plan } = this.projects.release(id, candidate); // Verify source hashes.
    const toolchain = this.toolchain(plan);
    const blockers = [
      ...toolchain.missingTools.map((name) => 'missing-tool:' + name),
      ...toolchain.conflicts,
      ...plan.lockReview.missingDirectEntries.map((name) => 'missing-lock:' + name),
      ...plan.lockReview.unreviewedSources.map((name) => 'unreviewed-source:' + name),
      ...plan.lockReview.installScripts.map((name) => 'install-script:' + name),
    ];
    const installRequired = plan.dependencyCount > 0;
    const buildRequired = plan.commands.build !== null;
    const prepared = installRequired && this.packagesReady(id, candidate, plan);
    return {
      release: candidate,
      status: blockers.length ? 'blocked' :
        prepared ? 'prepared' :
        installRequired || buildRequired ? 'review-required' : 'not-required',
      dependencyCount: plan.dependencyCount,
      installRequired,
      buildRequired,
      // These are proposed argv, never evaluated as shell or executed here.
      installCommand: installRequired ?
        (buildRequired ? SAFE_NPM_BUILD_CI_COMMAND : SAFE_NPM_CI_COMMAND) : null,
      buildCommand: buildRequired ? ['npm', 'run', 'build'] : null,
      blockers,
      executed: false,
    };
  }

  /** Fixed native syntax validation; reads a proven release but never executes its source. */
  private checkReleaseSyntax(
    id: string,
    release: string,
  ): {
    release: string;
    status: 'syntax-valid' | 'syntax-invalid';
    executed: false;
  } {
    const source = this.projects.release(id, release);
    const result = spawnSync(
      PREFIX + '/bin/node',
      ['--check', path.join(source.folder, 'server.mjs')],
      {
        cwd: source.folder,
        encoding: 'utf8',
        shell: false,
        timeout: 3000,
        maxBuffer: 4096,
        env: { ...process.env, NODE_OPTIONS: undefined },
      },
    );
    // This is deliberately not npm run build: no package scripts or source execution.
    if (result.error) throw new Error('Node syntax verification unavailable');
    return {
      release,
      status: result.status === 0 ? 'syntax-valid' : 'syntax-invalid',
      executed: false,
    };
  }
  checkBuild(
    id: string,
    release: string,
  ): {
    release: string;
    status: 'syntax-valid' | 'syntax-invalid';
    executed: false;
  } {
    // Syntax inspection needs the fixed Node binary, not an npm version probe.
    // Re-attest the exact staged candidate; do not grant deploy or run permission.
    const candidate = this.projects.inspect(id).candidateRelease;
    if (candidate !== release || !RELEASE.test(release)) {
      throw new Error('Node source admission unavailable');
    }
    const source = this.projects.release(id, release);
    if (!this.dependenciesReady(id, release, source.plan)) {
      throw new Error('Node syntax check requires prepared dependencies and no build');
    }
    return this.checkReleaseSyntax(id, release);
  }
  status(id: string): {
    state: 'not-provisioned' | 'stopped' | 'running' | 'unknown';
    port: number | null;
    activeRelease: string | null;
    lastGoodRelease: string | null;
    previousGoodRelease: string | null;
    desired: 'stopped' | 'running';
    history: RuntimeRecord['history'];
    healthDecision: HealthDecision;
  } {
    const state = this.record(id);
    if (!state)
      return {
        state: 'not-provisioned',
        port: null,
        activeRelease: null,
        lastGoodRelease: null,
        previousGoodRelease: null,
        desired: 'stopped',
        history: [],
        healthDecision: { action: 'none', reason: 'not-provisioned', nextEligibleAtMs: null },
      };
    const current = state.activeRelease
      ? this.observe(id, state.activeRelease)
      : this.unitState(id) === 'down'
        ? 'down'
        : 'unknown';
    const matches =
      current !== 'down' &&
      current !== 'unknown' &&
      state.process?.pid === current.pid &&
      state.process.ticks === current.ticks;
    const observed = current === 'down' ? 'stopped' : matches ? 'running' : 'unknown';
    const nowMs = Date.now();
    let attempts = 0;
    for (const event of [...state.history].reverse()) {
      if (event.action !== 'failed') break;
      attempts++;
    }
    const lastFailure = [...state.history].reverse().find((event) => event.action === 'failed');
    const healthDecision = evaluateHealthPolicy(
      { readinessTimeoutMs: 10000, cooldownMs: 30000, maxAttempts: 3 },
      {
        desired: state.desired,
        observed,
        ready: null, // PID ownership is not an HTTP readiness signal.
        requestedAtMs: null,
        lastAttemptAtMs: lastFailure ? Math.min(nowMs, Date.parse(lastFailure.at)) : null,
        attempts,
        nowMs,
        owned: true, // The exact runit registry/marker was re-attested by record().
        manuallyDisabled: state.desired === 'stopped',
      },
    );
    return {
      state: current === 'down' ? 'stopped' : matches ? 'running' : 'unknown',
      port: state.port,
      activeRelease: state.activeRelease,
      lastGoodRelease: state.lastGoodRelease,
      previousGoodRelease: state.previousGoodRelease ?? null,
      desired: state.desired,
      history: state.history,
      healthDecision,
    };
  }
  /** New runit directories are discovered asynchronously by the installed service-daemon. */
  private async awaitSupervisor(id: string): Promise<void> {
    const { service } = this.context(id);
    for (let n = 0; n < 120; n++) {
      const status = spawnSync(PREFIX + '/bin/sv', ['status', service], {
        shell: false,
        encoding: 'utf8',
        timeout: 1500,
        maxBuffer: 2048,
      });
      if (status.status === 0 && /^(?:run|down): /.test(status.stdout)) return;
      await pause();
    }
    throw new Error('Existing Termux runit did not discover owned Node unit');
  }
  private async settle(
    id: string,
    release: string,
    port: number,
    nonce: string,
  ): Promise<ProcessProof> {
    for (let n = 0; n < 40; n++) {
      const proof = this.observe(id, release);
      if (proof !== 'down' && proof !== 'unknown' && (await probeOwnedNodeReadiness(port, nonce))) {
        const after = this.observe(id, release);
        if (
          after !== 'down' &&
          after !== 'unknown' &&
          after.pid === proof.pid &&
          after.ticks === proof.ticks
        )
          return proof;
      }
      await pause();
    }
    throw new Error('Node runtime failed exact-owner readiness');
  }
  private async halt(id: string, state: RuntimeRecord): Promise<void> {
    if (!state.activeRelease) {
      if (this.unitState(id) !== 'down')
        throw new Error('Unattributed runit process: stop refused');
      return;
    }
    const process = this.observe(id, state.activeRelease);
    if (
      process === 'unknown' ||
      (process !== 'down' &&
        (!state.process ||
          state.process.pid !== process.pid ||
          state.process.ticks !== process.ticks))
    )
      throw new Error('Unsafe runit owner identity: stop refused');
    const result = await this.admin.apply('stop', state.unit);
    if (result.result?.exit !== 0) throw new Error('Runit stop rejected');
    for (let i = 0; i < 40; i++) {
      if (this.observe(id, state.activeRelease) === 'down' && (await portFree(state.port))) return;
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
    writeFileSync(path.join(service, 'log', 'run'), nodeLogRun(log), { flag: 'wx', mode: 0o700 });
    const nonce = randomBytes(24).toString('hex');
    this.script(id, release, port, nonce);
    const state: RuntimeRecord = {
      schema: 1,
      owner: 'pockethost-node-runit',
      projectId: id,
      unit,
      port,
      desired: 'stopped',
      activeRelease: null,
      lastGoodRelease: null,
      previousGoodRelease: null,
      process: null,
      readinessNonce: nonce,
      history: [],
    };
    this.writeState(id, state);
    await this.admin.apply('register', unit);
    return state;
  }
  async deploy(
    id: string,
    release: string,
    approved: boolean,
    rollback = false,
  ): Promise<ReturnType<NodeRunitHost['status']>> {
    if (approved !== true) throw new Error('Explicit owned runtime approval required');
    if (!RELEASE.test(release)) throw new RangeError('Invalid Node release ID');
    if (rollback) {
      const state = this.record(id);
      if (!state?.previousGoodRelease || state.previousGoodRelease !== release)
        throw new Error('No verified prior good release for rollback');
      const dependencyPlan = this.projects.release(id, release).plan;
      if (
        !this.dependenciesReady(id, release, dependencyPlan) ||
        this.toolchain(dependencyPlan).status === 'blocked'
      )
        throw new Error('Rollback dependencies or Node toolchain unavailable');
    } else {
      const plan = this.preview(id);
      if (!plan.allowed || plan.release !== release)
        throw new Error('Dependency/toolchain plan not authorized');
    }
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
      if (!rollback && this.projects.inspect(id).candidateRelease !== release) {
        throw new Error('Node source candidate changed during admission');
      }
      const source = this.projects.release(id, release); // Re-attest under lock.
      if (!this.dependenciesReady(id, release, source.plan) ||
          this.toolchain(source.plan).status === 'blocked')
        throw new Error('Release dependencies unverified: existing service retained');
      // Fail a malformed candidate *before* stopping the last working service.
      // Node --check parses source without executing it or installing packages.
      if (this.checkReleaseSyntax(id, release).status !== 'syntax-valid') {
        throw new Error('Node release syntax invalid: existing service retained');
      }
      let state = this.record(id);
      if (!rollback && state?.activeRelease === release) {
        throw new Error('Node release already active; use Start or Restart instead');
      }
      if (rollback && state?.previousGoodRelease !== release) {
        throw new Error('Rollback target changed during admission');
      }
      // An update can fail after stopping the current service. Verify the
      // entire fallback (source, packages, toolchain and syntax) *before*
      // halting anything. Otherwise recovery might execute a tampered release.
      const recoveryRelease = state?.lastGoodRelease;
      if (recoveryRelease && recoveryRelease !== release) {
        const recovery = this.projects.release(id, recoveryRelease);
        if (
          !this.dependenciesReady(id, recoveryRelease, recovery.plan) ||
          this.toolchain(recovery.plan).status === 'blocked' ||
          this.checkReleaseSyntax(id, recoveryRelease).status !== 'syntax-valid'
        )
          throw new Error('Previous healthy Node release is not recoverable: update refused');
      }
      if (!state) {
        const reservations = new Set<number>();
        for (const otherProject of this.projects.list()) {
          if (otherProject.id === id) continue;
          const other = this.record(otherProject.id);
          if (other) reservations.add(other.port);
        }
        const port = await selectUnreservedNodePort(reservations, portFree);
        state = await this.initialize(id, port, release);
      }
      if (state.activeRelease) await this.halt(id, state);
      else if (!(await portFree(state.port))) throw new Error('Owned port not free');
      await this.awaitSupervisor(id);
      if (this.unitState(id) !== 'down') {
        throw new Error('Unattributed runit process: deployment refused');
      }
      const prior = state.lastGoodRelease;
      const nonce = randomBytes(24).toString('hex');
      this.script(id, release, state.port, nonce);
      state.readinessNonce = nonce;
      // Persist the new unit digest/nonce before invoking runit. On a crash,
      // recovery fails closed rather than interpreting stale markers as owners.
      this.writeState(id, state);
      try {
        const result = await this.admin.apply('once', state.unit);
        if (result.result?.exit !== 0) throw new Error('Runit one-shot start rejected');
        const proof = await this.settle(id, release, state.port, nonce);
        state.activeRelease = release;
        if (prior && prior !== release) state.previousGoodRelease = prior;
        state.lastGoodRelease = release;
        state.process = proof;
        state.desired = 'running';
        this.history(state, rollback ? 'rollback' : prior ? 'update' : 'start', release);
        this.writeState(id, state);
      } catch (error) {
        this.history(state, 'failed', release);
        state.desired = 'stopped';
        state.process = null;
        state.activeRelease = null;
        this.writeState(id, state);
        // Do not signal an unknown process; retain evidence and refuse adoption.
        const observed = this.observe(id, release);
        if (observed !== 'down') {
          if (observed === 'unknown')
            throw new Error('Failed start identity unknown; manual review required');
          const result = await this.admin.apply('stop', state.unit);
          if (result.result?.exit !== 0) throw new Error('Failed start cleanup refused');
        }
        if (prior) {
          // The previous proof can change even while the new release starts.
          // Never attempt an automatic rollback without re-attesting it.
          const recovery = this.projects.release(id, prior);
          if (
            !this.dependenciesReady(id, prior, recovery.plan) ||
            this.toolchain(recovery.plan).status === 'blocked' ||
            this.checkReleaseSyntax(id, prior).status !== 'syntax-valid'
          )
            throw new Error('Rollback source no longer verified; manual recovery required');
          for (let n = 0; n < 40 && !(await portFree(state.port)); n++) await pause();
          if (!(await portFree(state.port))) throw new Error('Failed release still occupies port');
          const restoreNonce = randomBytes(24).toString('hex');
          this.script(id, prior, state.port, restoreNonce);
          state.readinessNonce = restoreNonce;
          this.writeState(id, state);
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
  /** Explicit one-shot resume of the last verified release; never adopts a runit process. */
  async start(id: string, approved: boolean): Promise<ReturnType<NodeRunitHost['status']>> {
    if (approved !== true) throw new Error('Explicit owned start approval required');
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
      const state = this.record(id);
      if (!state?.activeRelease || state.lastGoodRelease !== state.activeRelease)
        throw new Error('No verified active Node release to resume');
      if (state.desired !== 'stopped' || state.process !== null || this.unitState(id) !== 'down')
        throw new Error('Owned Node service is not safely stopped');
      if (!(await portFree(state.port))) throw new Error('Owned Node port is occupied');
      const release = this.projects.release(id, state.activeRelease);
      if (
        !this.dependenciesReady(id, state.activeRelease, release.plan) ||
        this.toolchain(release.plan).status === 'blocked'
      )
        throw new Error('Node release dependencies or toolchain no longer supported');
      if (this.checkReleaseSyntax(id, state.activeRelease).status !== 'syntax-valid')
        throw new Error('Node release source syntax invalid');
      const nonce = randomBytes(24).toString('hex');
      this.script(id, state.activeRelease, state.port, nonce);
      state.readinessNonce = nonce;
      this.writeState(id, state);
      try {
        const result = await this.admin.apply('once', state.unit);
        if (result.result?.exit !== 0) throw new Error('Runit one-shot start rejected');
        const proof = await this.settle(id, state.activeRelease, state.port, nonce);
        state.process = proof;
        state.desired = 'running';
        this.history(state, 'start', state.activeRelease);
        this.writeState(id, state);
      } catch (error) {
        state.process = null;
        state.desired = 'stopped';
        this.history(state, 'failed', state.activeRelease);
        this.writeState(id, state);
        // A failed start may have left a process behind. Never signal an
        // unverified PID or automatically retry; require manual review.
        if (this.observe(id, state.activeRelease) !== 'down')
          throw new Error('Node start unconfirmed; inspect the owned process before retrying');
        throw error;
      }
      return this.status(id);
    } finally {
      rmSync(lock, { force: true });
      rmSync(globalLock, { force: true });
    }
  }
  async rollback(id: string, approved: boolean): Promise<ReturnType<NodeRunitHost['status']>> {
    if (approved !== true) throw new Error('Explicit owned rollback approval required');
    const state = this.record(id);
    if (!state?.previousGoodRelease) throw new Error('No prior healthy Node release');
    return this.deploy(id, state.previousGoodRelease, approved, true);
  }
  async stop(id: string, approved: boolean): Promise<ReturnType<NodeRunitHost['status']>> {
    if (approved !== true) throw new Error('Explicit owned stop required');
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
      const state = this.record(id);
      if (!state) throw new Error('No owned Node unit to stop');
      await this.halt(id, state);
      state.process = null;
      state.desired = 'stopped';
      if (state.activeRelease) this.history(state, 'stop', state.activeRelease);
      this.writeState(id, state);
      return this.status(id);
    } finally {
      rmSync(lock, { force: true });
      rmSync(globalLock, { force: true });
    }
  }
  /** Explicit sequential restart; a failed stop never permits a new start. */
  async restart(id: string, approved: boolean): Promise<ReturnType<NodeRunitHost['status']>> {
    if (approved !== true) throw new Error('Explicit owned restart approval required');
    const observed = this.status(id);
    if (
      observed.state !== 'running' ||
      !observed.activeRelease ||
      observed.lastGoodRelease !== observed.activeRelease
    )
      throw new Error('No verified running Node release to restart');
    // Both steps re-attest ownership and hold the existing global/project
    // locks. If stop succeeds but start fails, the project stays stopped.
    await this.stop(id, true);
    return this.start(id, true);
  }
  /** Current loopback readiness of the *same* verified process and release. */
  async health(id: string): Promise<{
    state: 'not-provisioned' | 'stopped' | 'running' | 'unknown';
    release: string | null;
    ready: boolean | null;
  }> {
    const state = this.record(id);
    if (!state) return { state: 'not-provisioned', release: null, ready: null };
    const release = state.activeRelease;
    if (!release || state.desired !== 'running') {
      return { state: this.unitState(id) === 'down' ? 'stopped' : 'unknown', release, ready: null };
    }
    const before = this.observe(id, release);
    if (before === 'down') return { state: 'stopped', release, ready: null };
    if (
      before === 'unknown' ||
      !state.process ||
      before.pid !== state.process.pid ||
      before.ticks !== state.process.ticks
    ) {
      return { state: 'unknown', release, ready: null };
    }
    const ready = await probeOwnedNodeReadiness(state.port, state.readinessNonce);
    const current = this.record(id);
    const after = this.observe(id, release);
    if (
      !current ||
      current.activeRelease !== release ||
      current.readinessNonce !== state.readinessNonce ||
      current.desired !== 'running' ||
      !current.process ||
      current.process.pid !== before.pid ||
      current.process.ticks !== before.ticks ||
      after === 'down' ||
      after === 'unknown' ||
      after.pid !== before.pid ||
      after.ticks !== before.ticks
    ) {
      return { state: 'unknown', release, ready: null };
    }
    return { state: 'running', release, ready };
  }
  /** Source output remains private to direct-loopback admin sessions. */
  async previewLocalResponse(id: string): Promise<{
    release: string;
    port: number;
    body: string;
  }> {
    const state = this.record(id);
    if (
      !state?.activeRelease ||
      !state.process ||
      state.desired !== 'running' ||
      this.status(id).state !== 'running'
    ) {
      throw new Error('No verified running Node release available for local preview');
    }
    if (!(await probeOwnedNodeReadiness(state.port, state.readinessNonce))) {
      throw new Error('Owned Node readiness has not been verified');
    }
    const body = await readBoundedNodePreview(state.port);
    const after = this.observe(id, state.activeRelease);
    if (
      after === 'down' ||
      after === 'unknown' ||
      after.pid !== state.process.pid ||
      after.ticks !== state.process.ticks
    )
      throw new Error('Node runtime identity changed during preview');
    return { release: state.activeRelease, port: state.port, body };
  }
  logs(id: string): { lines: string[] } {
    const state = this.record(id);
    if (!state) return { lines: [] };
    return this.admin.logs(state.unit);
  }
  registryProjection() {
    const entries = this.projects.list().map((project) => {
      const status = this.status(project.id);
      return {
        id: project.id,
        kind: project.kind,
        port: status.port,
        registered: status.state !== 'not-provisioned',
      };
    });
    const declarations = projectNodeHostingDeclarations(entries);
    createHostingRegistries(declarations); // Reject collisions; does not confer process authority.
    return declarations;
  }
}
