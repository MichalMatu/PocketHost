import { randomUUID } from 'node:crypto';
import {
  closeSync,
  existsSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { HostingRegistryStorage } from '../../shared/hosting-registry-storage.ts';

const MAX_BYTES = 256 * 1024;
const DEFAULT_FILE = path.join(
  os.homedir(),
  '.local',
  'state',
  'pockethost',
  'hosting-registry-v1.json',
);

function safeAncestors(directory: string): void {
  if (!path.isAbsolute(directory)) throw new Error('Registry directory must be absolute');
  let current = path.parse(directory).root;
  for (const segment of directory.slice(current.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, segment);
    if (!existsSync(current)) break;
    const status = lstatSync(current);
    if (status.isSymbolicLink() || !status.isDirectory()) {
      throw new Error('Unsafe registry directory');
    }
  }
}

/**
 * On-demand private state file. No service, process, runit or network calls.
 * Caller performs all semantic declaration validation before writing.
 */
export class HostingRegistryFile implements HostingRegistryStorage {
  constructor(private readonly file = DEFAULT_FILE) {
    if (!path.isAbsolute(file) || !file.endsWith('.json')) {
      throw new Error('Invalid registry file path');
    }
  }

  read(): string | null {
    safeAncestors(path.dirname(this.file));
    if (!existsSync(this.file)) return null;
    const status = lstatSync(this.file);
    if (
      status.isSymbolicLink() ||
      !status.isFile() ||
      status.size > MAX_BYTES ||
      (status.mode & 0o077) !== 0
    ) {
      throw new Error('Unsafe registry file');
    }
    return readFileSync(this.file, 'utf8');
  }

  compareAndSwap(expected: string | null, next: string): void {
    if (Buffer.byteLength(next, 'utf8') > MAX_BYTES) {
      throw new Error('Registry write exceeds size limit');
    }
    const directory = path.dirname(this.file);
    safeAncestors(directory);
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    safeAncestors(directory);
    const lock = this.file + '.lock';
    const temporary = path.join(directory, '.hosting-registry-' + randomUUID() + '.json');
    const fd = openSync(lock, 'wx', 0o600);
    try {
      closeSync(fd);
      if (this.read() !== expected) throw new Error('Stale registry revision');
      writeFileSync(temporary, next, { flag: 'wx', mode: 0o600 });
      renameSync(temporary, this.file);
    } finally {
      rmSync(temporary, { force: true });
      rmSync(lock, { force: true });
    }
  }
}
