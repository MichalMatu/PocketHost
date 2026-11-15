import { lstatSync, readdirSync, realpathSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export type TermuxBootObservation = {
  state: 'scripts-present' | 'no-scripts' | 'unverified';
  scriptCount: number | null;
  androidPermission: 'not-verified';
  rebootReadback: 'not-verified';
  checkedAt: string;
};

/**
 * Observation only. A Termux:Boot hook is an arbitrary local file; never
 * read its contents, show its path, infer the installed Android companion,
 * execute it, or adopt it as a PocketHost-owned service.
 */
export function inspectTermuxBoot(): TermuxBootObservation {
  const checkedAt = new Date().toISOString();
  const observed = (
    state: TermuxBootObservation['state'],
    scriptCount: number | null,
  ): TermuxBootObservation => ({
    state, scriptCount, androidPermission: 'not-verified',
    rebootReadback: 'not-verified', checkedAt,
  });
  const home = os.homedir();
  const owner = process.getuid?.();
  const trusted = (directory: string): boolean => {
    const stat = lstatSync(directory);
    return (
      typeof owner === 'number' &&
      stat.isDirectory() &&
      !stat.isSymbolicLink() &&
      stat.uid === owner &&
      (stat.mode & 0o022) === 0 &&
      realpathSync(directory) === directory
    );
  };
  try {
    if (!trusted(home)) return observed('unverified', null);
    const config = path.join(home, '.termux');
    const boot = path.join(config, 'boot');
    try {
      if (!trusted(config)) return observed('unverified', null);
    } catch (error) {
      return (error as NodeJS.ErrnoException).code === 'ENOENT'
        ? observed('no-scripts', 0) : observed('unverified', null);
    }
    try {
      if (!trusted(boot)) return observed('unverified', null);
    } catch (error) {
      return (error as NodeJS.ErrnoException).code === 'ENOENT'
        ? observed('no-scripts', 0) : observed('unverified', null);
    }
    const entries = readdirSync(boot);
    if (entries.length > 32) return observed('unverified', null);
    for (const name of entries) {
      const file = lstatSync(path.join(boot, name));
      if (
        !file.isFile() || file.isSymbolicLink() ||
        file.nlink !== 1 || file.uid !== owner ||
        (file.mode & 0o022) !== 0
      ) return observed('unverified', null);
    }
    return observed(entries.length ? 'scripts-present' : 'no-scripts', entries.length);
  } catch {
    return observed('unverified', null);
  }
}
