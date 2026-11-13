import { spawnSync } from 'node:child_process';
import { closeSync, constants, fstatSync, lstatSync, openSync, readSync, realpathSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseProcessRss, parseProcessStat } from './observability-probes.ts';

const PREFIX = '/data/data/com.termux/files/usr';
const SERVICE = 'cloudflared';
type Availability = 'ok' | 'unavailable' | 'permission-denied';
type RunitState = 'running' | 'stopped' | 'unknown';
type Command = (binary: string, args: string[]) => {
  status?: number | null; stdout?: string | Buffer; error?: Error;
};
export interface CloudflareTunnelDiagnostics {
  version: 1;
  mode: 'read-only';
  service: 'cloudflared';
  observedAt: string;
  runit: { state: RunitState; uptimeSeconds: number | null; error: string | null };
  process: { pid: number; startTicks: string; rssMiB: number | null;
    identity: 'runit-consistent-not-owned' } | null;
  config: {
    state: Availability;
    tunnelDeclared: boolean | null;
    credentialsFileDeclared: boolean | null;
    ingress: { hostname: string; backend: 'http' | 'https' | 'ssh' | 'tcp' | 'other' }[];
    truncated: boolean;
    error: 'not-found' | 'unsafe-config' | 'read-unavailable' | null;
  };
  connections: {
    state: 'unverified';
    reason: 'runit-is-not-tunnel-connection-proof';
    lastEvent: 'registered' | 'disconnected' | 'failure' | 'none';
  };
  logs: {
    state: Availability;
    events: { kind: 'registered' | 'disconnected' | 'failure'; timestamp: string | null }[];
    error: 'not-found' | 'unsafe-log' | 'read-unavailable' | null;
  };
  notice: 'external-protected-no-lifecycle-control';
}
const unavailable = (error: unknown): Availability => {
  const code = (error as NodeJS.ErrnoException | null)?.code;
  return code === 'EACCES' || code === 'EPERM' ? 'permission-denied' : 'unavailable';
};
const inside = (root: string, file: string) => file.startsWith(root + path.sep);

/** Fixed, safe allowlisted subset; never returns URLs, tokens, paths or raw YAML. */
export function summarizeTunnelConfig(raw: string): CloudflareTunnelDiagnostics['config'] {
  const ingress: CloudflareTunnelDiagnostics['config']['ingress'] = [];
  let inIngress = false;
  let count = 0;
  let activeRoute: number | null = null;
  let tunnelDeclared = false;
  let credentialsFileDeclared = false;
  for (const line of raw.split(/\r?\n/).slice(0, 512)) {
    if (/^\s*#/.test(line)) continue;
    if (/^ingress:\s*(?:#.*)?$/.test(line)) { inIngress = true; continue; }
    if (/^[a-z][\w-]*\s*:/.test(line)) { inIngress = false; activeRoute = null; }
    if (/^tunnel:\s*\S+/.test(line)) tunnelDeclared = true;
    if (/^credentials-file:\s*\S+/.test(line)) credentialsFileDeclared = true;
    if (!inIngress) continue;
    const entry = /^\s*-\s*hostname:\s*(.*?)\s*(?:#.*)?$/.exec(line);
    if (entry) {
      activeRoute = null;
      const value = (entry[1] ?? '').trim().replace(/^['"]|['"]$/g, '').toLowerCase();
      if (/^(?:\*\.)?(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(value)) {
        count++;
        if (ingress.length < 12) {
          ingress.push({ hostname: value, backend: 'other' });
          activeRoute = ingress.length - 1;
        }
      }
      continue;
    }
    const backendLine = /^\s*service:\s*(.*?)\s*(?:#.*)?$/.exec(line);
    if (backendLine && activeRoute !== null) {
      const kind = /^(https?|ssh|tcp):\/\//.exec(backendLine[1] ?? '')?.[1];
      ingress[activeRoute]!.backend =
        kind === 'http' || kind === 'https' || kind === 'ssh' || kind === 'tcp' ? kind : 'other';
    }
  }
  return {
    state: 'ok', tunnelDeclared, credentialsFileDeclared,
    ingress, truncated: count > 12 || raw.split('\n').length > 512, error: null,
  };
}

/** Converts untrusted cloudflared log text exclusively to recognized event kinds. */
export function classifyTunnelLog(line: string):
  CloudflareTunnelDiagnostics['logs']['events'][number] | null {
  const kind = /registered tunnel connection/i.test(line) &&
    !/unregistered/i.test(line) ? 'registered' :
    /unregistered tunnel connection|connection terminated|connection closed|connection dropped/i.test(line)
      ? 'disconnected' :
    /\b(ERR|error|failed|retrying)\b/i.test(line) ? 'failure' : null;
  if (!kind) return null;
  const match = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2}))/.exec(line);
  const date = match && Number.isFinite(Date.parse(match[1]!)) ? new Date(match[1]!).toISOString() : null;
  return { kind, timestamp: date };
}

/** No service adoption and no lifecycle API; all paths/commands are fixed. */
export class CloudflareTunnelDiagnosticHost {
  private readonly serviceRoot: string;
  private readonly svRoot: string;
  private readonly logRoot: string;
  private readonly configPath: string;
  private readonly command: Command;
  private readonly procRead: (file: string) => string;
  private readonly now: () => string;

  constructor(
    serviceRoot = path.join(PREFIX, 'var/service'),
    svRoot = path.join(PREFIX, 'var/sv'),
    logRoot = path.join(PREFIX, 'var/log/sv'),
    configPath = path.join(os.homedir(), '.cloudflared/config.yml'),
    command: Command = (binary, args) => spawnSync(binary, args, {
      encoding: 'utf8', shell: false, timeout: 1200, maxBuffer: 2048,
    }),
    procRead: (file: string) => string = file => readFileSync(file, 'utf8'),
    now: () => string = () => new Date().toISOString(),
  ) {
    this.serviceRoot = serviceRoot;
    this.svRoot = svRoot;
    this.logRoot = logRoot;
    this.configPath = configPath;
    this.command = command;
    this.procRead = procRead;
    this.now = now;
  }

  private service(): { path: string; resolved: string } {
    const root = lstatSync(this.serviceRoot);
    if (!root.isDirectory() || root.isSymbolicLink()) throw Error('unsafe-service-root');
    const entry = path.join(this.serviceRoot, SERVICE);
    const stat = lstatSync(entry);
    if (!stat.isDirectory() && !stat.isSymbolicLink()) throw Error('unsafe-service-entry');
    const resolved = realpathSync(entry);
    let sv: string | null = null;
    try { sv = realpathSync(this.svRoot); } catch { /* optional */ }
    if (!lstatSync(resolved).isDirectory() || path.basename(resolved) !== SERVICE ||
        !(inside(realpathSync(this.serviceRoot), resolved) || (sv !== null && inside(sv, resolved))))
      throw Error('foreign-service-target');
    return { path: entry, resolved };
  }

  private status(service: string): {
    state: RunitState; pid: number | null; uptimeSeconds: number | null; error: string | null;
  } {
    const result = this.command(path.join(PREFIX, 'bin/sv'), ['status', service]);
    const base = { state: 'unknown' as const, pid: null, uptimeSeconds: null };
    if (result.error || result.status !== 0 || typeof result.stdout !== 'string')
      return { ...base, error: (result.error as NodeJS.ErrnoException | undefined)?.code === 'ETIMEDOUT'
        ? 'runit-timeout' : 'runit-unavailable' };
    const run = 'run: ' + service + ': ';
    const down = 'down: ' + service + ': ';
    const line = result.stdout.trim();
    if (line.startsWith(run)) {
      const match = /^\(pid ([1-9]\d*)\) (\d+)s(?:;|$)/.exec(line.slice(run.length));
      const pid = Number(match?.[1]), seconds = Number(match?.[2]);
      if (match && Number.isSafeInteger(pid) && Number.isSafeInteger(seconds))
        return { state: 'running', pid, uptimeSeconds: seconds, error: null };
    }
    if (line.startsWith(down) && /^\d+s(?:;|$)/.test(line.slice(down.length)))
      return { state: 'stopped', pid: null, uptimeSeconds: null, error: null };
    return { ...base, error: 'runit-status-invalid' };
  }

  private config(): CloudflareTunnelDiagnostics['config'] {
    const missing: CloudflareTunnelDiagnostics['config'] = {
      state: 'unavailable', tunnelDeclared: null, credentialsFileDeclared: null,
      ingress: [], truncated: false, error: 'not-found',
    };
    let fd: number | null = null;
    try {
      const dir = lstatSync(path.dirname(this.configPath));
      const entry = lstatSync(this.configPath);
      if (!dir.isDirectory() || dir.isSymbolicLink() || !entry.isFile() || entry.isSymbolicLink())
        return { ...missing, error: 'unsafe-config' };
      if (entry.size > 32768) return { ...missing, error: 'unsafe-config' };
      fd = openSync(this.configPath, constants.O_RDONLY | constants.O_NOFOLLOW);
      const info = fstatSync(fd);
      if (!info.isFile() || info.size > 32768) return { ...missing, error: 'unsafe-config' };
      const buffer = Buffer.alloc(info.size);
      const bytes = readSync(fd, buffer, 0, info.size, 0);
      return summarizeTunnelConfig(buffer.subarray(0, bytes).toString('utf8'));
    } catch (error) {
      return { ...missing, state: unavailable(error),
        error: (error as NodeJS.ErrnoException).code === 'ENOENT' ? 'not-found' : 'read-unavailable' };
    } finally { if (fd !== null) closeSync(fd); }
  }

  private logs(resolved: string): CloudflareTunnelDiagnostics['logs'] {
    const candidates = [path.join(resolved, 'log/main/current'),
      path.join(this.logRoot, SERVICE, 'current')];
    for (const [index, file] of candidates.entries()) {
      let fd: number | null = null;
      try {
        const parents = index === 0
          ? [path.join(resolved, 'log'), path.join(resolved, 'log/main')]
          : [this.logRoot, path.join(this.logRoot, SERVICE)];
        for (const folder of parents) {
          const info = lstatSync(folder);
          if (!info.isDirectory() || info.isSymbolicLink())
            return { state: 'unavailable', events: [], error: 'unsafe-log' };
        }
        const entry = lstatSync(file);
        if (!entry.isFile() || entry.isSymbolicLink() || entry.size > 32 * 1024 * 1024)
          return { state: 'unavailable', events: [], error: 'unsafe-log' };
        fd = openSync(file, constants.O_RDONLY | constants.O_NOFOLLOW);
        const info = fstatSync(fd);
        if (!info.isFile() || info.size > 32 * 1024 * 1024)
          return { state: 'unavailable', events: [], error: 'unsafe-log' };
        const len = Math.min(info.size, 8192);
        const buffer = Buffer.alloc(len);
        const count = readSync(fd, buffer, 0, len, info.size - len);
        return {
          state: 'ok',
          events: buffer.subarray(0, count).toString('utf8').split(/\r?\n/)
            .slice(-64).map(classifyTunnelLog)
            .filter((event): event is NonNullable<typeof event> => event !== null).slice(-16),
          error: null,
        };
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue;
        return { state: unavailable(error), events: [], error: 'read-unavailable' };
      } finally { if (fd !== null) closeSync(fd); }
    }
    return { state: 'unavailable', events: [], error: 'not-found' };
  }

  inspect(): CloudflareTunnelDiagnostics {
    const result: CloudflareTunnelDiagnostics = {
      version: 1, mode: 'read-only', service: SERVICE, observedAt: this.now(),
      runit: { state: 'unknown', uptimeSeconds: null, error: 'service-unavailable' },
      process: null,
      config: this.config(),
      connections: { state: 'unverified',
        reason: 'runit-is-not-tunnel-connection-proof', lastEvent: 'none' },
      logs: { state: 'unavailable', events: [], error: 'not-found' },
      notice: 'external-protected-no-lifecycle-control',
    };
    let service: ReturnType<CloudflareTunnelDiagnosticHost['service']>;
    try { service = this.service(); } catch { return result; }
    const status = this.status(service.path);
    result.runit = { state: status.state, uptimeSeconds: status.uptimeSeconds, error: status.error };
    result.logs = this.logs(service.resolved);
    const lastEvent = result.logs.events.at(-1)?.kind;
    result.connections.lastEvent = lastEvent ?? 'none';
    if (status.state !== 'running' || status.pid === null) return result;
    try {
      const before = parseProcessStat(this.procRead('/proc/' + status.pid + '/stat'), status.pid);
      const rss = parseProcessRss(this.procRead('/proc/' + status.pid + '/status'));
      const after = parseProcessStat(this.procRead('/proc/' + status.pid + '/stat'), status.pid);
      const latest = this.status(service.path);
      if (!before || !after || before.startTicks !== after.startTicks ||
          latest.state !== 'running' || latest.pid !== status.pid) {
        result.runit = { state: 'unknown', uptimeSeconds: null, error: 'process-identity-changed' };
        return result;
      }
      result.process = { pid: status.pid, startTicks: before.startTicks, rssMiB: rss,
        identity: 'runit-consistent-not-owned' };
    } catch (error) {
      result.runit.error = unavailable(error) === 'permission-denied'
        ? 'process-permission-denied' : 'process-unavailable';
    }
    return result;
  }
}
