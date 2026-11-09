import assert from 'node:assert/strict';
import test from 'node:test';
import {
  SERVICE_CATALOG,
  parseRunitStatus,
  probeServiceState,
  readStorageSnapshot,
  readHostSnapshot,
} from '../../src/modules/host/host-snapshot.ts';

test('runit response normalization exposes only three statuses', () => {
  assert.equal(parseRunitStatus('run: /a/thing (pid 42) 10s'), 'running');
  assert.equal(parseRunitStatus('down: /a/thing 1s'), 'stopped');
  assert.equal(parseRunitStatus('fail: runsv not running'), 'unknown');
  assert.equal(parseRunitStatus(null), 'unknown');
});

test('inspection allowlist rejects arbitrary service names without probing', () => {
  let calls = 0;
  assert.throws(
    () =>
      probeServiceState('../../secrets', () => {
        calls++;
        return 'run: bad';
      }),
    /allowlist/,
  );
  assert.equal(calls, 0);
});

test('IleStoi status maps to fixed system runit service; raw PID is not exposed', () => {
  const names = [];
  const state = probeServiceState('ilestoi', (name, scope) => {
    names.push([name, scope]);
    return 'run: /some/path (pid 987654) 100s';
  });
  assert.equal(state, 'running');
  assert.deepEqual(names, [['wreckscanner', 'system']]);
});

test('Local Agent status maps to private runit scope, not a system service', () => {
  const probes = [];
  const state = probeServiceState('local-agent', (name, scope) => {
    probes.push([name, scope]);
    return 'run: /private/runit (pid 123) 3s, normally down';
  });
  assert.equal(state, 'running');
  assert.deepEqual(probes, [['termux-agent', 'local-agent']]);
});

test('storage probe returns bounded MiB counts without filesystem paths', () => {
  const stats = readStorageSnapshot(() => ({
    bsize: 4096n,
    blocks: 1000000n,
    bavail: 250000n,
  }));
  assert.deepEqual(stats, { totalMiB: 3906, availableMiB: 976 });
  assert.deepEqual(Object.keys(stats).sort(), ['availableMiB', 'totalMiB']);
});

test('storage probe fails closed on missing permission, invalid and overflow stats', () => {
  assert.equal(
    readStorageSnapshot(() => {
      throw new Error('permission denied');
    }),
    null,
  );
  assert.equal(
    readStorageSnapshot(() => ({ bsize: -1n, blocks: 10n, bavail: 5n })),
    null,
  );
  assert.equal(
    readStorageSnapshot(() => ({ bsize: 4096n, blocks: 10n, bavail: 11n })),
    null,
  );
  assert.equal(
    readStorageSnapshot(() => ({
      bsize: 999999999999999999n,
      blocks: 99999999999n,
      bavail: 10n,
    })),
    null,
  );
});

test('snapshot includes only allowlisted externally owned services and safe disk data', () => {
  const data = readHostSnapshot(
    (id) => (id === 'ilestoi' || id === 'local-agent' ? 'running' : 'unknown'),
    () => '2026-11-05T12:00:00.000Z',
    () => ({ totalMiB: 40000, availableMiB: 9000 }),
  );
  assert.equal(data.mode, 'read-only');
  assert.equal(data.platform, 'termux');
  assert.equal(data.observedAt, '2026-11-05T12:00:00.000Z');
  assert.equal(data.services.length, SERVICE_CATALOG.length);
  assert.deepEqual(
    new Set(data.services.map((service) => service.ownership)),
    new Set(['external']),
  );
  assert.equal(data.services.find((service) => service.id === 'ilestoi')?.state, 'running');
  assert.equal(data.services.find((service) => service.id === 'local-agent')?.state, 'running');
  assert.equal(data.runtime.storage?.availableMiB, 9000);
  assert.equal(JSON.stringify(data).includes('987654'), false);
  assert.equal(JSON.stringify(data).includes('secret'), false);
  assert.equal(JSON.stringify(data).includes('private/runit'), false);
});

test('legacy service aliases have generic display roles and confer no project ownership', () => {
  assert.deepEqual(
    SERVICE_CATALOG.map((service) => service.id),
    ['ilestoi', 'tunnel', 'ssh', 'mqtt', 'healthwatch', 'local-agent'],
  );
  assert.equal(new Set(SERVICE_CATALOG.map((service) => service.runit)).size, 6);
  assert.ok(SERVICE_CATALOG.every((service) =>
    !/ilestoi|photomap|wreckscanner/i.test(service.label),
  ));
  assert.ok(SERVICE_CATALOG.every((service) =>
    service.scope === 'system' || service.scope === 'local-agent',
  ));
  const snapshot = readHostSnapshot(() => 'unknown', () => '2026-11-09T12:00:00.000Z', () => null);
  assert.ok(snapshot.services.every((service) => service.ownership === 'external'));
});
