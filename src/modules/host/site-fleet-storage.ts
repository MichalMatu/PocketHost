import { randomUUID } from 'node:crypto';
import {
  closeSync,
  existsSync,
  fstatSync,
  lstatSync,
  openSync,
  readSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmSync,
} from 'node:fs';
import path from 'node:path';
import type { FleetProject } from './site-fleet-contract.ts';

const RELEASE = /^r-[a-f0-9]{32}$/;

export function assertRemovalSnapshot(item: FleetProject, expected: unknown): void {
  if (
    !expected ||
    typeof expected !== 'object' ||
    Object.keys(expected).length !== 2 ||
    !('activeRelease' in expected) ||
    !('releases' in expected) ||
    expected.activeRelease !== item.activeRelease ||
    expected.releases !== item.releases
  )
    throw new Error('Site changed; refresh before removal');
}

/** Refuse foreign or linked entries before moving an owned, stopped site out of service. */
export function removeStaticSiteTree(folder: string): void {
  const directory = (name: string) => {
    const stat = lstatSync(name);
    if (!stat.isDirectory() || stat.isSymbolicLink() || realpathSync(name) !== name)
      throw new Error('Unsafe site directory');
  };
  const file = (name: string) => {
    const stat = lstatSync(name);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1)
      throw new Error('Unsafe or linked site file');
  };
  directory(folder);
  const entries = readdirSync(folder);
  if (entries.some((name) => !['.pockethost-site.json', 'activity.log', 'releases'].includes(name)))
    throw new Error('Unexpected site files; removal requires review');
  file(path.join(folder, '.pockethost-site.json'));
  if (entries.includes('activity.log')) file(path.join(folder, 'activity.log'));
  const releases = path.join(folder, 'releases');
  directory(releases);
  const versions = readdirSync(releases);
  if (versions.length > 16 || versions.some((name) => !RELEASE.test(name)))
    throw new Error('Unexpected release entries; removal requires review');
  let visited = 0;
  function walk(root: string, depth: number): void {
    directory(root);
    if (depth > 6) throw new Error('Unexpected site directory depth');
    for (const entry of readdirSync(root, { withFileTypes: true })) {
      if (++visited > 12000) throw new Error('Unexpected site tree size');
      const filename = path.join(root, entry.name);
      if (entry.isDirectory() && !entry.isSymbolicLink()) walk(filename, depth + 1);
      else file(filename);
    }
  }
  for (const version of versions) walk(path.join(releases, version), 0);
  // Commit removal by renaming first. Interrupted cleanup is inert and never served.
  const quarantine = path.join(path.dirname(folder), '.removed-' + randomUUID());
  renameSync(folder, quarantine);
  rmSync(quarantine, { recursive: true, force: false });
}

export function readStaticSiteLogs(folder: string): string[] {
  const filename = path.join(folder, 'activity.log');
  if (!existsSync(filename)) return [];
  const stat = lstatSync(filename);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('Unsafe owned log');
  const fd = openSync(filename, 'r');
  try {
    const count = Math.min(fstatSync(fd).size, 8192);
    const buffer = Buffer.alloc(count);
    readSync(fd, buffer, 0, count, fstatSync(fd).size - count);
    return buffer
      .toString('utf8')
      .split('\n')
      .filter(Boolean)
      .slice(-25)
      .map((line) =>
        [...line]
          .filter((char) => {
            const code = char.charCodeAt(0);
            return code >= 32 && code !== 127;
          })
          .join('')
          .slice(0, 200),
      );
  } finally {
    closeSync(fd);
  }
}
