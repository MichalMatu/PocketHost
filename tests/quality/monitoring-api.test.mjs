import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import test from 'node:test';
import { observabilityApi } from '../../apps/admin/plugins/observability-api.ts';
import { internetConnectivityApi } from '../../apps/admin/plugins/internet-connectivity-api.ts';
import { dashboardTelemetryApi } from '../../apps/admin/plugins/dashboard-telemetry-api.ts';

function fixture(plugin, route) {
  let handler;
  const httpServer = new EventEmitter();
  assert.equal(plugin.apply, 'serve');
  plugin.configureServer({
    httpServer,
    middlewares: {
      use(path, callback) {
        assert.equal(path, route);
        assert.equal(handler, undefined);
        handler = callback;
      },
    },
  });
  assert.equal(typeof handler, 'function');
  return {
    close: () => httpServer.emit('close'),
    async request(changes = {}) {
      const headers = new Map();
      let body;
      let ended = 0;
      const request = {
        method: 'GET',
        url: '/',
        headers: { host: '127.0.0.1:8787' },
        socket: { remoteAddress: '127.0.0.1' },
        ...changes,
      };
      const response = {
        statusCode: 200,
        setHeader(name, value) {
          headers.set(name.toLowerCase(), value);
        },
        end(value) {
          body = value;
          ended++;
        },
      };
      await handler(request, response);
      assert.equal(ended, 1);
      assert.equal(headers.get('cache-control'), 'no-store');
      assert.equal(headers.get('x-content-type-options'), 'nosniff');
      assert.equal(headers.get('content-security-policy'), "default-src 'none'");
      return { status: response.statusCode, headers, body: JSON.parse(body) };
    },
  };
}

test('observability API keeps history per adapter and skips packages in monitoring scope', async () => {
  const observedAt = '2026-11-24T12:00:00.000Z';
  const reading = { state: 'unavailable', value: null, observedAt };
  let packageCalls = 0;
  let hostCalls = 0;
  const api = fixture(
    observabilityApi({
      readHostSnapshot() {
        hostCalls++;
        return { runtime: { freeMemoryMiB: 40 }, services: [] };
      },
      readHostMetrics: async () => ({
        cpuPercent: reading,
        batteryPercent: reading,
        network: reading,
      }),
      readProcessInventory: () => ({ state: 'ok', truncated: false, processes: [] }),
      readPackageInventory() {
        packageCalls++;
        return { state: 'ok', installed: [], updates: { state: 'cached-unverified' } };
      },
    }),
    '/api/v1/observability',
  );
  assert.equal((await api.request({ url: '/?scope=other' })).status, 404);
  assert.equal((await api.request({ method: 'POST' })).status, 405);
  assert.equal((await api.request({ headers: { host: 'foreign.test' } })).status, 403);
  assert.equal(hostCalls, 0);
  const monitoring = await api.request({ url: '/?scope=monitoring' });
  assert.equal(monitoring.status, 200);
  assert.equal(packageCalls, 0);
  assert.equal(monitoring.body.packages.state, 'unavailable');
  assert.equal(monitoring.body.history.length, 1);
  assert.equal(monitoring.body.alerts.some((s) => s.includes('Package')), false);
  const full = await api.request();
  assert.equal(full.status, 200);
  assert.equal(packageCalls, 1);
  assert.equal(full.body.history.length, 2);
  assert.equal(full.body.packages.state, 'ok');
});

test('observability failure is generic and does not leak probe errors', async () => {
  const api = fixture(
    observabilityApi({
      readHostSnapshot() {
        throw new Error('private probe error');
      },
    }),
    '/api/v1/observability',
  );
  const result = await api.request();
  assert.equal(result.status, 503);
  assert.deepEqual(result.body, { error: 'observation-unavailable' });
});

test('internet API coalesces requests, caches for 12 seconds and retries failures', async () => {
  let calls = 0;
  let time = 100;
  let fail = false;
  let complete;
  const value = { state: 'reachable', latencyMs: 42 };
  const api = fixture(
    internetConnectivityApi(
      () => {
        calls++;
        return fail ? Promise.reject(new Error('private')) : new Promise((r) => (complete = r));
      },
      () => time,
    ),
    '/api/v1/internet-connectivity',
  );
  assert.equal((await api.request({ method: 'POST' })).status, 403);
  assert.equal((await api.request({ url: '/other' })).status, 403);
  assert.equal(calls, 0);
  const a = api.request();
  const b = api.request();
  assert.equal(calls, 1);
  complete(value);
  assert.deepEqual((await a).body, value);
  assert.deepEqual((await b).body, value);
  time += 11999;
  assert.deepEqual((await api.request()).body, value);
  assert.equal(calls, 1);
  time++;
  fail = true;
  assert.equal((await api.request()).status, 503);
  assert.equal((await api.request()).status, 503);
  assert.equal(calls, 3);
});

test('dashboard adapter attaches one collector and stops on close', async () => {
  const events = [];
  const ranges = [];
  const store = {
    history(range) {
      ranges.push(range);
      return { range };
    },
  };
  const api = fixture(
    dashboardTelemetryApi(
      () => ({
        store,
        start: () => events.push('start'),
        stop: () => events.push('stop'),
      }),
      (value) => events.push(value === store ? 'attach' : 'detach'),
    ),
    '/api/v1/dashboard/history',
  );
  assert.deepEqual(events, ['attach', 'start']);
  assert.equal((await api.request({ method: 'POST' })).status, 403);
  assert.equal((await api.request({ url: '/bad' })).status, 404);
  assert.deepEqual(ranges, []);
  assert.deepEqual((await api.request()).body, { range: '1h' });
  api.close();
  api.close();
  assert.deepEqual(events, ['attach', 'start', 'detach', 'stop']);
});
