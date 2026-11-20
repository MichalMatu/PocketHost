import { closeSync, constants, fstatSync, lstatSync, openSync, readSync, realpathSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { LocalAgentLatencyHost, type LocalAgentLatencyDiagnostics } from './local-agent-latency-diagnostics.ts';

/**
 * The installed Termux Agent's dedicated private svlogd current file.
 * No user-controlled path, process signaling, raw log output or Git fetch.
 */
export type AgentLogKind =
  'budget' | 'failed' | 'timeout' | 'interrupted' | 'published' |
  'claim' | 'transport' | 'service';

export type AgentLogEvent = {
  kind: AgentLogKind;
  message: string;
  timestamp: string | null;
};

export interface AgentLogDisplayLine {
  kind: AgentLogKind | 'other';
  text: string;
  timestamp: string | null;
}

export interface LocalAgentLogDiagnostics {
  version: 1;
  mode: 'read-only';
  observedAt: string;
  source: 'private-runit-svlogd';
  state: 'ok' | 'missing' | 'unavailable' | 'unsafe-log';
  events: AgentLogEvent[];
  lines: AgentLogDisplayLine[];
  unclassifiedLines: number;
  truncated: boolean;
  notice: 'sanitized-log-tail-no-lifecycle-authority';
  latency: LocalAgentLatencyDiagnostics;
}

const LABELS: Record<AgentLogKind, string> = {
  budget: 'Task stopped by execution budget',
  failed: 'Agent reported an error or failed task',
  timeout: 'Agent operation timed out',
  interrupted: 'Operation stopped or execution became uncertain',
  published: 'Result publication activity',
  claim: 'Task claim activity',
  transport: 'Git transport activity',
  service: 'Agent service activity',
};

function agentLogTime(line: string): string | null {
  const iso = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2}))(?=\s|$)/.exec(line);
  // svlogd -tt uses UTC YYYY-MM-DD_HH:MM:SS.fraction, not ISO T/Z.
  const runit = /^(\d{4}-\d{2}-\d{2})_(\d{2}:\d{2}:\d{2})(?:\.(\d{1,9}))?(?=\s|$)/.exec(line);
  const rawTime = iso?.[1] ?? (runit
    ? runit[1] + 'T' + runit[2] +
      '.' + (runit[3] ?? '0').padEnd(3, '0').slice(0, 3) + 'Z'
    : null);
  const parsed = rawTime === null ? NaN : Date.parse(rawTime);
  const valid = Number.isFinite(parsed) && (!runit ||
    new Date(parsed).toISOString().startsWith(runit[1] + 'T' + runit[2]));
  return valid ? new Date(parsed).toISOString() : null;
}

/** No captured group, original line, paths or user-supplied text crosses the API. */
export function classifyAgentLogLine(line: string): AgentLogEvent | null {
  const kind: AgentLogKind | null =
    /task_budget_exhausted|budget[ _-]+exhausted|budget[ _-]*remaining/i.test(line) ? 'budget' :
    /\b(timeout|timed.out|deadline.exceeded)\b/i.test(line) ? 'timeout' :
    /\b(unknown|suspend|interrupted|emergency.stop)\b/i.test(line) ? 'interrupted' :
    (/\b(failed|failure|error|exception|traceback|fatal)\b/i.test(line) ||
      /\bexec finished exit=[1-9]\d*\b/i.test(line)) ? 'failed' :
    /\b(published|publishing|publish.pending|result.publication)\b/i.test(line) ? 'published' :
    /\b(claimed|claiming|task.claim)\b/i.test(line) ? 'claim' :
    /\b(git.fetch|git.push|git.transport|remote.ref|git.error)\b/i.test(line) ? 'transport' :
    /\b(started|starting|stopped|serving|polling|service.ready)\b/i.test(line) ? 'service' : null;
  if (!kind) return null;
  return { kind, message: LABELS[kind], timestamp: agentLogTime(line) };
}

/**
 * Display real service-log chronology, but reconstruct only known safe fields
 * from the Linux Core logger. A log may contain a command, credentials, user
 * data or an exception body; never echo unknown bytes over the unauthenticated
 * LAN API.
 */
export function safeAgentLogLine(line: string): AgentLogDisplayLine | null {
  if (!line.trim()) return null;
  const event = classifyAgentLogLine(line);
  const timestamp = agentLogTime(line);
  const content = line.replace(
    /^(?:\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})|\d{4}-\d{2}-\d{2}_\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?)\s+/,
    '',
  ).replace(/^\[linux-agent\] /, '');
  // These grammars match only safe fields emitted by the Linux Core logger.
  const hash = 'command sha256=([a-f0-9]{16})';
  const seconds = '(\\d{1,6}(?:\\.\\d{1,3})?)';
  const rules: Array<[RegExp, (parts: RegExpExecArray) => string]> = [
    [new RegExp('^exec: ' + hash + '$'), m => 'exec: command sha256=' + m[1]],
    [new RegExp('^exec finished exit=(\\d{1,3}) elapsed=' + seconds + 's: ' + hash + '$'),
      m => 'exec finished · exit=' + m[1] + ' · ' + m[2] + 's · sha256=' + m[3]],
    [/^output summary stage=command-(\d{1,3}) exit=(\d{1,3}) captured_chars=(\d{1,8})(?:; showing bounded tail)?$/,
      m => 'output summary · command-' + m[1] + ' · exit=' + m[2] + ' · captured=' + m[3] + ' chars'],
    [/^TASK BUDGET EXHAUSTED before stage command-(\d{1,3}): remaining=(\d{1,6}(?:\.\d)?)s required=(\d{1,6}(?:\.\d)?)s$/,
      m => 'budget exhausted · command-' + m[1] + ' · remaining=' + m[2] + 's · required=' + m[3] + 's'],
    [new RegExp('^(IDLE TIMEOUT|TIMEOUT) after ' + seconds + 's: ' + hash + '$'),
      m => m[1].toLowerCase() + ' · after ' + m[2] + 's · sha256=' + m[3]],
    [new RegExp('^MEMORY LIMIT after (\\d{1,3}) samples at ' + seconds + ' MB: ' + hash + '$'),
      m => 'memory limit · ' + m[1] + ' samples · ' + m[2] + ' MB · sha256=' + m[3]],
    [/^RSS memory measurement unavailable; continuing with time watchdogs$/,
      () => 'RSS unavailable · time watchdogs still enabled'],
    [/^termux-agent: latency history unavailable \([A-Za-z]{1,45}\)$/,
      () => 'Termux latency history unavailable'],
  ];
  for (const [rule, makeText] of rules) {
    const parts = rule.exec(content);
    if (parts) return { kind: event?.kind ?? 'service', text: makeText(parts).slice(0, 180),
      timestamp };
  }
  // Unknown content is deliberately never copied to an unauthenticated LAN.
  return { kind: event?.kind ?? 'other',
    text: event?.message ?? 'Agent log entry (private or unsupported detail hidden)',
    timestamp };
}

export class LocalAgentLogHost {
  private readonly home: string;
  private readonly now: () => string;
  constructor(
    home = os.homedir(),
    now: () => string = () => new Date().toISOString(),
  ) {
    this.home = home;
    this.now = now;
  }

  inspect(): LocalAgentLogDiagnostics {
    const result: LocalAgentLogDiagnostics = {
      version: 1, mode: 'read-only', observedAt: this.now(),
      source: 'private-runit-svlogd',
      state: 'unavailable', events: [], lines: [], unclassifiedLines: 0, truncated: false,
      notice: 'sanitized-log-tail-no-lifecycle-authority',
      latency: new LocalAgentLatencyHost(this.home).inspect(),
    };
    const root = path.join(this.home, '.local/state/local-agent/termux');
    let fd: number | null = null;
    try {
      // Installed services differ in their private svlogd layout. Inspect
      // only these fixed paths; never parse and execute the service log script.
      const base = path.join(root, 'runit');
      const candidates = [
        // Verified on the installed Samsung: svlogd -tt <private runit>/logs/agent.
        path.join(base, 'logs/agent/current'),
        // Legacy dedicated runit configurations, never arbitrary filesystem roots.
        path.join(base, 'log/termux-agent/current'),
        path.join(base, 'log/termux-agent/main/current'),
        path.join(base, 'services/termux-agent/log/main/current'),
        path.join(base, 'services/termux-agent/log/current'),
      ];
      const stableParents = [this.home, path.join(this.home, '.local'),
        path.join(this.home, '.local/state'),
        path.join(this.home, '.local/state/local-agent'), root, base];
      for (const directory of stableParents) {
        const stat = lstatSync(directory);
        if (!stat.isDirectory() || stat.isSymbolicLink() ||
            realpathSync(directory) !== directory) {
          result.state = 'unsafe-log';
          return result;
        }
      }
      let file: string | null = null;
      for (const candidate of candidates) {
        const parts = path.relative(base, path.dirname(candidate)).split(path.sep);
        let folder = base;
        let absent = false;
        for (const part of parts) {
          folder = path.join(folder, part);
          try {
            const entry = lstatSync(folder);
            if (!entry.isDirectory() || entry.isSymbolicLink() ||
                realpathSync(folder) !== folder) {
              result.state = 'unsafe-log';
              return result;
            }
          } catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
              absent = true;
              break;
            }
            throw error;
          }
        }
        if (absent) continue;
        try {
          lstatSync(candidate);
          file = candidate;
          break;
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
        }
      }
      if (file === null) {
        result.state = 'missing';
        return result;
      }
      const stat = lstatSync(file);
      if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 32 * 1024 * 1024) {
        result.state = 'unsafe-log';
        return result;
      }
      fd = openSync(file, constants.O_RDONLY | constants.O_NOFOLLOW);
      const opened = fstatSync(fd);
      if (!opened.isFile() || opened.size > 32 * 1024 * 1024) {
        result.state = 'unsafe-log';
        return result;
      }
      // Read only a small suffix, never rotated archives or arbitrary paths.
      const bytes = Math.min(48 * 1024, opened.size);
      const offset = opened.size - bytes;
      const buffer = Buffer.alloc(bytes);
      const count = readSync(fd, buffer, 0, bytes, offset);
      const raw = buffer.toString('utf8', 0, count);
      const lines = raw.split(/\r?\n/);
      if (offset > 0) lines.shift(); // skip incomplete first log record
      result.truncated = offset > 0;
      const completeLines = lines.filter(line => line.trim());
      const last = completeLines.slice(-120);
      result.truncated ||= completeLines.length > 120;
      const events: AgentLogEvent[] = [];
      for (const line of last) {
        if (!line.trim()) continue;
        const event = classifyAgentLogLine(line);
        const display = safeAgentLogLine(line);
        if (event) events.push(event);
        else result.unclassifiedLines++;
        if (display) result.lines.push(display);
      }
      result.events = events.slice(-30);
      result.state = 'ok';
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      result.state = code === 'ENOENT' ? 'missing' : 'unavailable';
    } finally {
      if (fd !== null) closeSync(fd);
    }
    return result;
  }
}
