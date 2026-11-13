import { spawnSync } from 'node:child_process';
import { lstatSync, readFileSync, realpathSync } from 'node:fs';
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
type Owner = { state: 'verified' | 'unverified'; pid: number | null;
  startTicks: string | null; markerSha: string | null; gatewaySha: string | null;
  markerAgreement: 'match' | 'mismatch' | 'unverified'; checkoutSha: string | null;
  checkoutClean: boolean | null; revision: 'match' | 'mismatch' | 'unverified';
  reason: 'unavailable' | 'invalid-owner' | 'untrusted-checkout' |
    'invalid-process' | 'invalid-source' | null };
export interface ControlPlaneDiagnostics {
  version: 1; mode: 'read-only'; observedAt: string;
  localAgent: { runit: ServiceState; intake: 'unverified'; lastResult: 'unverified' };
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
        const match = /^\(pid ([1-9]\d*)\) (\d+)s(?:;|$)/.exec(line.slice(prefix.length));
        if (match && Number.isSafeInteger(Number(match[1])) &&
            Number.isSafeInteger(Number(match[2])))
          return { state: 'running', uptimeSeconds: Number(match[2]), error: null };
      }
      if (line.startsWith(down) && /^\d+s(?:;|$)/.test(line.slice(down.length)))
        return { state: 'stopped', uptimeSeconds: null, error: null };
    } catch { /* unavailable, do not infer healthy */ }
    return unknown('unavailable');
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

  private inspectOwner(): Owner {
    const value: Owner = { state: 'unverified', pid: null, startTicks: null,
      markerSha: null, gatewaySha: null, markerAgreement: 'unverified',
      checkoutSha: null, checkoutClean: null,
      revision: 'unverified', reason: 'unavailable' };
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
      if (!before || !after || before.startTicks !== ticks || after.startTicks !== ticks ||
          activeCwd !== cwd || !argv.split('\0').some(item => /(^|\/)vite(?:\.mjs|\.js)?$/.test(item)))
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
      localAgent: { runit: this.status('termux-agent'),
        intake: 'unverified', lastResult: 'unverified' },
      pocketHost: { runit: this.status('pockethost-panel'),
        watch: this.status('pockethost-panel-watch'),
        owner: this.inspectOwner(), updateReadiness: 'hold-manual-review',
        restart: 'blocked' },
      notice: 'no-lifecycle-authority',
    };
  }
}
