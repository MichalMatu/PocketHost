import assert from 'node:assert/strict';
import test from 'node:test';
import os from 'node:os';
import path from 'node:path';
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { NodeProjectHost } from '../../src/modules/host/node-project-host.ts';
import { NodeProjectDataSnapshots } from '../../src/modules/host/node-project-data-snapshot.ts';

function fixture(t) {
  const home = mkdtempSync(path.join(os.tmpdir(), 'ph-node-appdata-'));
  t.after(() => rmSync(home, { recursive: true, force: true }));
  const projectRoot = path.join(home, 'projects');
  const source = path.join(home, 'data');
  const archive = path.join(home, 'snapshots');
  const project = new NodeProjectHost(projectRoot).create('Data recovery fixture');
  mkdirSync(source, { mode: 0o700 });
  const folder = path.join(source, project.id);
  mkdirSync(folder, { mode: 0o700 });
  mkdirSync(path.join(folder, 'db'), { mode: 0o700 });
  mkdirSync(path.join(folder, 'uploads'), { mode: 0o700 });
  mkdirSync(path.join(folder, 'uploads', 'images'), { mode: 0o700 });
  const db = Buffer.from('offline fixture database');
  const png = Buffer.from([0, 3, 255, 11, 44]);
  writeFileSync(path.join(folder, 'db', 'app.sqlite'), db, { mode: 0o600 });
  writeFileSync(path.join(folder, 'uploads', 'images', 'icon.png'), png, { mode: 0o600 });
  const host = new NodeProjectDataSnapshots(projectRoot, source, archive);
  return { home, project, folder, source, archive, host, db, png };
}

test('Node app-data snapshot is explicitly authorized and rejects online state', (t) => {
  const { project, host, archive } = fixture(t);
  assert.throws(() => host.create(project.id, false, () => true), /approval/);
  assert.throws(() => host.create(project.id, true, () => false), /offline/);
  assert.equal(existsSync(archive), false);
});

test('Node app-data offline bytes survive detached snapshot and staging-only restore', (t) => {
  const { project, host, folder, db, png, archive } = fixture(t);
  let checked = 0;
  const snapshot = host.create(project.id, true, () => {
    checked++;
    return true;
  });
  assert.ok(checked >= 2);
  assert.equal(snapshot.files, 2);
  assert.equal(snapshot.bytes, db.length + png.length);
  assert.ok(snapshot.snapshot.startsWith('snapshot-'));
  assert.equal(readFileSync(path.join(folder, 'db', 'app.sqlite')).toString(), db.toString());
  assert.throws(() => host.restoreToStaging(project.id, snapshot.snapshot, false), /approval/);
  const restored = host.restoreToStaging(project.id, snapshot.snapshot, true);
  assert.equal(restored.files, 2);
  assert.ok(restored.restoredTo.startsWith(path.join(archive, 'restores') + path.sep));
  assert.deepEqual(readFileSync(path.join(restored.restoredTo, project.id, 'db', 'app.sqlite')), db);
  assert.deepEqual(
    readFileSync(path.join(restored.restoredTo, project.id, 'uploads', 'images', 'icon.png')),
    png,
  );
  assert.equal(readdirSync(archive).filter((name) => name.startsWith('snapshot-')).length, 1);
});

test('Node app-data backup rejects source links and interrupted offline proof', (t) => {
  const { home, project, host, folder, archive } = fixture(t);
  let calls = 0;
  assert.throws(
    () => host.create(project.id, true, () => ++calls === 1),
    /became active/,
  );
  assert.equal(readdirSync(archive).filter((name) => name.startsWith('snapshot-')).length, 0);
  symlinkSync(path.join(home, 'outside'), path.join(folder, 'uploads', 'foreign'));
  assert.throws(() => host.create(project.id, true, () => true), /Unverified|Untrusted/);
});

test('Node app-data staged restore fails on changed snapshot without modifying source', (t) => {
  const { project, host, archive, folder, db } = fixture(t);
  const snapshot = host.create(project.id, true, () => true);
  const original = path.join(folder, 'db', 'app.sqlite');
  const stored = path.join(archive, snapshot.snapshot, 'data', project.id, 'db', 'app.sqlite');
  writeFileSync(stored, 'tampered-but-owned-by-test');
  assert.throws(
    () => host.restoreToStaging(project.id, snapshot.snapshot, true),
    /integrity mismatch/,
  );
  assert.deepEqual(readFileSync(original), db);
});
