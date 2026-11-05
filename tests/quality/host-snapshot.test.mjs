import assert from 'node:assert/strict';
import test from 'node:test';
import { SERVICE_CATALOG, parseRunitStatus, probeServiceState, readHostSnapshot } from '../../src/modules/host/host-snapshot.ts';

test('runit response normalization exposes only three statuses', () => {
  assert.equal(parseRunitStatus('run: /a/thing (pid 42) 10s'), 'running');
  assert.equal(parseRunitStatus('down: /a/thing 1s'), 'stopped');
  assert.equal(parseRunitStatus('fail: runsv not running'), 'unknown');
  assert.equal(parseRunitStatus(null), 'unknown');
});

test('inspection allowlist rejects arbitrary service names without probing', () => {
  let calls = 0;
  assert.throws(() => probeServiceState('../../secrets', () => { calls++; return 'run: bad'; }), /allowlist/);
  assert.equal(calls, 0);
});

test('IleStoi status maps to fixed runit service; process detail is not exposed', () => {
  const names = [];
  const state = probeServiceState('ilestoi', (name) => {
    names.push(name);
    return 'run: /some/path (pid 987654) 100s';
  });
  assert.equal(state, 'running');
  assert.deepEqual(names, ['wreckscanner']);
});

test('snapshot includes only allowlisted externally owned services', () => {
  const data = readHostSnapshot(
    (id) => id === 'ilestoi' ? 'running' : 'unknown',
    () => '2026-11-05T12:00:00.000Z',
  );
  assert.equal(data.mode, 'read-only');
  assert.equal(data.platform, 'termux');
  assert.equal(data.observedAt, '2026-11-05T12:00:00.000Z');
  assert.equal(data.services.length, SERVICE_CATALOG.length);
  assert.deepEqual(new Set(data.services.map((service) => service.ownership)), new Set(['external']));
  assert.equal(data.services.find((service) => service.id === 'ilestoi')?.state, 'running');
  assert.equal(JSON.stringify(data).includes('987654'), false);
  assert.equal(JSON.stringify(data).includes('secret'), false);
});
