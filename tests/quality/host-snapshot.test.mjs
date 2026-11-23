import assert from 'node:assert/strict';
import test from 'node:test';
import {
  parseRunitStatus,
  probeServiceState,
  readStorageSnapshot,
  readHostSnapshot,
} from '../../src/modules/host/host-snapshot.ts';

test('runit statuses are bounded and do not reveal process PIDs', () => {
  assert.equal(parseRunitStatus('run: /srv/site (pid 42) 10s'), 'running');
  assert.equal(parseRunitStatus('down: /srv/site 1s'), 'stopped');
  assert.equal(parseRunitStatus('fail: runsv not running'), 'unknown');
  assert.equal(parseRunitStatus(null), 'unknown');
});

test('path traversal is rejected before any service probe', () => {
  let calls = 0;
  assert.throws(
    () =>
      probeServiceState('../../secrets', () => {
        calls++;
        return 'run: bad';
      }),
    /Invalid service identifier/,
  );
  assert.equal(calls, 0);
});

test('generic runit service name is observed without project aliases', () => {
  const names = [];
  const state = probeServiceState('app-worker', (name) => {
    names.push(name);
    return 'run: /some/path (pid 987654) 100s';
  });
  assert.equal(state, 'running');
  assert.deepEqual(names, ['app-worker']);
});

test('storage probe returns bounded MiB counts without filesystem paths', () => {
  const stats = readStorageSnapshot(() => ({
    bsize: 4096n,
    blocks: 1000000n,
    bavail: 250000n,
  }));
  assert.deepEqual(stats, { totalMiB: 3906, availableMiB: 976 });
});

test('storage probe fails closed on missing or invalid stats', () => {
  assert.equal(
    readStorageSnapshot(() => {
      throw new Error('denied');
    }),
    null,
  );
  assert.equal(
    readStorageSnapshot(() => ({
      bsize: -1n,
      blocks: 10n,
      bavail: 5n,
    })),
    null,
  );
  assert.equal(
    readStorageSnapshot(() => ({
      bsize: 4096n,
      blocks: 10n,
      bavail: 11n,
    })),
    null,
  );
});

test('snapshot derives its service list from generic runit inventory', () => {
  const services = [
    { name: 'ssh-server', state: 'stopped', registered: false, protected: true, enabled: false },
    {
      name: 'pockethost-example',
      state: 'running',
      registered: true,
      protected: false,
      enabled: true,
    },
  ];
  const snapshot = readHostSnapshot(
    () => services,
    () => '2026-11-14T20:00:00.000Z',
    () => ({ totalMiB: 10000, availableMiB: 5000 }),
  );
  assert.equal(snapshot.mode, 'read-only');
  assert.deepEqual(
    snapshot.services.map((s) => s.id),
    ['ssh-server', 'pockethost-example'],
  );
  assert.deepEqual(
    snapshot.services.map((s) => s.state),
    ['stopped', 'running'],
  );
  assert.ok(snapshot.services.every((s) => s.ownership === 'external'));
  assert.equal(snapshot.runtime.storage.availableMiB, 5000);
  assert.equal(JSON.stringify(snapshot).includes('token'), false);
});

test('empty host may report zero discovered runit services', () => {
  const snapshot = readHostSnapshot(
    () => [],
    () => '2026-11-14T20:00:00.000Z',
    () => null,
  );
  assert.deepEqual(snapshot.services, []);
});
