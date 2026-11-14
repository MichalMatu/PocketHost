import { closeSync, constants, fstatSync, lstatSync, openSync, readSync, realpathSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/** Bounded, read-only Termux task timing. Not a Git result or a service heartbeat. */
export type LatencyAlert =
  | 'uncertain-execution'
  | 'execution-timeout'
  | 'repeated-long-execution'
  | 'execution-regression';
export type LatencySample = {
  at: string;
  seconds: number | null;
  status: 'done' | 'failed' | 'unknown';
};
export interface LocalAgentLatencyDiagnostics {
  version: 1;
  source: 'termux-agent-local-task-spool';
  mode: 'event-driven';
  state: 'ok' | 'missing' | 'unavailable' | 'unsafe';
  observedAt: string | null;
  sampleCount: number;
  medianSeconds: number | null;
  p95Seconds: number | null;
  latestSeconds: number | null;
  alerts: LatencyAlert[];
  recent: LatencySample[];
}
const ALERTS: readonly LatencyAlert[] = [
  'uncertain-execution', 'execution-timeout',
  'repeated-long-execution', 'execution-regression',
];
const finiteSeconds = (value: unknown): value is number | null =>
  value === null || (typeof value === 'number' && Number.isFinite(value) &&
    value >= 0 && value <= 86400);
const validTime = (value: unknown): value is string =>
  typeof value === 'string' && value.length <= 50 &&
  /(?:Z|[+-]\d\d:\d\d)$/.test(value) && Number.isFinite(Date.parse(value));
const validStatus = (value: unknown): value is LatencySample['status'] =>
  value === 'done' || value === 'failed' || value === 'unknown';

const empty = (state: LocalAgentLatencyDiagnostics['state']): LocalAgentLatencyDiagnostics => ({
  version: 1, source: 'termux-agent-local-task-spool', mode: 'event-driven', state,
  observedAt: null, sampleCount: 0, medianSeconds: null, p95Seconds: null,
  latestSeconds: null, alerts: [], recent: [],
});

/** No Git, no task IDs, no raw commands, no process signaling or directory traversal. */
export class LocalAgentLatencyHost {
  private readonly home: string;
  constructor(home = os.homedir()) { this.home = home; }

  inspect(): LocalAgentLatencyDiagnostics {
    const root = path.join(this.home, '.local/state/local-agent/termux');
    const folder = path.join(root, 'observability');
    const file = path.join(folder, 'task-latency-v1.json');
    let fd: number | null = null;
    try {
      for (const dir of [
        this.home, path.join(this.home, '.local'), path.join(this.home, '.local/state'),
        path.join(this.home, '.local/state/local-agent'), root, folder,
      ]) {
        let stat;
        try { stat = lstatSync(dir); }
        catch (error) {
          if ((error as NodeJS.ErrnoException).code === 'ENOENT')
            return empty('missing');
          throw error;
        }
        if (!stat.isDirectory() || stat.isSymbolicLink() || realpathSync(dir) !== dir)
          return empty('unsafe');
      }
      let stat;
      try { stat = lstatSync(file); }
      catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return empty('missing');
        throw error;
      }
      if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 32768 ||
          stat.size === 0 || (stat.mode & 0o077) !== 0) return empty('unsafe');
      fd = openSync(file, constants.O_RDONLY | constants.O_NOFOLLOW);
      const opened = fstatSync(fd);
      if (!opened.isFile() || opened.size > 32768 || opened.size === 0 ||
          (opened.mode & 0o077) !== 0) return empty('unsafe');
      const buffer = Buffer.alloc(opened.size);
      const count = readSync(fd, buffer, 0, opened.size, 0);
      if (count !== opened.size) return empty('unavailable');
      const raw: unknown = JSON.parse(buffer.toString('utf8', 0, count));
      if (!raw || typeof raw !== 'object' || Array.isArray(raw))
        return empty('unsafe');
      const data = raw as Record<string, unknown>;
      if (data.version !== 1 || data.source !== 'termux-agent-local-task-spool' ||
          data.mode !== 'event-driven' || !Array.isArray(data.alerts) ||
          data.alerts.length > 4 || !data.alerts.every(value => ALERTS.includes(value)) ||
          !Number.isInteger(data.sampleCount) || (data.sampleCount as number) < 0 ||
          (data.sampleCount as number) > 40 || !Array.isArray(data.recent) ||
          data.recent.length > 10 || data.recent.length > (data.sampleCount as number) ||
          ![data.medianSeconds, data.p95Seconds, data.latestSeconds].every(finiteSeconds) ||
          !(data.observedAt === null || validTime(data.observedAt)) ||
          !data.recent.every(sample => sample && typeof sample === 'object' &&
            validTime(sample.at) && finiteSeconds(sample.seconds) &&
            validStatus(sample.status))) return empty('unsafe');

      // Deliberately project only aggregate values; never expose samples[].key,
      // task identifiers, commands, token-bearing source bytes or private paths.
      return {
        version: 1, source: 'termux-agent-local-task-spool', mode: 'event-driven',
        state: 'ok',
        observedAt: data.observedAt as string | null,
        sampleCount: data.sampleCount as number,
        medianSeconds: data.medianSeconds as number | null,
        p95Seconds: data.p95Seconds as number | null,
        latestSeconds: data.latestSeconds as number | null,
        alerts: [...data.alerts] as LatencyAlert[],
        recent: (data.recent as LatencySample[]).map(sample => ({
          at: sample.at, seconds: sample.seconds, status: sample.status,
        })),
      };
    } catch {
      return empty('unavailable');
    } finally {
      if (fd !== null) closeSync(fd);
    }
  }
}
