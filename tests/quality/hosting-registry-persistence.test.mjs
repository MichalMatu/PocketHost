import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openHostingRegistry } from '../../src/modules/config/hosting-registry-persistence.ts';
import { HostingRegistryFile } from '../../src/modules/host/hosting-registry-file.ts';

function valid() {
  return {
    schemaVersion: 1,
    modules: [{ schemaVersion: 1, id: 'node', version: 1, capabilities: ['node'] }],
    services: [{
      schemaVersion: 1, id: 'api', name: 'pockethost-demo-api',
      projectId: 'demo', moduleId: 'node', state: 'planned',
    }],
    projects: [{
      schemaVersion: 1, id: 'demo', origin: 'created-in-pockethost',
      components: [{
        id: 'backend', moduleId: 'node', moduleVersion: 1, role: 'backend',
        port: 19100, serviceId: 'api', secrets: [{ kind: 'secret-ref', id: 'sec-demo123' }],
      }],
    }],
  };
}

function fixture() {
  const root = mkdtempSync(path.join(os.tmpdir(), 'pockethost-m1-registry-'));
  const file = path.join(root, 'private', 'registry.json');
  return { root, file, storage: new HostingRegistryFile(file) };
}

test('M1 persists only validated declarations with private permissions and no service calls', () => {
  const { root, file, storage } = fixture();
  try {
    const initial = openHostingRegistry(storage, [8787, 18878]);
    assert.equal(initial.revision, 0);
    assert.deepEqual(initial.declarations.projects, []);
    assert.equal(initial.commit(valid()).revision, 1);
    assert.equal(statSync(file).mode & 0o077, 0);
    const loaded = openHostingRegistry(storage, [8787, 18878]);
    assert.equal(loaded.revision, 1);
    assert.equal(loaded.declarations.projects[0].components[0].port, 19100);
    assert.ok(readFileSync(file, 'utf8').includes('sec-demo123'));
    assert.ok(!readFileSync(file, 'utf8').includes('password'));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('M1 stale competing writers cannot replace the accepted revision', () => {
  const { root, file, storage } = fixture();
  try {
    const first = openHostingRegistry(storage);
    const second = openHostingRegistry(storage);
    first.commit(valid());
    const accepted = readFileSync(file, 'utf8');
    assert.throws(() => second.commit(valid()), /Stale registry revision/);
    assert.throws(() => first.commit(valid()), /Stale registry revision/);
    assert.equal(readFileSync(file, 'utf8'), accepted);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('M1 accepts old bare version-one declarations and migrates only on explicit commit', () => {
  const { root, file, storage } = fixture();
  try {
    mkdirSync(path.dirname(file));
    const legacy = JSON.stringify(valid()) + '\n';
    writeFileSync(file, legacy, { mode: 0o600 });
    const opened = openHostingRegistry(storage);
    assert.equal(opened.revision, 0);
    assert.equal(readFileSync(file, 'utf8'), legacy);
    opened.commit(opened.declarations);
    assert.equal(openHostingRegistry(storage).revision, 1);
    assert.equal(JSON.parse(readFileSync(file, 'utf8')).storageVersion, 1);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('M1 denies foreign state, plaintext secret values, unavailable ports and unknown schemas', () => {
  const { root, file, storage } = fixture();
  try {
    assert.throws(() => openHostingRegistry(storage, [19100]).commit(valid()), /port collision/);
    assert.equal(storage.read(), null);
    const foreign = valid();
    foreign.projects[0].origin = 'observed';
    assert.throws(() => openHostingRegistry(storage).commit(foreign), /External observations/);
    const secret = valid();
    secret.projects[0].components[0].secrets[0].value = 'plaintext';
    assert.throws(() => openHostingRegistry(storage).commit(secret), /Unknown registry field/);
    mkdirSync(path.dirname(file));
    writeFileSync(file, '{"storageVersion":2,"revision":1,"declarations":{}}', { mode: 0o600 });
    assert.throws(() => openHostingRegistry(storage), /Unsupported registry storage version/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('M1 symlinked files and parent directories cannot redirect registry writes', () => {
  const { root, file } = fixture();
  const outside = path.join(root, 'outside.json');
  try {
    writeFileSync(outside, 'unchanged', { mode: 0o600 });
    mkdirSync(path.dirname(file));
    symlinkSync(outside, file);
    assert.throws(() => new HostingRegistryFile(file).read(), /Unsafe registry file/);
    rmSync(file);
    rmSync(path.dirname(file), { recursive: true, force: true });
    symlinkSync(root, path.dirname(file));
    assert.throws(
      () => new HostingRegistryFile(file).compareAndSwap(null, '{}'),
      /Unsafe registry directory/,
    );
    assert.equal(readFileSync(outside, 'utf8'), 'unchanged');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
