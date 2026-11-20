import { timingSafeEqual } from 'node:crypto';
import { closeSync, constants, fstatSync, lstatSync, openSync, readFileSync,
  readSync, realpathSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * Exact bytes from the dedicated Termux Agent svlogd current file.
 * This class MUST ONLY be called from an owner-authenticated private route.
 * Never expose it through the ordinary unauthenticated PocketHost LAN API.
 */
const CHUNK = 128 * 1024;
const MAX_FILE = 32 * 1024 * 1024;
const FILES = [
  'runit/log/termux-agent/current',
  'runit/logs/agent/current',
  'runit/log/termux-agent/main/current',
  'runit/services/termux-agent/log/main/current',
  'runit/services/termux-agent/log/current',
] as const;

export interface RawAgentLogChunk {
  version: 1;
  source: 'termux-agent-svlogd-current';
  state: 'ok' | 'missing' | 'unsafe' | 'unavailable';
  /** A byte-for-byte UTF-8 rendering of complete lines; no filtering or time conversion. */
  text: string;
  cursor: string | null;
  truncated: boolean;
  reset: boolean;
}

function privateDirectory(folder: string): boolean {
  const stat = lstatSync(folder);
  return stat.isDirectory() && !stat.isSymbolicLink() &&
    stat.uid === process.getuid?.() && realpathSync(folder) === folder;
}

/**
 * Token must already exist in Termux private storage as an owner-created
 * 0600 file. Not configured = disabled. Never returned in any response.
 */
export function rawAgentLogSecret(home = os.homedir()): string | null {
  try {
    const config = path.join(home, '.config');
    const folder = path.join(config, 'pockethost');
    if (![home, config, folder].every(privateDirectory)) return null;
    const file = path.join(folder, 'raw-agent-log.token');
    const stat = lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink() ||
        stat.uid !== process.getuid?.() || (stat.mode & 0o777) !== 0o600 ||
        stat.size < 64 || stat.size > 66) return null;
    const value = readFileSync(file, 'utf8').trim();
    return /^[a-f0-9]{64}$/.test(value) ? value : null;
  } catch {
    return null;
  }
}

export function rawAgentLogAuthorized(stored: string | null, supplied: unknown): boolean {
  if (!stored || typeof supplied !== 'string' ||
      !/^[a-f0-9]{64}$/.test(supplied)) return false;
  return timingSafeEqual(Buffer.from(stored, 'ascii'), Buffer.from(supplied, 'ascii'));
}

export class LocalAgentRawLogHost {
  constructor(private readonly home = os.homedir()) {}

  read(previous?: string): RawAgentLogChunk {
    const result: RawAgentLogChunk = {
      version: 1, source: 'termux-agent-svlogd-current', state: 'unavailable',
      text: '', cursor: null, truncated: false, reset: false,
    };
    const root = path.join(this.home, '.local/state/local-agent/termux');
    const base = path.join(root, 'runit');
    let fd: number | null = null;
    try {
      const parentParts = [
        this.home, path.join(this.home, '.local'),
        path.join(this.home, '.local/state'),
        path.join(this.home, '.local/state/local-agent'), root, base,
      ];
      if (!parentParts.every(privateDirectory)) {
        result.state = 'unsafe'; return result;
      }
      let located: string | null = null;
      for (const name of FILES) {
        const parts = name.split('/');
        let directory = root;
        let missing = false;
        for (const part of parts.slice(0, -1)) {
          directory = path.join(directory, part);
          try { if (!privateDirectory(directory)) { result.state = 'unsafe'; return result; } }
          catch (e) {
            if ((e as NodeJS.ErrnoException).code === 'ENOENT') { missing = true; break; }
            throw e;
          }
        }
        if (missing) continue;
        const candidate = path.join(root, name);
        try { lstatSync(candidate); located = candidate; break; }
        catch (e) {
          if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
        }
      }
      if (!located) { result.state = 'missing'; return result; }
      const initial = lstatSync(located);
      if (!initial.isFile() || initial.isSymbolicLink() ||
          initial.uid !== process.getuid?.() || initial.size > MAX_FILE) {
        result.state = 'unsafe'; return result;
      }
      fd = openSync(located, constants.O_RDONLY | constants.O_NOFOLLOW);
      const st = fstatSync(fd);
      if (!st.isFile() || st.ino !== initial.ino || st.dev !== initial.dev ||
          st.size > MAX_FILE || st.uid !== process.getuid?.()) {
        result.state = 'unsafe'; return result;
      }
      const identity = String(st.dev) + ':' + String(st.ino);
      const prev = /^(\d+):(\d+):(\d+)$/.exec(previous ?? '');
      const canResume = prev && prev[1] + ':' + prev[2] === identity &&
        Number.isSafeInteger(Number(prev[3])) && Number(prev[3]) <= st.size;
      result.reset = !!previous && !canResume;
      let start = canResume ? Number(prev[3]) : Math.max(0, st.size - CHUNK);
      if (st.size - start > CHUNK) {
        start = Math.max(0, st.size - CHUNK);
        result.truncated = true;
        result.reset = true;
      }
      if (!canResume && start > 0) result.truncated = true;
      const length = Math.min(CHUNK, st.size - start);
      const buffer = Buffer.alloc(length);
      const count = readSync(fd, buffer, 0, length, start);
      let from = 0;
      if (start > 0 && (!canResume || result.truncated)) {
        const first = buffer.subarray(0, count).indexOf(10);
        if (first < 0) {
          result.state = 'ok'; result.cursor = identity + ':' + String(start + count);
          return result;
        }
        from = first + 1;
      }
      const last = buffer.subarray(from, count).lastIndexOf(10);
      if (last < 0) {
        result.cursor = identity + ':' + String(start + from);
        result.state = 'ok'; return result;
      }
      const end = from + last + 1;
      result.text = buffer.toString('utf8', from, end);
      result.cursor = identity + ':' + String(start + end);
      result.state = 'ok';
    } catch (e) {
      result.state = (e as NodeJS.ErrnoException).code === 'ENOENT'
        ? 'missing' : 'unavailable';
      result.text = '';
      result.cursor = null;
    } finally {
      if (fd !== null) closeSync(fd);
    }
    return result;
  }
}
