import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ManagedPhotoMapRuntimeHost } from '../../src/modules/host/photomap-runtime-host.ts';

const owner = { schema_version: 1, owner: 'pockethost', instance_id: 'photomap-test' };

function fixture() {
  const parent = mkdtempSync(path.join(os.tmpdir(), 'pockethost-photomap-runtime-'));
  const root = path.join(parent, 'managed');
  const instance = path.join(root, 'instances', 'photomap-test');
  const manifests = path.join(instance, 'manifests');
  mkdirSync(manifests, { recursive: true, mode: 0o700 });
  const runtime = path.join(manifests, 'runtime.json');
  const current = path.join(instance, 'current.json');
  const write = (file, payload) =>
    writeFileSync(file, JSON.stringify({ ...owner, ...payload }) + '\n', { mode: 0o600 });
  write(runtime, {
    runtime_kind: 'debian-proot',
    port: 8010,
    autostart: false,
    enabled: false,
    launch_allowed: false,
    managed_proot_snapshot: false,
  });
  write(current, { selected_release: 'import-20261106', active_process: null, status: 'stopped' });
  return { parent, root, instance, manifests, runtime, current, write };
}

test('real imported-style PhotoMap manifest has no lifecycle authority', async () => {
  const f = fixture();
  try {
    const host = new ManagedPhotoMapRuntimeHost(f.root);
    const snapshot = host.inspect();
    assert.equal(snapshot.id, 'photomap-test');
    assert.equal(snapshot.sourceRelease, 'import-20261106');
    assert.equal(snapshot.state, 'disabled');
    assert.equal(snapshot.runtimeVersion, null);
    assert.equal(snapshot.manualStartAllowed, false);
    assert.equal(snapshot.autostart, false);
    await assert.rejects(host.start(), /not approved/);
    await assert.rejects(host.stop(), /not approved/);
    assert.equal(await host.health(), false);
    assert.deepEqual(host.readLogs(), []);
  } finally {
    rmSync(f.parent, { recursive: true, force: true });
  }
});

test('forged owner, port, release, autostart and runtime kind are rejected', () => {
  for (const [fileKey, change] of [
    ['runtime', { owner: 'external' }],
    ['runtime', { instance_id: 'other-project' }],
    ['runtime', { port: 8001 }],
    ['runtime', { autostart: true }],
    ['runtime', { runtime_kind: 'native' }],
    ['current', { selected_release: '../foreign' }],
    ['current', { owner: 'external' }],
  ]) {
    const f = fixture();
    try {
      const file = f[fileKey];
      const prior = JSON.parse(readFileSync(file, 'utf8'));
      f.write(file, { ...prior, ...change });
      assert.throws(() => new ManagedPhotoMapRuntimeHost(f.root).inspect(), undefined, fileKey);
    } finally {
      rmSync(f.parent, { recursive: true, force: true });
    }
  }
});

test('managed root or runtime manifest symlinks cannot be followed', () => {
  const f = fixture();
  try {
    const linkedRoot = path.join(f.parent, 'linked');
    symlinkSync(f.root, linkedRoot);
    assert.throws(() => new ManagedPhotoMapRuntimeHost(linkedRoot).inspect(), /canonical/);
    rmSync(f.runtime);
    symlinkSync(f.current, f.runtime);
    assert.throws(() => new ManagedPhotoMapRuntimeHost(f.root).inspect(), /Unsafe/);
  } finally {
    rmSync(f.parent, { recursive: true, force: true });
  }
});

test('a partial launch flag cannot enable lifecycle actions', async () => {
  const f = fixture();
  try {
    f.write(f.runtime, {
      ...owner,
      runtime_kind: 'debian-proot',
      port: 8010,
      autostart: false,
      enabled: true,
      launch_allowed: false,
      managed_proot_snapshot: true,
    });
    const host = new ManagedPhotoMapRuntimeHost(f.root);
    assert.equal(host.inspect().state, 'disabled');
    await assert.rejects(host.start(), /not approved/);
  } finally {
    rmSync(f.parent, { recursive: true, force: true });
  }
});

test('disabled manifest never hides stale process identity or follows state symlinks', async () => {
  const f = fixture();
  try {
    const state = path.join(f.instance, 'runtime', 'state');
    mkdirSync(state, { recursive: true, mode: 0o700 });
    writeFileSync(path.join(state, 'active.json'), '{}\n', { mode: 0o600 });
    const host = new ManagedPhotoMapRuntimeHost(f.root);
    assert.equal(host.inspect().state, 'unknown');
    await assert.rejects(host.start(), /not approved/);
    await assert.rejects(host.stop(), /not approved/);
    rmSync(path.join(f.instance, 'runtime'), { recursive: true });
    symlinkSync(f.manifests, path.join(f.instance, 'runtime'));
    assert.throws(() => host.inspect(), /Unsafe disabled/);
  } finally {
    rmSync(f.parent, { recursive: true, force: true });
  }
});

test('PRoot bind source is a disposable work copy, never the preserved import', () => {
  const source = readFileSync(
    new URL('../../src/modules/host/photomap-runtime-host.ts', import.meta.url),
    'utf8',
  );
  assert.match(source, /const source = path.join\(work, 'source'\)/);
  assert.match(source, /const preservedSource = path.join\(this.instance, 'releases'/);
  assert.match(source, /source \+ ':\/mnt\/source'/);
  assert.doesNotMatch(source, /preservedSource \+ ':\/mnt\/source'/);
});
