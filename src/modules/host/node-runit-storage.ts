import { randomUUID } from 'node:crypto';
import {
  constants,
  fstatSync,
  lstatSync,
  openSync,
  closeSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';

/** Owned runtime file primitives. Preserve canonical path and inode checks. */
export function checkedDirectory(folder: string): void {
  const s = lstatSync(folder);
  if (
    !s.isDirectory() ||
    s.isSymbolicLink() ||
    realpathSync(folder) !== folder ||
    s.uid !== process.getuid?.()
  )
    throw new Error('Untrusted Node runtime directory');
}
export function privateText(filename: string, max = 16384): string {
  const s = lstatSync(filename);
  if (
    !s.isFile() ||
    s.isSymbolicLink() ||
    s.nlink !== 1 ||
    s.uid !== process.getuid?.() ||
    (s.mode & 0o077) !== 0 ||
    s.size > max
  )
    throw new Error('Untrusted Node runtime file');
  const fd = openSync(filename, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const current = fstatSync(fd);
    if (
      !current.isFile() ||
      current.nlink !== 1 ||
      current.ino !== s.ino ||
      current.dev !== s.dev ||
      current.uid !== s.uid ||
      (current.mode & 0o077) !== 0 ||
      current.size > max
    )
      throw new Error('Node runtime file changed during verification');
    return readFileSync(fd, 'utf8');
  } finally {
    closeSync(fd);
  }
}
export function absent(name: string): boolean {
  try {
    lstatSync(name);
    return false;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return true;
    throw error;
  }
}
export function atomic(folder: string, name: string, content: string, mode = 0o600): void {
  checkedDirectory(folder);
  const target = path.join(folder, name);
  if (!absent(target)) privateText(target);
  const temp = path.join(folder, '.node-' + randomUUID());
  writeFileSync(temp, content, { flag: 'wx', mode });
  try {
    renameSync(temp, target);
  } finally {
    if (!absent(temp)) rmSync(temp);
  }
}
