import assert from 'node:assert/strict';
import test from 'node:test';
import { createManagedRuntimeRegistry } from '../../src/modules/runtime/managed-runtime-registry.ts';

function registration(id, port) {
  const identity = { id, port, sourceRelease: 'release-v1' };
  const snapshot = {
    version: 1, id, port, sourceRelease: 'release-v1',
    ownership: 'pockethost', runtimeVersion: 'v1',
    state: 'stopped', manualStartAllowed: true, autostart: false, healthy: null,
  };
  return { identity, port: {
    inspect: () => ({ ...snapshot }),
    start: async () => ({ ...snapshot, state: 'running' }),
    stop: async () => ({ ...snapshot, state: 'stopped' }),
    health: async () => false,
    readLogs: () => [],
  } };
}
test('neutral registry admits multiple independent owned adapters', async () => {
  const x = createManagedRuntimeRegistry([registration('site-alpha', 19010), registration('site-beta', 19011)]);
  assert.deepEqual(x.list(), ['site-alpha', 'site-beta']);
  assert.equal((await x.resolve('site-beta').start()).state, 'running');
  assert.throws(() => x.resolve('unknown'), /Unregistered/);
});
test('duplicate IDs, ports, invalid names, and unsafe ports are rejected', () => {
  for (const entries of [
    [registration('same-id', 19010), registration('same-id', 19011)],
    [registration('site-a', 19010), registration('site-b', 19010)],
    [registration('../escape', 19010)],
    [registration('site-a', 80)],
    [registration('site-a', 70000)],
  ]) {
    assert.throws(() => createManagedRuntimeRegistry(entries), /Invalid or conflicting/);
  }
});
test('registration is not automatic discovery or filesystem adoption', () => {
  const registry = createManagedRuntimeRegistry([]);
  assert.deepEqual(registry.list(), []);
  assert.throws(() => registry.resolve('photomap-test'), /Unregistered/);
});
