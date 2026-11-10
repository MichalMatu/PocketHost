import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { test } from 'node:test';
import { probeInternetConnectivity, allowsInternetProbeRequest } from '../../src/modules/host/internet-connectivity.ts';

function fakeSocket(event) {
  const s = new EventEmitter();
  s.setTimeout = (timeout) => {
    assert.equal(timeout, 2200);
    queueMicrotask(() => s.emit(event, event === 'error' ? Error('offline') : undefined));
    return s;
  };
  s.destroy = () => s;
  return s;
}

test('one fixed TCP target and measured success', async () => {
  let clock = 100;
  const result = await probeInternetConnectivity(({ host, port }) => {
    assert.equal(host, '1.1.1.1');
    assert.equal(port, 443);
    return fakeSocket('connect');
  }, () => (clock += 23), () => '2026-11-10T11:00:00.000Z');
  assert.deepEqual(result, {
    version: 1, source: 'termux', method: 'tcp-handshake', target: '1.1.1.1:443',
    observedAt: '2026-11-10T11:00:00.000Z', state: 'reachable', latencyMs: 23,
  });
});

test('timeout, errors and refused socket never fabricate successful latency', async () => {
  for (const event of ['error', 'timeout', 'close']) {
    const r = await probeInternetConnectivity(() => fakeSocket(event));
    assert.equal(r.state, 'unreachable');
    assert.equal(r.latencyMs, null);
  }
  const r = await probeInternetConnectivity(() => { throw Error('EPERM'); });
  assert.equal(r.state, 'unreachable');
  assert.equal(r.latencyMs, null);
});

test('fixed localhost owner route rejects foreign address, cross-site and mutations', () => {
  const ok = { host: '127.0.0.1:8787', remote: '127.0.0.1', method: 'GET', route: '/' };
  assert.equal(allowsInternetProbeRequest(ok), true);
  for (const modified of [
    { host: 'evil.example' }, { origin: 'http://evil.example' },
    { remote: '192.168.0.100' }, { fetchSite: 'cross-site' },
    { method: 'POST' }, { route: '/scan' },
  ]) assert.equal(allowsInternetProbeRequest({ ...ok, ...modified }), false);
});
