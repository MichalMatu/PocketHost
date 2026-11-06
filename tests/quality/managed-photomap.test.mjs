import assert from 'node:assert/strict';
import test from 'node:test';
import os from 'node:os';
import path from 'node:path';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { ManagedPhotoMapHost } from '../../src/modules/host/managed-photomap-host.ts';

const id = 'photomap-test';
const release = 'import-20261106';
const base = { schema_version: 1, owner: 'pockethost', instance_id: id };

function fixture() {
  const parent = mkdtempSync(path.join(os.tmpdir(), 'pockethost-managed-p4-'));
  const root = path.join(parent, 'PocketHost-Managed');
  const instance = path.join(root, 'instances', id);
  const target = path.join(instance, 'releases', release);
  const snap = path.join(instance, 'snapshots', release);
  for (const folder of [
    path.join(root, 'registry'),
    path.join(instance, 'manifests'),
    path.join(target, 'source'),
    snap,
  ]) {
    mkdirSync(folder, { recursive: true, mode: 0o700 });
  }
  const write = (p, data) =>
    writeFileSync(p, JSON.stringify({ ...base, ...data }) + '\n', { mode: 0o600 });
  const files = {
    registry: path.join(root, 'registry', id + '.json'),
    instance: path.join(instance, 'manifests', 'instance.json'),
    runtime: path.join(instance, 'manifests', 'runtime.json'),
    packages: path.join(instance, 'manifests', 'packages.json'),
    current: path.join(instance, 'current.json'),
    source: path.join(target, 'source-manifest.json'),
    data: path.join(snap, 'data-manifest.json'),
  };
  write(files.registry, {
    status: 'imported-stopped',
    instance_path: 'instances/photomap-test',
    runtime_enabled: false,
    managed_version: release,
  });
  write(files.instance, { release_id: release });
  write(files.runtime, {
    enabled: false,
    autostart: false,
    launch_allowed: false,
    port: 8010,
    runtime_kind: 'debian-proot',
    managed_proot_snapshot: false,
  });
  write(files.packages, {
    release_id: release,
    allow_package_update: false,
    allow_package_rollback: false,
    proot_python_environment: 'external-unfrozen',
    termux_tool_versions: Object.fromEntries(
      ['node', 'npm', 'git', 'python3', 'proot', 'proot-distro'].map((name) => [
        name,
        { available: true, version: ['v1.2.3'] },
      ]),
    ),
    lockfiles: [{ path: 'backend/requirements.txt', sha256: 'a'.repeat(64) }],
  });
  write(files.current, { selected_release: release, active_process: null, status: 'stopped' });
  write(files.source, { release_id: release });
  write(files.data, {
    release_id: release,
    database: { bytes: 19574784 },
    media: { private: { files: 1098 }, public: { files: 1098 } },
  });
  return { parent, root, files, write };
}

test('P4 catalog accepts only the explicitly imported, stopped and disabled PhotoMap', () => {
  const f = fixture();
  try {
    const snap = new ManagedPhotoMapHost(f.root).inspect();
    assert.equal(snap.id, 'photomap-test');
    assert.equal(snap.ownership, 'pockethost');
    assert.equal(snap.importState, 'verified-copy');
    assert.equal(snap.runtimeState, 'disabled');
    assert.equal(snap.release, release);
    assert.equal(snap.data?.databaseBytes, 19574784);
    assert.equal(snap.data?.privateMediaFiles, 1098);
    assert.equal(snap.data?.publicMediaFiles, 1098);
    assert.deepEqual(snap.capabilities, { startStop: false, packages: false, rollback: false });
    assert.equal(snap.dependencies?.isolatedRollback, false);
    assert.equal(snap.tools.length, 6);
    assert.equal(snap.lockfiles.length, 1);
    assert.equal(snap.lockfiles[0].sha256, 'a'.repeat(64));
    assert.equal('origin_checkout' in snap, false);
  } finally {
    rmSync(f.parent, { recursive: true, force: true });
  }
});

test('P4 handles the real import shape: >64 KiB per-file media inventory', () => {
  const f = fixture();
  try {
    const entries = Array.from({ length: 2196 }, (_, i) => ({
      path: 'media/' + String(i).padStart(4, '0') + '.jpg',
      bytes: 1024,
      sha256: 'b'.repeat(64),
    }));
    const record = JSON.parse(readFileSync(f.files.data, 'utf8'));
    f.write(f.files.data, {
      ...record,
      media: {
        private: { files: 1098, entries: entries.slice(0, 1098) },
        public: { files: 1098, entries: entries.slice(1098) },
      },
    });
    assert.ok(readFileSync(f.files.data).byteLength > 65536);
    const snapshot = new ManagedPhotoMapHost(f.root).inspect();
    assert.equal(snapshot.data?.privateMediaFiles, 1098);
    assert.equal(snapshot.data?.publicMediaFiles, 1098);
  } finally {
    rmSync(f.parent, { recursive: true, force: true });
  }
});

test('unknown root is not silently adopted', () => {
  const parent = mkdtempSync(path.join(os.tmpdir(), 'pockethost-p4-empty-'));
  try {
    const snap = new ManagedPhotoMapHost(path.join(parent, 'no-instance')).inspect();
    assert.equal(snap.ownership, 'none');
    assert.equal(snap.importState, 'absent');
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});

test('P4 rejects forged ownership, enabled launch, package changes and release traversal', () => {
  const cases = [
    ['registry', { owner: 'external' }],
    ['registry', { instance_path: '../../something' }],
    ['runtime', { launch_allowed: true }],
    ['runtime', { autostart: true }],
    ['runtime', { enabled: true }],
    ['runtime', { port: 8080 }],
    ['runtime', { managed_proot_snapshot: true }],
    ['packages', { allow_package_update: true }],
    ['packages', { allow_package_rollback: true }],
    ['packages', { proot_python_environment: 'global' }],
    ['packages', { lockfiles: [{ path: '../../private', sha256: 'a'.repeat(64) }] }],
    ['packages', { termux_tool_versions: {} }],
    ['current', { selected_release: '../foreign' }],
    ['current', { active_process: { pid: 1 } }],
    ['data', { media: { private: { files: -1 }, public: { files: 0 } } }],
  ];
  for (const [key, override] of cases) {
    const f = fixture();
    try {
      const original = JSON.parse(readFileSync(f.files[key], 'utf8'));
      f.write(f.files[key], { ...original, ...override });
      assert.throws(() => new ManagedPhotoMapHost(f.root).inspect(), undefined, key);
    } finally {
      rmSync(f.parent, { recursive: true, force: true });
    }
  }
});

test('symlink at owned root or manifest is never followed', () => {
  const f = fixture();
  try {
    const alt = path.join(f.parent, 'linked');
    symlinkSync(f.root, alt);
    assert.throws(() => new ManagedPhotoMapHost(alt).inspect(), /canonical/);
    rmSync(f.files.runtime);
    symlinkSync(f.files.instance, f.files.runtime);
    assert.throws(() => new ManagedPhotoMapHost(f.root).inspect(), /Unsafe/);
  } finally {
    rmSync(f.parent, { recursive: true, force: true });
  }
});

test('P4 source includes only a read-only fixed GET route and never exposes host commands', () => {
  const vite = readFileSync(new URL('../../apps/admin/vite.config.ts', import.meta.url), 'utf8');
  const page = readFileSync(
    new URL('../../apps/admin/src/app/managed-projects/page.tsx', import.meta.url),
    'utf8',
  );
  assert.match(vite, /managedPhotoMapApi\(\)/);
  assert.match(vite, /ManagedPhotoMapHost\(\)\.inspect\(\)/);
  assert.match(vite, /managed-photomap/);
  assert.match(vite, /request\.method !== "GET"/);
  assert.match(page, /Project start \/ stop/);
  assert.doesNotMatch(page, /method: "POST"|child_process|exec\(|spawn\(/);
});
