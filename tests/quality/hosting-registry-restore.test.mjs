import assert from 'node:assert/strict';
import test from 'node:test';
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHostingRegistryStore } from '../../src/modules/host/hosting-registry-store.ts';
import { fingerprintHostingRegistrySnapshot } from '../../src/modules/host/hosting-registry-recovery.ts';
import { restoreHostingRegistryFromVerifiedBackup } from '../../src/modules/host/hosting-registry-restore.ts';

function declarations(port = 19100) {
  return {
    schemaVersion: 1,
    modules: [{ schemaVersion: 1, id: 'node', version: 1, capabilities: ['node'] }],
    services: [],
    projects: [
      {
        schemaVersion: 1,
        id: 'sample',
        origin: 'created-in-pockethost',
        components: [
          {
            id: 'backend',
            moduleId: 'node',
            moduleVersion: 1,
            role: 'backend',
            port,
            serviceId: null,
            secrets: [],
          },
        ],
      },
    ],
  };
}

function fixture(run) {
  const root = mkdtempSync(path.join(os.tmpdir(), 'pockethost-m1-restore-'));
  try {
    run(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test('M1 explicit restore creates a new revision and preserves the validated earlier declarations', () =>
  fixture((root) => {
    const store = createHostingRegistryStore(root);
    const saved = store.save(declarations(19100), 0);
    store.save(declarations(19200), 1);
    store.save(declarations(19300), 2);
    const backupDigest = fingerprintHostingRegistrySnapshot(saved);
    const restored = restoreHostingRegistryFromVerifiedBackup(root, saved, 3, backupDigest);
    assert.equal(restored.revision, 4);
    assert.equal(restored.declarations.projects[0].components[0].port, 19100);
    assert.equal(store.read().revision, 4);
    assert.equal(store.read().declarations.projects[0].components[0].port, 19100);
    assert.equal(saved.revision, 1);
    assert.throws(
      () => restoreHostingRegistryFromVerifiedBackup(root, saved, 3, backupDigest),
      /rollback/,
    );
  }));

test('M1 restore rejects stale revisions and forged hashes without changing the stored bytes', () =>
  fixture((root) => {
    const store = createHostingRegistryStore(root);
    const saved = store.save(declarations(19100), 0);
    store.save(declarations(19200), 1);
    const target = path.join(root, 'hosting-declarations.json');
    const original = readFileSync(target, 'utf8');
    const backupDigest = fingerprintHostingRegistrySnapshot(saved);
    for (const [revision, digest] of [
      [1, backupDigest],
      [2, '0'.repeat(64)],
      [2, 'invalid'],
    ]) {
      assert.throws(() => restoreHostingRegistryFromVerifiedBackup(root, saved, revision, digest));
      assert.equal(readFileSync(target, 'utf8'), original);
    }
    const foreign = structuredClone(saved);
    foreign.owner = 'external';
    assert.throws(() => restoreHostingRegistryFromVerifiedBackup(root, foreign, 2, backupDigest));
    assert.equal(readFileSync(target, 'utf8'), original);
  }));

test('M1 restore refuses an absent registry, active lock and symlinked owned file', () =>
  fixture((root) => {
    const backup = {
      schemaVersion: 1,
      owner: 'pockethost',
      revision: 1,
      declarations: declarations(),
    };
    const digest = fingerprintHostingRegistrySnapshot(backup);
    assert.throws(() => restoreHostingRegistryFromVerifiedBackup(root, backup, 2, digest), /current owned/);
    const store = createHostingRegistryStore(root);
    store.save(declarations(19100), 0);
    store.save(declarations(19200), 1);
    const target = path.join(root, 'hosting-declarations.json');
    const original = readFileSync(target, 'utf8');
    const lock = path.join(root, '.hosting-declarations.lock');
    writeFileSync(lock, 'held', { mode: 0o600 });
    assert.throws(() => restoreHostingRegistryFromVerifiedBackup(root, backup, 2, digest), /EEXIST/);
    assert.equal(readFileSync(target, 'utf8'), original);
    rmSync(lock);
    const originalFile = path.join(root, 'kept-original.json');
    writeFileSync(originalFile, original, { mode: 0o600 });
    rmSync(target);
    symlinkSync(originalFile, target);
    assert.throws(() => restoreHostingRegistryFromVerifiedBackup(root, backup, 2, digest), /Unsafe registry file/);
    assert.equal(readFileSync(originalFile, 'utf8'), original);
  }));
