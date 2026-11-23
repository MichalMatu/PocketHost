import assert from 'node:assert/strict';
import test from 'node:test';
import os from 'node:os';
import path from 'node:path';
import {
  mkdtempSync,
  mkdirSync,
  rmSync,
  writeFileSync,
  symlinkSync,
  linkSync,
  chmodSync,
} from 'node:fs';
import { NodeProjectHost } from '../../src/modules/host/node-project-host.ts';
import {
  NodeProjectDataScope,
  reviewNodeDataOfflinePrerequisites,
} from '../../src/modules/host/node-project-data-scope.ts';

const emptyCategories = () => ({
  uploads: { fileCount: 0, totalBytes: 0, directoryCount: 0 },
  db: { fileCount: 0, totalBytes: 0, directoryCount: 0 },
  state: { fileCount: 0, totalBytes: 0, directoryCount: 0 },
});

function fixture(t) {
  const temp = mkdtempSync(path.join(os.tmpdir(), 'pockethost-node-data-scope-'));
  t.after(() => rmSync(temp, { recursive: true, force: true }));
  const projectsRoot = path.join(temp, 'projects');
  const dataRoot = path.join(temp, 'data');
  const project = new NodeProjectHost(projectsRoot).create('Data scope fixture');
  const inspector = new NodeProjectDataScope(projectsRoot, dataRoot);
  const ownedData = path.join(dataRoot, project.id);
  return { temp, project, inspector, dataRoot, ownedData };
}
function createScope(dataRoot, ownedData) {
  mkdirSync(dataRoot, { mode: 0o700 });
  mkdirSync(ownedData, { mode: 0o700 });
  mkdirSync(path.join(ownedData, 'uploads'), { mode: 0o700 });
  mkdirSync(path.join(ownedData, 'db'), { mode: 0o700 });
}
test('mutable Node data remains independent and unconfigured until explicitly provisioned', (t) => {
  const { project, inspector } = fixture(t);
  assert.deepEqual(inspector.inspect(project.id), {
    projectId: project.id,
    state: 'not-configured',
    fileCount: 0,
    totalBytes: 0,
    categories: emptyCategories(),
    backupReady: false,
    consistency: 'offline-required',
  });
  assert.throws(() => inspector.inspect('node-' + 'a'.repeat(32)), /Node|project/i);
  assert.throws(
    () => new NodeProjectDataScope('/tmp/source', '/tmp/source/data'),
    /separate/,
  );
});
test('mutable Node data inventory counts only private uploads and databases without backups', (t) => {
  const { project, inspector, dataRoot, ownedData } = fixture(t);
  createScope(dataRoot, ownedData);
  mkdirSync(path.join(ownedData, 'uploads', 'images'), { mode: 0o700 });
  const sample = Buffer.from([0, 255, 12, 42]);
  writeFileSync(path.join(ownedData, 'uploads', 'images', 'picture.png'), sample, { mode: 0o600 });
  writeFileSync(path.join(ownedData, 'db', 'app.sqlite'), 'fixture db bytes', { mode: 0o600 });
  const inventory = inspector.inspect(project.id);
  assert.equal(inventory.state, 'owned-private');
  assert.equal(inventory.fileCount, 2);
  assert.equal(inventory.totalBytes, sample.length + Buffer.byteLength('fixture db bytes'));
  assert.deepEqual(inventory.categories, {
    uploads: { fileCount: 1, totalBytes: sample.length, directoryCount: 2 },
    db: { fileCount: 1, totalBytes: Buffer.byteLength('fixture db bytes'), directoryCount: 1 },
    state: { fileCount: 0, totalBytes: 0, directoryCount: 0 },
  });
  assert.equal(inventory.backupReady, false);
  assert.equal(inventory.consistency, 'offline-required');
});
test('mutable Node data inventory is isolated between two owned projects', (t) => {
  const { project, inspector, root, dataRoot, ownedData } = (() => {
    const item = fixture(t);
    return { ...item, root: path.join(item.temp, 'projects') };
  })();
  createScope(dataRoot, ownedData);
  const neighbor = new NodeProjectHost(root).create('Other project');
  const neighborData = path.join(dataRoot, neighbor.id);
  mkdirSync(neighborData, { mode: 0o700 });
  mkdirSync(path.join(neighborData, 'uploads'), { mode: 0o700 });
  writeFileSync(path.join(neighborData, 'uploads', 'other.txt'), 'neighbor', { mode: 0o600 });
  assert.deepEqual(inspector.inspect(project.id), {
    projectId: project.id,
    state: 'owned-private',
    fileCount: 0,
    totalBytes: 0,
    categories: {
      ...emptyCategories(),
      uploads: { fileCount: 0, totalBytes: 0, directoryCount: 1 },
      db: { fileCount: 0, totalBytes: 0, directoryCount: 1 },
    },
    backupReady: false,
    consistency: 'offline-required',
  });
  const neighborReport = inspector.inspect(neighbor.id);
  assert.equal(neighborReport.fileCount, 1);
  assert.deepEqual(neighborReport.categories, {
    ...emptyCategories(),
    uploads: { fileCount: 1, totalBytes: Buffer.byteLength('neighbor'), directoryCount: 1 },
  });
});

test('Node data recovery review fails closed for running, unknown and absent runtime', (t) => {
  const { project, inspector, dataRoot, ownedData } = fixture(t);
  const missing = inspector.inspect(project.id);
  assert.deepEqual(reviewNodeDataOfflinePrerequisites(missing, {
    state: 'stopped', desired: 'stopped',
  }), {
    status: 'data-not-configured',
    runtimeState: 'stopped',
    snapshotEnabled: false,
    requirements: {
      dataOwned: false,
      runtimeStopped: true,
      databaseConsistent: false,
      snapshotApproved: false,
    },
  });
  assert.deepEqual(reviewNodeDataOfflinePrerequisites(missing, {
    state: 'stopped', desired: 'running',
  }).requirements, {
    dataOwned: false,
    runtimeStopped: false,
    databaseConsistent: false,
    snapshotApproved: false,
  });
  createScope(dataRoot, ownedData);
  const present = inspector.inspect(project.id);
  for (const [state, desired, status] of [
    ['running', 'running', 'project-not-stopped'],
    ['unknown', 'stopped', 'ownership-unverified'],
    ['not-provisioned', 'stopped', 'ownership-unverified'],
    ['stopped', 'running', 'project-not-stopped'],
    ['stopped', 'stopped', 'manual-review-required'],
  ]) {
    assert.deepEqual(reviewNodeDataOfflinePrerequisites(present, { state, desired }), {
      status,
      runtimeState: state,
      snapshotEnabled: false,
      requirements: {
        dataOwned: true,
        runtimeStopped: state === 'stopped' && desired === 'stopped',
        databaseConsistent: false,
        snapshotApproved: false,
      },
    });
  }
});

test('mutable Node data refuses symlinks, foreign categories and permissive files', (t) => {
  const { temp, project, inspector, dataRoot, ownedData } = fixture(t);
  createScope(dataRoot, ownedData);
  const outside = path.join(temp, 'unowned.txt');
  writeFileSync(outside, 'outside', { mode: 0o600 });
  const link = path.join(ownedData, 'uploads', 'linked.txt');
  symlinkSync(outside, link);
  assert.throws(() => inspector.inspect(project.id), /Unverified/);
  rmSync(link);
  const wrong = path.join(ownedData, 'secrets');
  mkdirSync(wrong, { mode: 0o700 });
  assert.throws(() => inspector.inspect(project.id), /category/);
  rmSync(wrong, { recursive: true });
  const file = path.join(ownedData, 'db', 'records.sqlite');
  writeFileSync(file, 'owned bytes', { mode: 0o600 });
  chmodSync(file, 0o644);
  assert.throws(() => inspector.inspect(project.id), /Unverified/);
  chmodSync(file, 0o600);
});

test('mutable Node data refuses hardlinked files when the filesystem supports hardlinks', (t) => {
  const { project, inspector, dataRoot, ownedData } = fixture(t);
  createScope(dataRoot, ownedData);
  const file = path.join(ownedData, 'db', 'records.sqlite');
  writeFileSync(file, 'owned bytes', { mode: 0o600 });
  try {
    linkSync(file, path.join(ownedData, 'uploads', 'hardlink.sqlite'));
  } catch (error) {
    if (['EACCES', 'EPERM', 'ENOTSUP', 'EOPNOTSUPP', 'EROFS'].includes(error?.code)) {
      t.skip('Filesystem blocks hardlink creation; linked-file rejection cannot be exercised');
      return;
    }
    throw error;
  }
  assert.throws(() => inspector.inspect(project.id), /Unverified/);
});
