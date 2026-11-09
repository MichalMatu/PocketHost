import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHostingRegistryStore } from '../../src/modules/config/hosting-registry-store.ts';

function declarations() {
  return {
    schemaVersion: 1,
    modules: [{ schemaVersion: 1, id: 'node', version: 1, capabilities: ['node'] }],
    services: [],
    projects: [{
      schemaVersion: 1, id: 'sample', origin: 'created-in-pockethost',
      components: [{
        id: 'backend', moduleId: 'node', moduleVersion: 1, role: 'backend',
        port: 19100, serviceId: null, secrets: [],
      }],
    }],
  };
}

function fixture(fn) {
  const root = mkdtempSync(path.join(os.tmpdir(), 'pockethost-m1-'));
  try { fn(root); } finally { rmSync(root, { recursive: true, force: true }); }
}

test('M1 store writes only explicit private directory and survives reopen', () => fixture((root) => {
  const store = createHostingRegistryStore(root);
  assert.equal(store.read(), null);
  const input = declarations();
  assert.equal(store.save(input, 0).revision, 1);
  input.projects[0].components[0].port = 19999;
  const reopened = createHostingRegistryStore(root);
  assert.equal(reopened.read().declarations.projects[0].components[0].port, 19100);
  assert.equal(reopened.save(declarations(), 1).revision, 2);
  assert.equal(reopened.read().revision, 2);
  assert.throws(() => store.save(declarations(), 1), /Stale registry revision/);
}));

test('M1 store rejects invalid ownership, imports, secrets and linked paths', () => fixture((root) => {
  const store = createHostingRegistryStore(root);
  const foreign = declarations();
  foreign.projects[0].origin = 'observed';
  assert.throws(() => store.save(foreign, 0), /External observations/);
  const secret = declarations();
  secret.projects[0].components[0].secrets = [{ kind: 'secret-ref', id: 'sec-example', value: 'plaintext' }];
  assert.throws(() => store.save(secret, 0), /Unknown registry field/);
  const target = path.join(root, 'hosting-declarations.json');
  writeFileSync(target, JSON.stringify({ owner: 'external', schemaVersion: 1, revision: 1, declarations: declarations() }));
  assert.throws(() => store.read(), /Invalid registry ownership/);
  assert.throws(() => store.save(declarations(), 0), /Invalid registry ownership/);
  rmSync(target);
  const external = path.join(root, 'unrelated.json');
  writeFileSync(external, 'preserve');
  symlinkSync(external, target);
  assert.throws(() => store.read(), /Unsafe registry file/);
  assert.throws(() => store.save(declarations(), 0), /Unsafe registry file/);
  assert.equal(readFileSync(external, 'utf8'), 'preserve');
}));

test('M1 store refuses missing directories and pre-existing concurrent lock', () => fixture((root) => {
  const missing = createHostingRegistryStore(path.join(root, 'missing'));
  assert.throws(() => missing.save(declarations(), 0));
  const lock = path.join(root, '.hosting-declarations.lock');
  writeFileSync(lock, 'held');
  assert.throws(() => createHostingRegistryStore(root).save(declarations(), 0), /EEXIST/);
  assert.equal(readFileSync(lock, 'utf8'), 'held');
  const nested = path.join(root, 'nested');
  mkdirSync(nested);
  const linked = path.join(root, 'link');
  symlinkSync(nested, linked, 'dir');
  assert.throws(() => createHostingRegistryStore(linked).read(), /canonical directory/);
}));
