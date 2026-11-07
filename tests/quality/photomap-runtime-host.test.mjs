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

test('a leftover start claim is a recovery hold, never a safe stopped runtime', async () => {
  const f = fixture();
  try {
    const state = path.join(f.instance, 'runtime', 'state');
    mkdirSync(state, { recursive: true, mode: 0o700 });
    const claim = path.join(state, 'start.claim');
    writeFileSync(claim, '', { mode: 0o600 });
    const host = new ManagedPhotoMapRuntimeHost(f.root);
    assert.equal(host.inspect().state, 'unknown');
    await assert.rejects(host.start(), /not approved/);
    rmSync(claim);
    symlinkSync(f.current, claim);
    assert.throws(() => host.inspect(), /Unsafe PhotoMap start claim/);
  } finally {
    rmSync(f.parent, { recursive: true, force: true });
  }
});

test('uncertain PRoot startup never silently releases its claim', () => {
  const source = readFileSync(
    new URL('../../src/modules/host/photomap-runtime-host.ts', import.meta.url),
    'utf8',
  );
  assert.match(source, /let launchAccepted = false/);
  assert.match(source, /if \(launchAccepted\) unlinkSync\(claim\)/);
  assert.doesNotMatch(source, /finally \{\s+unlinkSync\(claim\)/);
});

test('PRoot bind source is a disposable work copy, never the preserved import', () => {
  const source = readFileSync(
    new URL('../../src/modules/host/photomap-runtime-plan.ts', import.meta.url),
    'utf8',
  );
  assert.match(source, /const source = path.join\(work, 'source'\)/);
  assert.match(source, /const preservedSource = path.join\(instance, 'releases'/);
  assert.match(source, /\{ source, target: '\/mnt\/source' \}/);
  assert.match(source, /buildManagedProotArgs\(/);
  assert.doesNotMatch(source, /\{ source: preservedSource, target: '\/mnt\/source' \}/);
});

function preparedRuntimeFixture() {
  const f = fixture();
  const version = 'debian12-photomap-20261106-v1';
  const directory = path.join(f.instance, 'runtime');
  const versionRoot = path.join(directory, 'versions', version);
  mkdirSync(versionRoot, { recursive: true, mode: 0o700 });
  f.write(path.join(directory, 'active-version.json'), { selected_runtime: version });
  const runtime = JSON.parse(readFileSync(f.runtime, 'utf8'));
  f.write(f.runtime, {
    ...runtime,
    enabled: true,
    launch_allowed: true,
    managed_proot_snapshot: true,
  });
  const profile = path.join(versionRoot, 'profile.json');
  const ready = {
    source_release: 'import-20261106',
    runtime_version: version,
    isolated_rootfs: true,
    status: 'approved-manual',
    launch_allowed: true,
    activation_approved: true,
    python_executable: '/opt/photomap-venv/bin/python',
    autostart: false,
    port: 8010,
    requirements_sha256: 'a'.repeat(64),
  };
  return { ...f, profile, ready };
}

test('copied Debian remains inert even if only top-level launch flags are changed', async () => {
  const f = preparedRuntimeFixture();
  try {
    f.write(f.profile, {
      ...f.ready,
      isolated_rootfs: false,
      status: 'staged-unapproved',
      launch_allowed: false,
      activation_approved: false,
    });
    const host = new ManagedPhotoMapRuntimeHost(f.root);
    assert.throws(() => host.inspect(), /Unsafe runtime version profile/);
    await assert.rejects(host.start(), /Unsafe runtime version profile/);
  } finally {
    rmSync(f.parent, { recursive: true, force: true });
  }
});

test('runtime launch requires every explicit profile and interpreter approval field', () => {
  for (const change of [
    { status: 'staged-unapproved' },
    { launch_allowed: false },
    { activation_approved: false },
    { isolated_rootfs: false },
    { python_executable: '/opt/pockethost-venv/bin/python' },
    { python_executable: '../photomap-venv/bin/python' },
    { autostart: true },
    { source_release: 'external-release' },
    { requirements_sha256: 'bad-digest' },
  ]) {
    const f = preparedRuntimeFixture();
    try {
      f.write(f.profile, { ...f.ready, ...change });
      assert.throws(
        () => new ManagedPhotoMapRuntimeHost(f.root).inspect(),
        /Unsafe runtime version profile/,
        JSON.stringify(change),
      );
    } finally {
      rmSync(f.parent, { recursive: true, force: true });
    }
  }
});

test('PRoot launcher uses the verified guest Python and never executes host Python', () => {
  const source = readFileSync(
    new URL('../../src/modules/host/photomap-runtime-plan.ts', import.meta.url),
    'utf8',
  );
  assert.match(source, /const GUEST_PYTHON = '\/opt\/photomap-venv\/bin\/python'/);
  assert.match(source, / {6}GUEST_PYTHON,/);
  assert.match(source, /buildManagedProotArgs\(/);
  assert.doesNotMatch(source, /'\/opt\/pockethost-venv\/bin\/python'/);
  assert.match(source, /profile\.activation_approved !== true/);
});
