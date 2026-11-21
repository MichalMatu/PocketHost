import { createHash } from 'node:crypto';
import {
  closeSync, constants, fstatSync, lstatSync, openSync,
  readFileSync, unlinkSync, mkdirSync, realpathSync,
} from 'node:fs';
import path from 'node:path';

type StagedWorkerTemplate = 'python-source-v1' | 'node-source-v1';

/** Keep the existing inode-pinned read and lock checks unchanged. */
/** SHA-256 of private staged source, via inode-pinned NOFOLLOW read. */
export function stagedWorkerSourceHash(target: string, template: StagedWorkerTemplate): string | null {
  const file = path.join(target, template === 'python-source-v1' ? 'worker.py' : 'worker.mjs');
  let fd: number | undefined;
  try {
    const initial = lstatSync(file);
    if (
      !initial.isFile() ||
      initial.isSymbolicLink() ||
      initial.nlink !== 1 ||
      initial.uid !== process.getuid?.() ||
      (initial.mode & 0o077) !== 0 ||
      initial.size === 0 ||
      initial.size > 32 * 1024
    )
      return null;
    fd = openSync(file, constants.O_RDONLY | constants.O_NOFOLLOW);
    const before = fstatSync(fd);
    if (
      !before.isFile() ||
      before.nlink !== 1 ||
      before.dev !== initial.dev ||
      before.ino !== initial.ino ||
      before.uid !== initial.uid ||
      before.mode !== initial.mode ||
      before.size !== initial.size ||
      before.mtimeMs !== initial.mtimeMs
    )
      return null;
    const bytes = readFileSync(fd);
    const after = fstatSync(fd);
    const current = lstatSync(file);
    if (
      bytes.length !== before.size ||
      after.dev !== before.dev ||
      after.ino !== before.ino ||
      after.size !== before.size ||
      after.mtimeMs !== before.mtimeMs ||
      after.mode !== before.mode ||
      after.nlink !== 1 ||
      current.dev !== before.dev ||
      current.ino !== before.ino ||
      current.size !== before.size ||
      current.mtimeMs !== before.mtimeMs ||
      current.mode !== before.mode ||
      current.nlink !== 1 ||
      current.uid !== before.uid
    )
      return null;
    return createHash('sha256').update(bytes).digest('hex');
  } catch {
    return null;
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
}
export function pythonWorkerSourceHash(target: string): string | null {
  return stagedWorkerSourceHash(target, 'python-source-v1');
}
/**
 * Read an owner-sensitive small record only through the file inspected by
 * lstat. A replaced symlink, hard link, inode or concurrently modified record
 * must never become service enrollment, archive or source authority.
 */
export function safeFile(file: string): string | null {
  let fd: number | undefined;
  try {
    const initial = lstatSync(file);
    if (
      !initial.isFile() ||
      initial.isSymbolicLink() ||
      initial.nlink !== 1 ||
      initial.size > 20000 ||
      initial.uid !== process.getuid?.() ||
      (initial.mode & 0o022) !== 0
    )
      throw new Error('Unsafe runit registry');
    // NONBLOCK also prevents a swapped-in FIFO from blocking this host process.
    fd = openSync(file, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    const opened = fstatSync(fd);
    if (
      !opened.isFile() ||
      opened.dev !== initial.dev ||
      opened.ino !== initial.ino ||
      opened.size !== initial.size ||
      opened.mtimeMs !== initial.mtimeMs ||
      opened.mode !== initial.mode ||
      opened.nlink !== 1 ||
      opened.uid !== initial.uid
    )
      throw new Error('Runit record changed while opening');
    const bytes = readFileSync(fd);
    const after = fstatSync(fd);
    const current = lstatSync(file);
    if (
      bytes.length !== initial.size ||
      bytes.length > 20000 ||
      after.dev !== initial.dev ||
      after.ino !== initial.ino ||
      after.size !== initial.size ||
      after.mtimeMs !== initial.mtimeMs ||
      after.mode !== initial.mode ||
      after.nlink !== 1 ||
      current.dev !== initial.dev ||
      current.ino !== initial.ino ||
      current.size !== initial.size ||
      current.mtimeMs !== initial.mtimeMs ||
      current.mode !== initial.mode ||
      current.nlink !== 1 ||
      current.uid !== initial.uid
    )
      throw new Error('Runit record changed during read');
    return bytes.toString('utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
}

/** Release only this process's exact private recovery lock, never a replaced file. */
export function releaseRecoveryLock(lockFd: number, lockPath: string): void {
  const lockProof = fstatSync(lockFd);
  const current = lstatSync(lockPath);
  if (
    !current.isFile() ||
    current.isSymbolicLink() ||
    current.dev !== lockProof.dev ||
    current.ino !== lockProof.ino ||
    current.nlink !== 1 ||
    current.uid !== process.getuid?.()
  ) {
    throw new Error('Recovery lock identity changed; refusing cleanup');
  }
  unlinkSync(lockPath);
}

/** Re-attest the opened inode, never hash a path after a separate lstat. */
export function runSha256(target: string): string | null {
  let fd: number | undefined;
  try {
    const file = path.join(target, 'run');
    const stat = lstatSync(file);
    if (
      !stat.isFile() ||
      stat.isSymbolicLink() ||
      stat.nlink !== 1 ||
      stat.uid !== process.getuid?.() ||
      (stat.mode & 0o022) !== 0 ||
      (stat.mode & 0o111) === 0 ||
      stat.size > 20000
    )
      return null;
    fd = openSync(file, constants.O_RDONLY | constants.O_NOFOLLOW);
    const opened = fstatSync(fd);
    if (
      !opened.isFile() ||
      opened.dev !== stat.dev ||
      opened.ino !== stat.ino ||
      opened.size !== stat.size ||
      opened.mtimeMs !== stat.mtimeMs ||
      opened.mode !== stat.mode ||
      opened.nlink !== 1 ||
      opened.uid !== stat.uid
    )
      return null;
    const bytes = readFileSync(fd);
    const after = fstatSync(fd);
    const current = lstatSync(file);
    if (
      bytes.length !== stat.size ||
      after.dev !== stat.dev ||
      after.ino !== stat.ino ||
      after.size !== stat.size ||
      after.mtimeMs !== stat.mtimeMs ||
      current.dev !== stat.dev ||
      current.ino !== stat.ino ||
      current.size !== stat.size ||
      current.mtimeMs !== stat.mtimeMs ||
      current.mode !== stat.mode ||
      current.nlink !== 1 ||
      current.uid !== stat.uid
    )
      return null;
    return createHash('sha256').update(bytes).digest('hex');
  } catch {
    return null;
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
}

/**
 * Cross-process lease for creation, archiving, restoring and LAN lifecycle
 * of owned standalone workers. Hold it across the complete filesystem and
 * runit transaction: a per-process UI queue cannot protect two adapters.
 * An abandoned lock stays in place for independent manual reconciliation.
 */
export function acquireStandaloneLifecycleLock(registerFile: string): () => void {
  const folder = path.dirname(registerFile);
  mkdirSync(folder, { recursive: true, mode: 0o700 });
  const parent = lstatSync(folder);
  if (
    !parent.isDirectory() ||
    parent.isSymbolicLink() ||
    parent.uid !== process.getuid?.() ||
    (parent.mode & 0o077) !== 0 ||
    realpathSync(folder) !== folder
  )
    throw new Error('Unsafe standalone worker lock directory');
  const lockPath = path.join(folder, '.h3-standalone-lifecycle.lock');
  let fd: number;
  try {
    fd = openSync(lockPath, 'wx', 0o600);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST')
      throw new Error(
        'Another standalone worker operation is in progress or needs reconciliation',
      );
    throw error;
  }
  return () => {
    try {
      const held = fstatSync(fd);
      const current = lstatSync(lockPath);
      if (
        !current.isFile() ||
        current.isSymbolicLink() ||
        current.dev !== held.dev ||
        current.ino !== held.ino ||
        current.nlink !== 1 ||
        current.uid !== process.getuid?.() ||
        (current.mode & 0o077) !== 0
      )
        throw new Error('Standalone worker lock changed; refusing cleanup');
      unlinkSync(lockPath);
    } finally {
      closeSync(fd);
    }
  };
}
