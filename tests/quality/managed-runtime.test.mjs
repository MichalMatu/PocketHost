import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createManagedRuntime,
  ManagedRuntimeBlockedError,
  ManagedRuntimeOwnershipError,
} from '../../src/modules/runtime/managed-runtime.ts';

const expected = { id: 'second-owned-site', port: 19001, sourceRelease: 'second-v1' };

function fixture() {
  let state = {
    version: 1,
    id: expected.id,
    ownership: 'pockethost',
    sourceRelease: expected.sourceRelease,
    runtimeVersion: 'stable-v1',
    state: 'stopped',
    port: expected.port,
    autostart: false,
    manualStartAllowed: true,
    healthy: null,
  };
  const actions = [];
  const port = {
    inspect: () => ({ ...state }),
    start: async () => {
      actions.push('start');
      state = { ...state, state: 'running' };
      return { ...state };
    },
    stop: async () => {
      actions.push('stop');
      state = { ...state, state: 'stopped' };
      return { ...state };
    },
    health: async () => true,
    readLogs: () => ['started', 'password=secret', 'Bearer opaque'],
  };
  return {
    runtime: createManagedRuntime(port, expected),
    actions,
    set: (change) => {
      state = { ...state, ...change };
    },
  };
}

test('generic runtime manages an unrelated owned project without PhotoMap constants', async () => {
  const f = fixture();
  assert.equal((await f.runtime.start()).state, 'running');
  assert.equal((await f.runtime.start()).state, 'running');
  assert.equal(await f.runtime.health(), true);
  assert.equal((await f.runtime.stop()).state, 'stopped');
  assert.equal((await f.runtime.stop()).state, 'stopped');
  assert.deepEqual(f.actions, ['start', 'stop']);
});

test('foreign owner, id, port, release and autostart fail closed before side effects', async () => {
  for (const changed of [
    { ownership: 'none' },
    { id: 'photomap-test' },
    { port: 8010 },
    { sourceRelease: 'foreign-release' },
    { autostart: true },
    { state: 'alien' },
  ]) {
    const f = fixture();
    f.set(changed);
    await assert.rejects(f.runtime.start(), ManagedRuntimeOwnershipError);
    assert.deepEqual(f.actions, []);
  }
});

test('unknown or disabled lifecycle and unapproved versions cannot execute', async () => {
  for (const changed of [
    { state: 'unknown' },
    { state: 'disabled' },
    { manualStartAllowed: false },
    { runtimeVersion: '../escape' },
    { runtimeVersion: null },
  ]) {
    const f = fixture();
    f.set(changed);
    await assert.rejects(f.runtime.start(), ManagedRuntimeBlockedError);
    assert.deepEqual(f.actions, []);
  }
});

test('sensitive fields in generic runtime logs are redacted and bounded', () => {
  const f = fixture();
  assert.deepEqual(f.runtime.logs(), ['started', 'password=[redacted]', 'Bearer [redacted]']);
});
