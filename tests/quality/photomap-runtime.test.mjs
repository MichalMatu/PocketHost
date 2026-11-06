import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createPhotoMapRuntime,
  PhotoMapOwnershipError,
  PhotoMapRuntimeBlockedError,
} from '../../src/modules/runtime/photomap-runtime.ts';

const snapshot = () => ({
  version: 1,
  id: 'photomap-test',
  ownership: 'pockethost',
  sourceRelease: 'import-20261106',
  runtimeVersion: null,
  state: 'disabled',
  port: 8010,
  autostart: false,
  manualStartAllowed: false,
  healthy: null,
});

function make() {
  let state = snapshot();
  const calls = [];
  const port = {
    inspect: () => ({ ...state }),
    start: async () => {
      calls.push('start');
      state.state = 'running';
      return { ...state };
    },
    stop: async () => {
      calls.push('stop');
      state.state = 'stopped';
      return { ...state };
    },
    health: async () => true,
    readLogs: () => ['starting', 'token=example'],
  };
  return {
    runtime: createPhotoMapRuntime(port),
    calls,
    set: (change) => {
      state = { ...state, ...change };
    },
  };
}

test('imported PhotoMap cannot start or stop', async () => {
  const f = make();
  await assert.rejects(f.runtime.start(), PhotoMapRuntimeBlockedError);
  await assert.rejects(f.runtime.stop(), PhotoMapRuntimeBlockedError);
  assert.equal(await f.runtime.health(), false);
  assert.deepEqual(f.calls, []);
});

test('forged project ownership fails before side effects', async () => {
  const f = make();
  f.set({ ownership: 'none', state: 'running' });
  await assert.rejects(f.runtime.stop(), PhotoMapOwnershipError);
  assert.deepEqual(f.calls, []);
});

test('unknown owned process cannot be terminated', async () => {
  const f = make();
  f.set({ runtimeVersion: 'debian-arm64-v1', state: 'unknown', manualStartAllowed: true });
  await assert.rejects(f.runtime.stop(), PhotoMapRuntimeBlockedError);
  await assert.rejects(f.runtime.start(), PhotoMapRuntimeBlockedError);
  assert.deepEqual(f.calls, []);
});

test('manual owned lifecycle is idempotent and explicit', async () => {
  const f = make();
  f.set({ runtimeVersion: 'debian-arm64-v1', state: 'stopped', manualStartAllowed: true });
  assert.equal((await f.runtime.start()).state, 'running');
  assert.equal((await f.runtime.start()).state, 'running');
  assert.equal((await f.runtime.stop()).state, 'stopped');
  assert.equal((await f.runtime.stop()).state, 'stopped');
  assert.deepEqual(f.calls, ['start', 'stop']);
});

test('logs are sanitized by the typed runtime port', () => {
  const f = make();
  assert.deepEqual(f.runtime.logs(), ['starting', 'token=[redacted]']);
});
