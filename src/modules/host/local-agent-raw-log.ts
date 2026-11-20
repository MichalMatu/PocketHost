import { closeSync, constants, fstatSync, lstatSync, openSync, readSync, realpathSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * Binary-exact reader of the installed Termux Agent's svlogd current file.
 * No parsers, transformations, classification, timestamp conversion or redaction.
 * Call only through the existing trusted-private-LAN PocketHost DEV API.
 */
const CHUNK_BYTES = 256 * 1024;
const CANDIDATES = [
  'logs/agent/current',
  'log/termux-agent/current',
  'log/termux-agent/main/current',
  'services/termux-agent/log/main/current',
  'services/termux-agent/log/current',
] as const;

export type RawAgentLogRead = {
  state: 'ok' | 'missing' | 'unavailable';
  bytes: Buffer;
  cursor: string | null;
  reset: boolean;
  more: boolean;
};

export class LocalAgentRawLogHost {
  constructor(private readonly home = os.homedir()) {}

  read(previous: string | null = null): RawAgentLogRead {
    const out: RawAgentLogRead = {
      state: 'unavailable', bytes: Buffer.alloc(0), cursor: null,
      reset: false, more: false,
    };
    const base = path.join(this.home, '.local/state/local-agent/termux/runit');
    let fd: number | null = null;
    try {
      // Fixed, already-known runit layouts. Reject redirected file paths.
      const fixed = [this.home,
        path.join(this.home, '.local'),
        path.join(this.home, '.local/state'),
        path.join(this.home, '.local/state/local-agent'),
        path.join(this.home, '.local/state/local-agent/termux'), base];
      for (const directory of fixed) {
        const info = lstatSync(directory);
        if (!info.isDirectory() || info.isSymbolicLink() ||
            realpathSync(directory) !== directory) return out;
      }
      let file: string | null = null;
      for (const relative of CANDIDATES) {
        let current = base;
        let absent = false;
        for (const component of relative.split('/').slice(0, -1)) {
          current = path.join(current, component);
          try {
            const item = lstatSync(current);
            if (!item.isDirectory() || item.isSymbolicLink() ||
                realpathSync(current) !== current) return out;
          } catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
              absent = true; break;
            }
            throw error;
          }
        }
        if (absent) continue;
        const candidate = path.join(base, relative);
        try {
          lstatSync(candidate);
          file = candidate;
          break;
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
        }
      }
      if (file === null) { out.state = 'missing'; return out; }
      const before = lstatSync(file);
      if (!before.isFile() || before.isSymbolicLink()) return out;
      fd = openSync(file, constants.O_RDONLY | constants.O_NOFOLLOW);
      const info = fstatSync(fd);
      if (!info.isFile() || info.dev !== before.dev || info.ino !== before.ino)
        return out;
      const identity = String(info.dev) + ':' + String(info.ino);
      const match = /^(\d+):(\d+):(\d+)$/.exec(previous ?? '');
      const valid = match !== null &&
        match[1] + ':' + match[2] === identity &&
        Number.isSafeInteger(Number(match[3])) && Number(match[3]) <= info.size;
      const offset = valid ? Number(match![3]) : 0;
      out.reset = !!previous && !valid;
      const length = Math.min(CHUNK_BYTES, Math.max(0, info.size - offset));
      const data = Buffer.alloc(length);
      const read = readSync(fd, data, 0, length, offset);
      out.bytes = data.subarray(0, read);
      out.cursor = identity + ':' + String(offset + read);
      out.more = offset + read < info.size;
      out.state = 'ok';
      return out;
    } catch (error) {
      out.state = (error as NodeJS.ErrnoException).code === 'ENOENT'
        ? 'missing' : 'unavailable';
      return out;
    } finally {
      if (fd !== null) closeSync(fd);
    }
  }
}
