import { lstatSync, readdirSync, realpathSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export type TermuxBootObservation = {
  state: 'scripts-present' | 'no-scripts' | 'unverified';
  scriptCount: number | null;
  /** Count of trusted scripts with the owner's execute bit set, not boot proof. */
  ownerExecutableCount: number | null;
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
    ownerExecutableCount: number | null,
  ): TermuxBootObservation => ({
    state, scriptCount, ownerExecutableCount, androidPermission: 'not-verified',
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
    if (!trusted(home)) return observed('unverified', null, null);
    const config = path.join(home, '.termux');
    const boot = path.join(config, 'boot');
    try {
      if (!trusted(config)) return observed('unverified', null, null);
    } catch (error) {
      return (error as NodeJS.ErrnoException).code === 'ENOENT'
        ? observed('no-scripts', 0, 0) : observed('unverified', null, null);
    }
    try {
      if (!trusted(boot)) return observed('unverified', null, null);
    } catch (error) {
      return (error as NodeJS.ErrnoException).code === 'ENOENT'
        ? observed('no-scripts', 0, 0) : observed('unverified', null, null);
    }
    const entries = readdirSync(boot);
    if (entries.length > 32) return observed('unverified', null, null);
    let ownerExecutableCount = 0;
    for (const name of entries) {
      const file = lstatSync(path.join(boot, name));
      if (
        !file.isFile() || file.isSymbolicLink() ||
        file.nlink !== 1 || file.uid !== owner ||
        (file.mode & 0o022) !== 0
      ) return observed('unverified', null, null);
      // Mode bits only: never inspect script content, disclose names, or run it.
      if ((file.mode & 0o100) !== 0) ownerExecutableCount += 1;
    }
    return observed(entries.length ? 'scripts-present' : 'no-scripts',
      entries.length, ownerExecutableCount);
  } catch {
    return observed('unverified', null, null);
  }
}
