import { spawnSync } from 'node:child_process';
import { closeSync, constants, fstatSync, lstatSync, openSync, readFileSync, readSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { parseProcessRss, parseProcessStat } from './observability-probes.ts';

const PREFIX = '/data/data/com.termux/files/usr';
export const PROTECTED_DIAGNOSTIC_SERVICES = ['sshd', 'mosquitto', 'ilestoi-healthwatch'] as const;
export type ProtectedDiagnosticService = typeof PROTECTED_DIAGNOSTIC_SERVICES[number];
type Availability = 'ok' | 'unavailable' | 'permission-denied';
type RunitState = 'running' | 'stopped' | 'unknown';
type Command = (binary: string, args: string[]) => {
  status?: number | null; stdout?: string | Buffer; error?: Error;
};
type SettingName = 'port' | 'password-authentication' | 'listener' | 'anonymous-access';
type EventKind = 'started' | 'stopped' | 'failure' | 'connection' | 'health-result';

export interface ProtectedServiceDiagnostics {
  version: 1;
  mode: 'read-only';
  service: ProtectedDiagnosticService;
  observedAt: string;
  runit: { state: RunitState; uptimeSeconds: number | null; error: string | null };
  process: { pid: number; startTicks: string; rssMiB: number | null;
    identity: 'runit-consistent-not-owned' } | null;
  health: { state: 'unverified'; reason: 'runit-is-not-application-health-proof' };
  config: { state: Availability; scope: 'direct-file-not-effective-runtime' | 'not-observed';
    settings: { name: SettingName; value: string }[];
    truncated: boolean; error: 'not-found' | 'not-applicable' | 'unsafe-config' | 'read-unavailable' | null };
  logs: { state: Availability; events: { kind: EventKind; timestamp: string | null }[];
    error: 'not-found' | 'unsafe-log' | 'read-unavailable' | null };
  lastCheck: { state: 'unverified'; reason: 'no-independent-check-source' } | null;
  notice: 'external-protected-no-lifecycle-control';
}

const unavailable = (error: unknown): Availability =>
  ['EACCES', 'EPERM'].includes(String((error as NodeJS.ErrnoException | null)?.code))
    ? 'permission-denied' : 'unavailable';
const inside = (root: string, entry: string) => entry.startsWith(root + path.sep);
const validPort = (value: string) => {
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= 1 && number <= 65535;
};

/** Read a *non-effective* allowlist summary; never copy config source, paths or credentials. */
export function summarizeProtectedConfig(
  service: ProtectedDiagnosticService, raw: string,
): ProtectedServiceDiagnostics['config'] {
  const settings: ProtectedServiceDiagnostics['config']['settings'] = [];
  const lines = raw.split(/\r?\n/);
  for (const input of lines.slice(0, 256)) {
    const line = input.trim().replace(/\s+#.*$/, '').trim();
    if (!line || line.startsWith('#')) continue;
    let setting: { name: SettingName; value: string } | null = null;
    if (service === 'sshd') {
      const port = /^Port\s+(\d{1,5})$/i.exec(line);
      const password = /^PasswordAuthentication\s+(yes|no)$/i.exec(line);
      if (port && validPort(port[1]!)) setting = { name: 'port', value: port[1]! };
      if (password) setting = { name: 'password-authentication', value: password[1]!.toLowerCase() };
    } else if (service === 'mosquitto') {
      const listener = /^listener\s+(\d{1,5})(?:\s+\S+)?$/i.exec(line);
      const anonymous = /^allow_anonymous\s+(true|false)$/i.exec(line);
      if (listener && validPort(listener[1]!)) setting = { name: 'listener', value: listener[1]! };
      if (anonymous) setting = { name: 'anonymous-access', value: anonymous[1]!.toLowerCase() };
    }
    if (setting && settings.length < 8) settings.push(setting);
  }
  return { state: 'ok', scope: 'direct-file-not-effective-runtime', settings,
    truncated: lines.length > 256 || settings.length >= 8, error: null };
}

/** Only recognized event categories and parseable ISO timestamps cross the API boundary. */
export function classifyProtectedLog(line: string): { kind: EventKind; timestamp: string | null } | null {
  const kind: EventKind | null =
    /\b(error|failed|failure|fatal|denied)\b/i.test(line) ? 'failure' :
    /\b(healthcheck|health.check|checked|healthy|unhealthy)\b/i.test(line) ? 'health-result' :
    /\b(disconnect|closed|stopped|exiting|shutdown)\b/i.test(line) ? 'stopped' :
    /\b(connection|connected|accepted)\b/i.test(line) ? 'connection' :
    /\b(started|starting|listening|ready)\b/i.test(line) ? 'started' : null;
  if (!kind) return null;
  const match = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2}))/.exec(line);
  return { kind, timestamp: match && Number.isFinite(Date.parse(match[1]!))
    ? new Date(match[1]!).toISOString() : null };
}

/** Fixed runit observations only: no PID, path, command or service adoption through HTTP. */
export class ProtectedServiceDiagnosticHost {
  constructor(
    private readonly serviceRoot = path.join(PREFIX, 'var/service'),
    private readonly svRoot = path.join(PREFIX, 'var/sv'),
    private readonly logRoot = path.join(PREFIX, 'var/log/sv'),
    private readonly configRoot = path.join(PREFIX, 'etc'),
    private readonly command: Command = (binary, args) => spawnSync(binary, args, {
      encoding: 'utf8', shell: false, timeout: 1200, maxBuffer: 2048,
    }),
    private readonly procRead: (file: string) => string = file => readFileSync(file, 'utf8'),
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  private service(name: ProtectedDiagnosticService): { argument: string; resolved: string } {
    const root = lstatSync(this.serviceRoot);
    if (!root.isDirectory() || root.isSymbolicLink()) throw Error('unsafe-service-root');
    const argument = path.join(this.serviceRoot, name);
    const entry = lstatSync(argument);
    if (!entry.isDirectory() && !entry.isSymbolicLink()) throw Error('unsafe-service-entry');
    const resolved = realpathSync(argument);
    let canonicalSv: string | null = null;
    try { canonicalSv = realpathSync(this.svRoot); } catch { /* not required */ }
    if (!lstatSync(resolved).isDirectory() || path.basename(resolved) !== name ||
        !(inside(realpathSync(this.serviceRoot), resolved) ||
          (canonicalSv !== null && inside(canonicalSv, resolved))))
      throw Error('foreign-service-target');
    return { argument, resolved };
  }

  private status(argument: string) {
    const base: { state: RunitState; pid: number | null;
      uptimeSeconds: number | null; error: string | null } =
      { state: 'unknown', pid: null, uptimeSeconds: null, error: 'runit-unavailable' };
    const result = this.command(path.join(PREFIX, 'bin/sv'), ['status', argument]);
    if (result.error || result.status !== 0 || typeof result.stdout !== 'string')
      return { ...base, error: (result.error as NodeJS.ErrnoException | undefined)?.code === 'ETIMEDOUT'
        ? 'runit-timeout' : 'runit-unavailable' };
    const output = result.stdout.trim();
    const running = 'run: ' + argument + ': ';
    const stopped = 'down: ' + argument + ': ';
    if (output.startsWith(running)) {
      const match = /^\(pid ([1-9]\d*)\) (\d+)s(?:;|$)/.exec(output.slice(running.length));
      const pid = Number(match?.[1]), seconds = Number(match?.[2]);
      if (match && Number.isSafeInteger(pid) && Number.isSafeInteger(seconds))
        return { state: 'running' as const, pid, uptimeSeconds: seconds, error: null };
    }
    if (output.startsWith(stopped) && /^\d+s(?:;|$)/.test(output.slice(stopped.length)))
      return { state: 'stopped' as const, pid: null, uptimeSeconds: null, error: null };
    return { ...base, error: 'runit-status-invalid' };
  }

  private config(name: ProtectedDiagnosticService): ProtectedServiceDiagnostics['config'] {
    const empty: ProtectedServiceDiagnostics['config'] = { state: 'unavailable',
      scope: 'not-observed', settings: [], truncated: false, error: 'not-found' };
    if (name === 'ilestoi-healthwatch') return { ...empty, error: 'not-applicable' };
    const directory = path.join(this.configRoot, name === 'sshd' ? 'ssh' : 'mosquitto');
    const file = path.join(directory, name === 'sshd' ? 'sshd_config' : 'mosquitto.conf');
    let fd: number | null = null;
    try {
      for (const folder of [this.configRoot, directory]) {
        const info = lstatSync(folder);
        if (!info.isDirectory() || info.isSymbolicLink()) return { ...empty, error: 'unsafe-config' };
      }
      const entry = lstatSync(file);
      if (!entry.isFile() || entry.isSymbolicLink() || entry.size > 65536)
        return { ...empty, error: 'unsafe-config' };
      fd = openSync(file, constants.O_RDONLY | constants.O_NOFOLLOW);
      const info = fstatSync(fd);
      if (!info.isFile() || info.size > 65536) return { ...empty, error: 'unsafe-config' };
      const buffer = Buffer.alloc(info.size);
      const count = readSync(fd, buffer, 0, info.size, 0);
      return summarizeProtectedConfig(name, buffer.subarray(0, count).toString('utf8'));
    } catch (error) {
      return { ...empty, state: unavailable(error),
        error: (error as NodeJS.ErrnoException).code === 'ENOENT' ? 'not-found' : 'read-unavailable' };
    } finally { if (fd !== null) closeSync(fd); }
  }

  private logs(name: ProtectedDiagnosticService, resolved: string): ProtectedServiceDiagnostics['logs'] {
    const candidates = [path.join(resolved, 'log/main/current'),
      path.join(this.logRoot, name, 'current')];
    for (const [index, file] of candidates.entries()) {
      let fd: number | null = null;
      try {
        const parents = index === 0
          ? [path.join(resolved, 'log'), path.join(resolved, 'log/main')]
          : [this.logRoot, path.join(this.logRoot, name)];
        for (const parent of parents) {
          const entry = lstatSync(parent);
          if (!entry.isDirectory() || entry.isSymbolicLink())
            return { state: 'unavailable', events: [], error: 'unsafe-log' };
        }
        const entry = lstatSync(file);
        if (!entry.isFile() || entry.isSymbolicLink() || entry.size > 32 * 1024 * 1024)
          return { state: 'unavailable', events: [], error: 'unsafe-log' };
        fd = openSync(file, constants.O_RDONLY | constants.O_NOFOLLOW);
        const info = fstatSync(fd);
        if (!info.isFile() || info.size > 32 * 1024 * 1024)
          return { state: 'unavailable', events: [], error: 'unsafe-log' };
        const bytes = Math.min(8192, info.size);
        const buffer = Buffer.alloc(bytes);
        const count = readSync(fd, buffer, 0, bytes, info.size - bytes);
        return { state: 'ok', events: buffer.subarray(0, count).toString('utf8')
          .split(/\r?\n/).slice(-64).map(classifyProtectedLog)
          .filter((event): event is NonNullable<typeof event> => event !== null).slice(-16), error: null };
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue;
        return { state: unavailable(error), events: [], error: 'read-unavailable' };
      } finally { if (fd !== null) closeSync(fd); }
    }
    return { state: 'unavailable', events: [], error: 'not-found' };
  }

  inspect(name: ProtectedDiagnosticService): ProtectedServiceDiagnostics {
    // Runtime allowlist as well as the compile-time type: never join an arbitrary URL value.
    if (!PROTECTED_DIAGNOSTIC_SERVICES.includes(name)) throw new RangeError('unsupported-service');
    const result: ProtectedServiceDiagnostics = {
      version: 1, mode: 'read-only', service: name, observedAt: this.now(),
      runit: { state: 'unknown', uptimeSeconds: null, error: 'service-unavailable' },
      process: null,
      health: { state: 'unverified', reason: 'runit-is-not-application-health-proof' },
      config: this.config(name),
      logs: { state: 'unavailable', events: [], error: 'not-found' },
      lastCheck: name === 'ilestoi-healthwatch'
        ? { state: 'unverified', reason: 'no-independent-check-source' } : null,
      notice: 'external-protected-no-lifecycle-control',
    };
    let target: { argument: string; resolved: string };
    try { target = this.service(name); } catch { return result; }
    const first = this.status(target.argument);
    result.runit = { state: first.state, uptimeSeconds: first.uptimeSeconds, error: first.error };
    result.logs = this.logs(name, target.resolved);
    if (first.state !== 'running' || first.pid === null) return result;
    try {
      const before = parseProcessStat(this.procRead('/proc/' + first.pid + '/stat'), first.pid);
      const rss = parseProcessRss(this.procRead('/proc/' + first.pid + '/status'));
      const after = parseProcessStat(this.procRead('/proc/' + first.pid + '/stat'), first.pid);
      const latest = this.status(target.argument);
      if (!before || !after || before.startTicks !== after.startTicks ||
          latest.state !== 'running' || latest.pid !== first.pid) {
        result.runit = { state: 'unknown', uptimeSeconds: null, error: 'process-identity-changed' };
        return result;
      }
      result.process = { pid: first.pid, startTicks: before.startTicks, rssMiB: rss,
        identity: 'runit-consistent-not-owned' };
    } catch (error) {
      result.runit.error = unavailable(error) === 'permission-denied'
        ? 'process-permission-denied' : 'process-unavailable';
    }
    return result;
  }
}
