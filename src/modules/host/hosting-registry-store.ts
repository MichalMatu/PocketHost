import { randomUUID } from 'node:crypto';
import {
  closeSync, constants, existsSync, fstatSync, fsyncSync, lstatSync, openSync,
  readFileSync, realpathSync, renameSync, unlinkSync, writeFileSync,
} from 'node:fs';
import path from 'node:path';
import type { HostingDeclarations } from '../../shared/hosting-platform.ts';
import { createHostingRegistries } from '../../shared/hosting-registry.ts';

const NAME = 'hosting-declarations.json';
const LOCK = '.hosting-declarations.lock';
const LIMIT = 256 * 1024;

interface StoredDeclarations {
  schemaVersion: 1;
  owner: 'pockethost';
  revision: number;
  declarations: HostingDeclarations;
}

function directory(root: string): void {
  if (!path.isAbsolute(root)) throw new Error('Registry directory must be absolute');
  const stat = lstatSync(root);
  if (!stat.isDirectory() || stat.isSymbolicLink() || realpathSync(root) !== root) {
    throw new Error('Registry directory is not a canonical directory');
  }
  if (stat.uid !== process.getuid() || (stat.mode & 0o077) !== 0) {
    throw new Error('Registry directory must be owned and private');
  }
}

function regularFile(filename: string): void {
  const stat = lstatSync(filename);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 || stat.size > LIMIT ||
      stat.uid !== process.getuid() || (stat.mode & 0o077) !== 0) {
    throw new Error('Unsafe registry file');
  }
}

function validated(value: unknown): HostingDeclarations {
  const registry = createHostingRegistries(value);
  return { schemaVersion: 1, modules: registry.modules(), services: registry.services(), projects: registry.projects() };
}

function parse(contents: string): StoredDeclarations {
  if (Buffer.byteLength(contents) > LIMIT) throw new Error('Registry exceeds size limit');
  const envelope: unknown = JSON.parse(contents);
  if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope)) {
    throw new Error('Invalid registry envelope');
  }
  const x = envelope as Record<string, unknown>;
  if (Object.keys(x).length !== 4 ||
      !['schemaVersion', 'owner', 'revision', 'declarations'].every((key) => Object.hasOwn(x, key)) ||
      x.schemaVersion !== 1 || x.owner !== 'pockethost' ||
      !Number.isSafeInteger(x.revision) || (x.revision as number) < 1 ||
      (x.revision as number) >= Number.MAX_SAFE_INTEGER) {
    throw new Error('Invalid registry ownership or revision');
  }
  return {
    schemaVersion: 1, owner: 'pockethost', revision: x.revision as number,
    declarations: validated(x.declarations),
  };
}

/**
 * M1 isolated declarative persistence only. The caller must supply a verified
 * PocketHost-private canonical directory. This store does not create directories,
 * discover processes, attest runtime ownership or grant lifecycle authority.
 * Lock conflicts fail closed rather than overwriting concurrent writers.
 */
export function createHostingRegistryStore(root: string) {
  const target = path.join(root, NAME);
  const lock = path.join(root, LOCK);
  function read(): StoredDeclarations | null {
    directory(root);
    if (!existsSync(target)) return null;
    regularFile(target);
    const fd = openSync(target, constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
      const stat = fstatSync(fd);
      if (!stat.isFile() || stat.nlink !== 1 || stat.size > LIMIT ||
          stat.uid !== process.getuid() || (stat.mode & 0o077) !== 0) {
        throw new Error('Unsafe registry file');
      }
      return parse(readFileSync(fd, 'utf8'));
    } finally {
      closeSync(fd);
    }
  }
  return {
    read,
    save(declarations: unknown, expectedRevision: number): StoredDeclarations {
      if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0 ||
          expectedRevision >= Number.MAX_SAFE_INTEGER - 1) {
        throw new Error('Invalid expected registry revision');
      }
      directory(root);
      const clean = validated(declarations);
      const fd = openSync(lock, 'wx', 0o600);
      let temp: string | null = null;
      try {
        const current = read();
        if ((current?.revision ?? 0) !== expectedRevision) {
          throw new Error('Stale registry revision');
        }
        const next: StoredDeclarations = {
          schemaVersion: 1, owner: 'pockethost', revision: expectedRevision + 1, declarations: clean,
        };
        const data = JSON.stringify(next) + '\n';
        if (Buffer.byteLength(data) > LIMIT) throw new Error('Registry exceeds size limit');
        temp = path.join(root, `.${randomUUID()}.registry.tmp`);
        const tempFd = openSync(temp, 'wx', 0o600);
        try {
          writeFileSync(tempFd, data);
          fsyncSync(tempFd);
        } finally {
          closeSync(tempFd);
        }
        directory(root);
        if (existsSync(target)) regularFile(target);
        renameSync(temp, target);
        temp = null;
        const rootFd = openSync(root, constants.O_RDONLY);
        try {
          fsyncSync(rootFd);
        } finally {
          closeSync(rootFd);
        }
        return next;
      } finally {
        if (temp) {
          try { unlinkSync(temp); } catch { /* preserve original error */ }
        }
        closeSync(fd);
        unlinkSync(lock);
      }
    },
  };
}
