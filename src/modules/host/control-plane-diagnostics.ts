import { spawnSync } from 'node:child_process';
import { closeSync, constants, fstatSync, lstatSync, openSync, readFileSync, readSync, readdirSync, realpathSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseProcessStat } from './observability-probes.ts';

const PREFIX = '/data/data/com.termux/files/usr';
type Name = 'termux-agent' | 'pockethost-panel' | 'pockethost-panel-watch';
type Run = (binary: string, args: string[]) => {
  status?: number | null; stdout?: string | Buffer; error?: Error;
};
type ServiceState = { state: 'running' | 'stopped' | 'unknown'; uptimeSeconds: number | null;
  error: 'unavailable' | 'unsafe-service' | 'timeout' | null };
type RevisionEvidence = {
  state: 'same' | 'ancestor' | 'diverged' | 'unavailable';
  changedFiles: number | null;
  areas: { adminUI: number; hostBackend: number; tests: number; docs: number; other: number } | null;
};
type Owner = { state: 'verified' | 'unverified'; pid: number | null;
  startTicks: string | null; markerSha: string | null; gatewaySha: string | null;
  markerAgreement: 'match' | 'mismatch' | 'unverified'; checkoutSha: string | null;
  checkoutClean: boolean | null; revision: 'match' | 'mismatch' | 'unverified';
  revisionEvidence: RevisionEvidence;
  reason: 'unavailable' | 'invalid-owner' | 'untrusted-checkout' |
    'invalid-process' | 'invalid-source' | null };
export interface ControlPlaneDiagnostics {
  version: 1; mode: 'read-only'; observedAt: string;
  localAgent: {
    runit: ServiceState;
    intake: 'stop-present' | 'stop-absent' | 'unverified';
    claims: number | null;
    spooled: number | null;
    unspooledClaims: number | null;
    orphanSpools: number | null;
    lastResult: 'done' | 'failed' | 'unknown' | 'unverified';
    lastResultAt: string | null;
    publication: 'not-checked';
  };
  pocketHost: { runit: ServiceState; watch: ServiceState; owner: Owner;
    updateReadiness: 'hold-manual-review'; restart: 'blocked' };
  notice: 'no-lifecycle-authority';
}
const SHA = /^[a-f0-9]{40}$/;
const inside = (root: string, file: string) => file.startsWith(root + path.sep);
const unknown = (error: ServiceState['error']): ServiceState =>
  ({ state: 'unknown', uptimeSeconds: null, error });

/** Fixed read-only sources, no service control or arbitrary path input. */
export class ControlPlaneDiagnosticHost {
  private readonly serviceRoot: string;
  private readonly svRoot: string;
  private readonly home: string;
  private readonly run: Run;
  private readonly proc: (file: string) => string;
  private readonly resolve: (file: string) => string;
  private readonly now: () => string;

  constructor(
    serviceRoot = path.join(PREFIX, 'var/service'),
    svRoot = path.join(PREFIX, 'var/sv'),
    home = os.homedir(),
    run: Run = (binary, args) => spawnSync(binary, args,
      { encoding: 'utf8', shell: false, timeout: 1200, maxBuffer: 1024 }),
    proc: (file: string) => string = file => readFileSync(file, 'utf8'),
    resolve: (file: string) => string = file => realpathSync(file),
    now: () => string = () => new Date().toISOString(),
  ) {
    this.serviceRoot = serviceRoot;
    this.svRoot = svRoot;
    this.home = home;
    this.run = run;
    this.proc = proc;
    this.resolve = resolve;
    this.now = now;
  }

  private status(name: Name): ServiceState {
    try {
      const parent = lstatSync(this.serviceRoot);
      if (!parent.isDirectory() || parent.isSymbolicLink()) return unknown('unsafe-service');
      const target = path.join(this.serviceRoot, name);
      const entry = lstatSync(target);
      if (!entry.isDirectory() && !entry.isSymbolicLink()) return unknown('unsafe-service');
      const resolved = this.resolve(target);
      if (!lstatSync(resolved).isDirectory() || path.basename(resolved) !== name ||
          !(inside(this.resolve(this.serviceRoot), resolved) ||
            inside(this.resolve(this.svRoot), resolved))) return unknown('unsafe-service');
      const result = this.run(path.join(PREFIX, 'bin/sv'), ['status', target]);
      if (result.error || result.status !== 0 || typeof result.stdout !== 'string')
        return unknown((result.error as NodeJS.ErrnoException | undefined)?.code === 'ETIMEDOUT'
          ? 'timeout' : 'unavailable');
      const line = result.stdout.trim();
      const prefix = 'run: ' + target + ': ';
      const down = 'down: ' + target + ': ';
      if (line.startsWith(prefix)) {
        const match = /^\(pid ([1-9]\d*)\) (\d+)s(?:[,;]|$)/.exec(line.slice(prefix.length));
        if (match && Number.isSafeInteger(Number(match[1])) &&
            Number.isSafeInteger(Number(match[2])))
          return { state: 'running', uptimeSeconds: Number(match[2]), error: null };
      }
      if (line.startsWith(down) && /^\d+s(?:[,;]|$)/.test(line.slice(down.length)))
        return { state: 'stopped', uptimeSeconds: null, error: null };
    } catch { /* unavailable, do not infer healthy */ }
    return unknown('unavailable');
  }


  /**
   * The Termux Agent owns an independent runit service below its private state,
   * not the generic $PREFIX/var/service namespace used by PocketHost.
   * An unrelated service named "termux-agent" must never stand in for it.
   */
  private agentRunit(): ServiceState {
    const root = path.join(this.home, '.local/state/local-agent/termux');
    const folder = path.join(root, 'runit/services');
    const service = path.join(folder, 'termux-agent');
    try {
      for (const dir of [this.home, path.join(this.home, '.local'),
        path.join(this.home, '.local/state'),
        path.join(this.home, '.local/state/local-agent'),
        root, path.join(root, 'runit'), folder, service]) {
        const item = lstatSync(dir);
        if (!item.isDirectory() || item.isSymbolicLink() ||
            this.resolve(dir) !== dir) return unknown('unsafe-service');
      }
      const result = this.run(path.join(PREFIX, 'bin/sv'), ['status', service]);
      if (result.error || result.status !== 0 || typeof result.stdout !== 'string')
        return unknown((result.error as NodeJS.ErrnoException | undefined)?.code === 'ETIMEDOUT'
          ? 'timeout' : 'unavailable');
      const line = result.stdout.trim();
      const prefix = 'run: ' + service + ': ';
      const down = 'down: ' + service + ': ';
      if (line.startsWith(prefix)) {
        const match = /^\(pid ([1-9]\d*)\) (\d+)s(?:[,;]|$)/.exec(line.slice(prefix.length));
        if (match && Number.isSafeInteger(Number(match[1])) &&
            Number.isSafeInteger(Number(match[2])))
          return { state: 'running', uptimeSeconds: Number(match[2]), error: null };
      }
      if (line.startsWith(down) && /^\d+s(?:[,;]|$)/.test(line.slice(down.length)))
        return { state: 'stopped', uptimeSeconds: null, error: null };
    } catch { /* no guessed runit state without verified private path */ }
    return unknown('unavailable');
  }

  /** Read only the two bounded, locally correlated status fields of a recent result. */
  private recentAgentSpool(state: string, spoolNames: Set<string> | null,
    claimNames: Set<string> | null): { lastResult: ControlPlaneDiagnostics['localAgent']['lastResult'];
      lastResultAt: string | null } {
    const unverified = { lastResult: 'unverified' as const, lastResultAt: null };
    if (!spoolNames || !claimNames || !spoolNames.size) return unverified;
    try {
      let newest: { name: string; mtimeMs: number } | null = null;
      for (const name of spoolNames) {
        const stats = lstatSync(path.join(state, 'results', name));
        if (!stats.isFile() || stats.isSymbolicLink() || !Number.isFinite(stats.mtimeMs))
          return unverified;
        if (!newest || stats.mtimeMs > newest.mtimeMs)
          newest = { name, mtimeMs: stats.mtimeMs };
      }
      if (!newest || !claimNames.has(newest.name)) return unverified;
      // Never follow a raced symlink, and never read an unbounded result payload.
      const readBounded = (file: string, maxBytes: number): unknown => {
        const fd = openSync(file, constants.O_RDONLY | constants.O_NOFOLLOW);
        try {
          const stats = fstatSync(fd);
          if (!stats.isFile() || stats.size < 2 || stats.size > maxBytes)
            throw Error('untrusted-spool');
          const bytes = Buffer.alloc(stats.size + 1);
          const actual = readSync(fd, bytes, 0, bytes.length, 0);
          if (actual !== stats.size) throw Error('changed-spool');
          return JSON.parse(bytes.toString('utf8', 0, actual)) as unknown;
        } finally {
          closeSync(fd);
        }
      };
      const claim = readBounded(path.join(state, 'claims', newest.name), 4096);
      const spool = readBounded(path.join(state, 'results', newest.name), 262144);
      const record = (value: unknown): value is Record<string, unknown> =>
        value !== null && typeof value === 'object' && !Array.isArray(value);
      const id = newest.name.slice(0, -5);
      if (!record(claim) || !record(spool) || !record(spool.result) ||
          Object.keys(claim).sort().join(',') !== 'id,status,task_digest,version' ||
          claim.version !== 1 || claim.id !== id ||
          claim.status !== 'execution_may_have_started' ||
          typeof claim.task_digest !== 'string' || !/^[a-f0-9]{64}$/.test(claim.task_digest) ||
          spool.version !== 1 || spool.id !== id || spool.task_digest !== claim.task_digest ||
          !['done', 'failed', 'unknown'].includes(String(spool.status)) ||
          typeof spool.target_host_id !== 'string' || !spool.target_host_id ||
          typeof spool.target_installation_id !== 'string' || !spool.target_installation_id ||
          spool.result.id !== id || spool.result.status !== spool.status ||
          (spool.result.task_digest !== undefined &&
            spool.result.task_digest !== claim.task_digest) ||
          (spool.result.target_host_id !== undefined &&
            spool.result.target_host_id !== spool.target_host_id) ||
          (spool.result.target_installation_id !== undefined &&
            spool.result.target_installation_id !== spool.target_installation_id))
        return unverified;
      return {
        lastResult: spool.status as 'done' | 'failed' | 'unknown',
        lastResultAt: new Date(newest.mtimeMs).toISOString(),
      };
    } catch {
      return unverified;
    }
  }

  /** Only the installed Termux Agent's fixed private state, never its config or task contents. */
  private localAgentState(): Omit<ControlPlaneDiagnostics['localAgent'], 'runit'> {
    const unavailable = {
      intake: 'unverified' as const, claims: null, spooled: null,
      unspooledClaims: null, orphanSpools: null,
      lastResult: 'unverified' as const, lastResultAt: null,
      publication: 'not-checked' as const,
    };
    const state = path.join(this.home, '.local/state/local-agent/termux');
    try {
      const parents = [
        this.home,
        path.join(this.home, '.local'),
        path.join(this.home, '.local/state'),
        path.join(this.home, '.local/state/local-agent'),
        state,
      ];
      for (const directory of parents) {
        const entry = lstatSync(directory);
        if (!entry.isDirectory() || entry.isSymbolicLink() ||
            this.resolve(directory) !== directory) return unavailable;
      }
      let intake: 'stop-present' | 'stop-absent';
      try {
        // A dangling symlink is still an emergency stop signal, matching Agent.disabled().
        lstatSync(path.join(state, 'EMERGENCY_STOP'));
        intake = 'stop-present';
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') return unavailable;
        intake = 'stop-absent';
      }
      const entries = (name: 'claims' | 'results'): Set<string> | null => {
        const folder = path.join(state, name);
        const entry = lstatSync(folder);
        if (!entry.isDirectory() || entry.isSymbolicLink() ||
            this.resolve(folder) !== folder) return null;
        const items = readdirSync(folder, { withFileTypes: true });
        if (items.length > 2048) return null;
        const ids = new Set<string>();
        for (const item of items) {
          if (!item.name.endsWith('.json')) continue;
          if (!/^[A-Za-z0-9._-]{1,200}\.json$/.test(item.name) || !item.isFile())
            return null;
          ids.add(item.name);
        }
        return ids;
      };
      const claimNames = entries('claims');
      const spoolNames = entries('results');
      const claims = claimNames?.size ?? null;
      const spooled = spoolNames?.size ?? null;
      const unspooledClaims = claimNames && spoolNames ?
        [...claimNames].filter(name => !spoolNames.has(name)).length : null;
      const orphanSpools = claimNames && spoolNames ?
        [...spoolNames].filter(name => !claimNames.has(name)).length : null;
      return {
        intake, claims, spooled, unspooledClaims, orphanSpools,
        // A consistent local status is not independent Agent verification or GitHub delivery.
        ...this.recentAgentSpool(state, spoolNames, claimNames),
        publication: 'not-checked',
      };
    } catch {
      return unavailable;
    }
  }

  private marker(file: string): Record<string, unknown> {
    const stat = lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 16384) throw Error('invalid-owner');
    const parsed: unknown = JSON.parse(readFileSync(file, 'utf8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
      throw Error('invalid-owner');
    return parsed as Record<string, unknown>;
  }

  private git(root: string, args: string[]): string {
    const result = this.run(path.join(PREFIX, 'bin/git'), ['-C', root, ...args]);
    if (result.error || result.status !== 0 || typeof result.stdout !== 'string' ||
        result.stdout.length > 1024) throw Error('invalid-source');
    return result.stdout.trim();
  }

  /**
   * Compare only pinned, verified revisions in the known PocketHost checkout.
   * Return counts only: never expose paths, git configuration or raw diffs.
   * Failure to inspect history is not evidence of a clean or safe update.
   */
  private revisionEvidence(root: string, saved: string, current: string): RevisionEvidence {
    const unavailable: RevisionEvidence = {
      state: 'unavailable', changedFiles: null, areas: null,
    };
    if (saved === current) {
      return {
        state: 'same', changedFiles: 0,
        areas: { adminUI: 0, hostBackend: 0, tests: 0, docs: 0, other: 0 },
      };
    }
    try {
      if (this.git(root, ['cat-file', '-t', saved]) !== 'commit') return unavailable;
      const ancestor = this.run(path.join(PREFIX, 'bin/git'),
        ['-C', root, 'merge-base', '--is-ancestor', saved, current]);
      if (ancestor.error || (ancestor.status !== 0 && ancestor.status !== 1))
        return unavailable;
      const raw = this.git(root, ['diff', '--name-only', '--no-renames',
        '--no-ext-diff', saved, current]);
      const names = raw ? raw.split('\n') : [];
      if (names.length > 250 || names.some(name => !name || name.includes('\0')))
        return unavailable;
      const areas = { adminUI: 0, hostBackend: 0, tests: 0, docs: 0, other: 0 };
      for (const name of names) {
        if (name.startsWith('apps/admin/')) areas.adminUI++;
        else if (name.startsWith('src/modules/host/')) areas.hostBackend++;
        else if (name.startsWith('tests/') || name.includes('/tests/')) areas.tests++;
        else if (name.startsWith('docs/')) areas.docs++;
        else areas.other++;
      }
      return {
        state: ancestor.status === 0 ? 'ancestor' : 'diverged',
        changedFiles: names.length, areas,
      };
    } catch {
      return unavailable;
    }
  }

  private inspectOwner(): Owner {
    const value: Owner = { state: 'unverified', pid: null, startTicks: null,
      markerSha: null, gatewaySha: null, markerAgreement: 'unverified',
      checkoutSha: null, checkoutClean: null,
      revision: 'unverified', reason: 'unavailable',
      revisionEvidence: { state: 'unavailable', changedFiles: null, areas: null } };
    try {
      const projects = path.join(this.home, 'Projects');
      const state = path.join(this.home, '.local/state/pockethost');
      for (const dir of [this.home, projects, path.join(this.home, '.local'),
        path.join(this.home, '.local/state'), state]) {
        const stat = lstatSync(dir);
        if (!stat.isDirectory() || stat.isSymbolicLink()) throw Error('invalid-owner');
      }
      const marker = this.marker(path.join(projects, 'PocketHost-P3-Preview-20261106.json'));
      const gateway = this.marker(path.join(state, 'lan-gateway.json'));
      const pid = marker.pid;
      const ticks = String(marker.startTicks ?? '');
      const cwd = marker.cwd;
      if (!Number.isSafeInteger(pid) || (pid as number) < 2 ||
          !/^\d{1,30}$/.test(ticks) || typeof cwd !== 'string' ||
          !inside(projects, cwd) || !cwd.endsWith('/apps/admin') ||
          marker.port !== 8787 || gateway.owner !== 'PocketHost' ||
          gateway.pid !== pid || gateway.cwd !== cwd ||
          String(gateway.startTicks ?? '') !== ticks || gateway.adminPort !== 18878)
        throw Error('invalid-owner');
      const root = path.dirname(path.dirname(cwd));
      if (!/^PocketHost-[a-zA-Z0-9-]+$/.test(path.basename(root)) ||
          this.resolve(projects) !== projects || this.resolve(root) !== root ||
          this.resolve(cwd) !== cwd) throw Error('untrusted-checkout');
      const proc = '/proc/' + pid;
      const before = parseProcessStat(this.proc(proc + '/stat'), pid as number);
      const activeCwd = this.resolve(proc + '/cwd');
      const argv = this.proc(proc + '/cmdline');
      const after = parseProcessStat(this.proc(proc + '/stat'), pid as number);
      // The only authorized DEV launcher is ops/termux/panel-service.sh.
      // A foreign node process with argv containing "vite.js" is not our panel.
      const expectedArgs = [
        path.join(PREFIX, 'bin/node'),
        path.join(root, 'apps/admin/node_modules/vite/bin/vite.js'),
        '--host', '127.0.0.1', '--port', '8787', '--strictPort',
      ];
      const actualArgs = argv.split('\0');
      if (actualArgs.at(-1) === '') actualArgs.pop();
      if (!before || !after || before.startTicks !== ticks || after.startTicks !== ticks ||
          activeCwd !== cwd || actualArgs.length !== expectedArgs.length ||
          actualArgs.some((arg, index) => arg !== expectedArgs[index]))
        throw Error('invalid-process');
      value.pid = pid as number;
      value.startTicks = ticks;
      if (typeof marker.sourceSha !== 'string' || !SHA.test(marker.sourceSha))
        throw Error('invalid-source');
      value.markerSha = marker.sourceSha;
      value.gatewaySha = typeof gateway.sourceSha === 'string' && SHA.test(gateway.sourceSha)
        ? gateway.sourceSha : null;
      value.markerAgreement = value.gatewaySha === null ? 'unverified' :
        value.gatewaySha === value.markerSha ? 'match' : 'mismatch';
      // A conflicting owner record must never produce a verified panel identity.
      if (value.markerAgreement === 'mismatch') throw Error('invalid-source');
      const checkout = this.git(root, ['rev-parse', 'HEAD']);
      const origin = this.git(root, ['remote', 'get-url', 'origin']);
      if (!SHA.test(checkout) || ![
        'https://github.com/MichalMatu/PocketHost.git',
        'git@github.com:MichalMatu/PocketHost.git',
      ].includes(origin)) throw Error('invalid-source');
      value.checkoutSha = checkout;
      value.checkoutClean = this.git(root, ['status', '--porcelain']) === '';
      value.revision = marker.sourceSha === checkout ? 'match' : 'mismatch';
      value.revisionEvidence = this.revisionEvidence(root, marker.sourceSha, checkout);
      value.state = 'verified';
      value.reason = null;
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      value.reason = ['invalid-owner', 'untrusted-checkout', 'invalid-process',
        'invalid-source'].includes(message) ? message as Owner['reason'] : 'unavailable';
    }
    return value;
  }

  inspect(): ControlPlaneDiagnostics {
    return {
      version: 1, mode: 'read-only', observedAt: this.now(),
      localAgent: { runit: this.agentRunit(), ...this.localAgentState() },
      pocketHost: { runit: this.status('pockethost-panel'),
        watch: this.status('pockethost-panel-watch'),
        owner: this.inspectOwner(), updateReadiness: 'hold-manual-review',
        restart: 'blocked' },
      notice: 'no-lifecycle-authority',
    };
  }
}
