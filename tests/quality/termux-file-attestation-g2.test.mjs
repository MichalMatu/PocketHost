import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import {
  chmodSync, closeSync, existsSync, mkdtempSync, mkdirSync, openSync,
  rmSync, symlinkSync, unlinkSync, writeFileSync,
} from 'node:fs';
import {
  acquireStandaloneLifecycleLock, pythonWorkerSourceHash, runSha256,
  safeFile, stagedWorkerSourceHash, releaseRecoveryLock,
} from '../../src/modules/host/termux-file-attestation.ts';

function fixture(t) {
  const root = mkdtempSync(path.join(os.tmpdir(), 'pockethost-attestation-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return root;
}
const digest = (value) => createHash('sha256').update(value).digest('hex');

test('private pinned Python/Node sources produce verified hashes, not path-based guesses', (t) => {
  const root = fixture(t);
  assert.equal(pythonWorkerSourceHash(root), null);
  assert.equal(stagedWorkerSourceHash(root, 'node-source-v1'), null);
  const python = path.join(root, 'worker.py');
  const node = path.join(root, 'worker.mjs');
  writeFileSync(python, 'print("ok")\n', { mode: 0o600 });
  writeFileSync(node, 'console.log("ok")\n', { mode: 0o600 });
  assert.equal(pythonWorkerSourceHash(root), digest('print("ok")\n'));
  assert.equal(stagedWorkerSourceHash(root, 'node-source-v1'), digest('console.log("ok")\n'));
  chmodSync(python, 0o644);
  assert.equal(pythonWorkerSourceHash(root), null);
  unlinkSync(node);
  symlinkSync(python, node);
  assert.equal(stagedWorkerSourceHash(root, 'node-source-v1'), null);
});

test('private run scripts must be executable single inode files', (t) => {
  const root = fixture(t);
  assert.equal(runSha256(root), null);
  const file = path.join(root, 'run');
  writeFileSync(file, '#!/bin/sh\nexit 0\n', { mode: 0o700 });
  assert.equal(runSha256(root), digest('#!/bin/sh\nexit 0\n'));
  chmodSync(file, 0o600);
  assert.equal(runSha256(root), null);
  unlinkSync(file);
  symlinkSync(path.join(root, 'outside'), file);
  assert.equal(runSha256(root), null);
});

test('safeFile refuses unsafe mutable metadata while accepting a private record', (t) => {
  const root = fixture(t);
  const file = path.join(root, 'registry.json');
  assert.equal(safeFile(file), null);
  writeFileSync(file, '{"version":1}\n', { mode: 0o600 });
  assert.equal(safeFile(file), '{"version":1}\n');
  chmodSync(file, 0o666);
  assert.throws(() => safeFile(file), /Unsafe runit registry/);
  unlinkSync(file);
  symlinkSync(path.join(root, 'other-file'), file);
  assert.throws(() => safeFile(file), /Unsafe runit registry/);
});

test('recovery locks and lifecycle leases only release their own inode', (t) => {
  const root = fixture(t);
  const pathToLock = path.join(root, 'recovery.lock');
  const fd = openSync(pathToLock, 'wx', 0o600);
  try {
    assert.equal(existsSync(pathToLock), true);
    releaseRecoveryLock(fd, pathToLock);
    assert.equal(existsSync(pathToLock), false);
  } finally {
    closeSync(fd);
  }
  const folder = path.join(root, 'owned');
  mkdirSync(folder, { mode: 0o700 });
  const register = path.join(folder, 'registry.json');
  const release = acquireStandaloneLifecycleLock(register);
  assert.throws(() => acquireStandaloneLifecycleLock(register), /in progress|reconciliation/);
  release();
  assert.equal(existsSync(path.join(folder, '.h3-standalone-lifecycle.lock')), false);
  const releaseTwo = acquireStandaloneLifecycleLock(register);
  unlinkSync(path.join(folder, '.h3-standalone-lifecycle.lock'));
  writeFileSync(path.join(folder, '.h3-standalone-lifecycle.lock'), 'foreign');
  assert.throws(releaseTwo, /lock changed/);
  chmodSync(folder, 0o755);
  assert.throws(() => acquireStandaloneLifecycleLock(register), /Unsafe standalone worker lock directory/);
});
