import { spawnSync } from 'node:child_process';
import { closeSync, fstatSync, lstatSync, openSync, readFileSync, readSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { parseProcessName, parseProcessRss, parseProcessStat } from './observability-probes.ts';

const PREFIX = '/data/data/com.termux/files/usr';
const NAME = 'wreckscanner';
type State = 'running' | 'stopped' | 'unknown';
type Availability = 'ok' | 'unavailable' | 'permission-denied';
type Command = (file: string, args: string[]) => {
  stdout?: string | Buffer; status?: number | null; error?: Error;
};

export interface IleStoiDiagnostics {
  version: 1;
  mode: 'read-only';
  service: 'wreckscanner';
  observedAt: string;
  runit: { state: State; uptimeSeconds: number | null; error: string | null };
  process: {
    pid: number; startTicks: string; name: string | null; rssMiB: number | null;
    memoryState: Availability; identity: 'runit-consistent-not-owned';
  } | null;
  health: { state: 'unverified'; reason: 'no-confirmed-local-http-route' };
  logs: { state: Availability; lines: string[]; error: string | null };
  notice: 'external-protected-no-lifecycle-control';
}
const reason = (error: unknown): Availability =>
  ['EACCES', 'EPERM'].includes(String((error as NodeJS.ErrnoException | null)?.code))
    ? 'permission-denied' : 'unavailable';

export function redactServiceLog(raw: string): string {
  return raw
    .replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '')
    .replace(/\bBearer\s+[a-z0-9._~+/-]+/gi, 'Bearer [redacted]')
    .replace(/https?:\/\/[^\s"'<>]+/gi, '[url-redacted]')
    .replace(/\b(authorization|proxy-authorization|cookie|set-cookie|password|passwd|secret|token|api[_-]?key|access[_-]?key|client[_-]?secret|private[_-]?key)\b\s*[:=]\s*(?:"[^"]*"|'[^']*'|[^\s,;]+)/gi, '$1=[redacted]')
    .replace(/\b[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}\b/g, '[jwt-redacted]')
    .replace(/[^\x20-\x7e]/g, '')
    .slice(0, 200);
}
const inside = (root: string, target: string) => target.startsWith(root + path.sep);

/**
 * Read-only fixed target; does not register, adopt or control an external service.
 * Constructor overrides exist solely for isolated host tests.
 */
export class IleStoiDiagnosticHost {
  constructor(
    private readonly serviceRoot = path.join(PREFIX, 'var/service'),
    private readonly svRoot = path.join(PREFIX, 'var/sv'),
    private readonly logRoot = path.join(PREFIX, 'var/log/sv'),
    private readonly command: Command = (file, args) => spawnSync(file, args, {
      encoding: 'utf8', shell: false, timeout: 1200, maxBuffer: 2048,
    }),
    private readonly readProc: (file: string) => string = file => readFileSync(file, 'utf8'),
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  private service(): { argument: string; resolved: string } {
    const root = lstatSync(this.serviceRoot);
    if (!root.isDirectory() || root.isSymbolicLink()) throw Error('unsafe-root');
    const argument = path.join(this.serviceRoot, NAME);
    const entry = lstatSync(argument);
    if (!entry.isDirectory() && !entry.isSymbolicLink()) throw Error('unsafe-entry');
    const resolved = realpathSync(argument);
    let sv: string | null = null;
    try { sv = realpathSync(this.svRoot); } catch { /* optional */ }
    if (!lstatSync(resolved).isDirectory() || path.basename(resolved) !== NAME ||
        !(inside(realpathSync(this.serviceRoot), resolved) || (sv && inside(sv, resolved))))
      throw Error('foreign-service-target');
    return { argument, resolved };
  }

  private status(argument: string): {
    state: State; pid: number | null; uptimeSeconds: number | null; error: string | null;
  } {
    const result = this.command(path.join(PREFIX, 'bin/sv'), ['status', argument]);
    if (result.error || result.status !== 0 || typeof result.stdout !== 'string')
      return { state: 'unknown', pid: null, uptimeSeconds: null,
        error: (result.error as NodeJS.ErrnoException | undefined)?.code === 'ETIMEDOUT'
          ? 'runit-timeout' : 'runit-unavailable' };
    const line = result.stdout.trim();
    const prefix = 'run: ' + argument + ': ';
    if (line.startsWith(prefix)) {
      const match = /^\(pid ([1-9]\d*)\) (\d+)s(?:;|$)/.exec(line.slice(prefix.length));
      const pid = Number(match?.[1]), seconds = Number(match?.[2]);
      if (match && Number.isSafeInteger(pid) && Number.isSafeInteger(seconds))
        return { state: 'running', pid, uptimeSeconds: seconds, error: null };
    }
    const down = 'down: ' + argument + ': ';
    if (line.startsWith(down) && /^\d+s(?:;|$)/.test(line.slice(down.length)))
      return { state: 'stopped', pid: null, uptimeSeconds: null, error: null };
    return { state: 'unknown', pid: null, uptimeSeconds: null, error: 'runit-status-invalid' };
  }

  private logs(resolved: string): IleStoiDiagnostics['logs'] {
    const candidates = [
      path.join(resolved, 'log/main/current'),
      path.join(this.logRoot, NAME, 'current'),
    ];
    for (const file of candidates) {
      let fd: number | null = null;
      try {
        const parent = lstatSync(path.dirname(file));
        const entry = lstatSync(file);
        if (!parent.isDirectory() || parent.isSymbolicLink() ||
            !entry.isFile() || entry.isSymbolicLink())
          return { state: 'unavailable', lines: [], error: 'unsafe-log-entry' };
        fd = openSync(file, 'r');
        const info = fstatSync(fd);
        if (!info.isFile() || info.size > 32 * 1024 * 1024)
          return { state: 'unavailable', lines: [], error: 'log-size-limit' };
        const count = Math.min(8192, info.size);
        const buffer = Buffer.alloc(count);
        const read = readSync(fd, buffer, 0, count, info.size - count);
        return { state: 'ok',
          lines: buffer.subarray(0, read).toString('utf8').split(/\r?\n/)
            .slice(-32).map(redactServiceLog),
          error: null };
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue;
        return { state: reason(error), lines: [], error: 'log-read-unavailable' };
      } finally {
        if (fd !== null) closeSync(fd);
      }
    }
    return { state: 'unavailable', lines: [], error: 'log-not-found' };
  }

  inspect(): IleStoiDiagnostics {
    const observation: IleStoiDiagnostics = {
      version: 1, mode: 'read-only', service: NAME, observedAt: this.now(),
      runit: { state: 'unknown', uptimeSeconds: null, error: 'service-unavailable' },
      process: null,
      health: { state: 'unverified', reason: 'no-confirmed-local-http-route' },
      logs: { state: 'unavailable', lines: [], error: 'service-unavailable' },
      notice: 'external-protected-no-lifecycle-control',
    };
    let service: ReturnType<IleStoiDiagnosticHost['service']>;
    try { service = this.service(); } catch { return observation; }
    const first = this.status(service.argument);
    observation.runit = {
      state: first.state, uptimeSeconds: first.uptimeSeconds, error: first.error,
    };
    observation.logs = this.logs(service.resolved);
    if (first.state !== 'running' || first.pid === null) return observation;
    try {
      const statA = parseProcessStat(this.readProc('/proc/' + first.pid + '/stat'), first.pid);
      const details = this.readProc('/proc/' + first.pid + '/status');
      const statB = parseProcessStat(this.readProc('/proc/' + first.pid + '/stat'), first.pid);
      const again = this.status(service.argument);
      if (!statA || !statB || statA.startTicks !== statB.startTicks ||
          again.state !== 'running' || again.pid !== first.pid) {
        observation.runit = { state: 'unknown', uptimeSeconds: null,
          error: 'process-identity-changed' };
        return observation;
      }
      const rssMiB = parseProcessRss(details);
      observation.process = {
        pid: first.pid, startTicks: statA.startTicks, name: parseProcessName(details),
        rssMiB, memoryState: rssMiB === null ? 'unavailable' : 'ok',
        identity: 'runit-consistent-not-owned',
      };
    } catch (error) {
      observation.runit.error = reason(error) === 'permission-denied'
        ? 'process-permission-denied' : 'process-unavailable';
    }
    return observation;
  }
}
