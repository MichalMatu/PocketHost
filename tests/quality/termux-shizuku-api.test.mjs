import assert from 'node:assert/strict';
import test from 'node:test';
import { shizukuCompanionApi } from '../../apps/admin/plugins/shizuku-companion-api.ts';
import { remoteShellApi } from '../../apps/admin/plugins/remote-shell-api.ts';
import { androidActionApi } from '../../apps/admin/plugins/android-action-api.ts';
import { termuxToolsApi } from '../../apps/admin/plugins/termux-tools-api.ts';

function fixture(plugin) {
  const handlers = new Map();
  assert.equal(plugin.apply, 'serve');
  plugin.configureServer({
    middlewares: {
      use(route, callback) {
        assert.equal(handlers.has(route), false);
        handlers.set(route, callback);
      },
    },
  });
  return {
    routes: [...handlers.keys()],
    async request(route, changes = {}, body = '') {
      const handler = handlers.get(route);
      assert.equal(typeof handler, 'function');
      let result;
      let ended = 0;
      const headers = new Map();
      const request = {
        method: 'GET',
        url: '/',
        headers: { host: '127.0.0.1:8787' },
        socket: { remoteAddress: '127.0.0.1' },
        async *[Symbol.asyncIterator]() {
          yield Buffer.from(body);
        },
        ...changes,
      };
      const response = {
        statusCode: 200,
        setHeader(name, value) {
          headers.set(name.toLowerCase(), value);
        },
        end(value) {
          result = value;
          ended++;
        },
      };
      await handler(request, response);
      assert.equal(ended, 1);
      assert.equal(headers.get('cache-control'), 'no-store');
      assert.equal(headers.get('x-content-type-options'), 'nosniff');
      return { status: response.statusCode, body: JSON.parse(result), headers };
    },
  };
}

test('tool adapter preserves read-only routes without executing tools', async () => {
  let calls = 0;
  const api = fixture(
    termuxToolsApi(() => {
      calls++;
      return { version: 1, mode: 'read-only', tools: [] };
    }),
  );
  const route = '/api/v1/termux-tools';
  assert.deepEqual(api.routes, [route]);
  assert.equal((await api.request(route, { method: 'POST' })).status, 405);
  assert.equal((await api.request(route, { url: '/other' })).status, 404);
  assert.equal((await api.request(route, { headers: { host: 'foreign.test' } })).status, 403);
  assert.equal(calls, 0);
  assert.deepEqual((await api.request(route)).body, {
    version: 1,
    mode: 'read-only',
    tools: [],
  });
  assert.equal(calls, 1);
});

test('companion reads preserve route order, package validation and failure responses', async () => {
  const calls = [];
  const api = fixture(
    shizukuCompanionApi({
      readCompanionSystem: async () => {
        calls.push('system');
        return { state: 'ok' };
      },
      readCompanionApp: async (name) => {
        calls.push(name);
        return { name };
      },
      readCompanionApps: async () => {
        calls.push('apps');
        return { apps: [] };
      },
      readCompanionStatus: async () => {
        calls.push('status');
        throw Error('fixture private error');
      },
    }),
  );
  const base = '/api/v1/shizuku';
  assert.deepEqual(
    api.routes,
    ['system', 'app', 'apps', 'status'].map((r) => base + '/' + r),
  );
  for (const route of api.routes) {
    assert.equal((await api.request(route, { method: 'POST' })).status, 405);
    assert.equal(
      (await api.request(route, { socket: { remoteAddress: '192.0.2.1' } })).status,
      403,
    );
  }
  const app = base + '/app';
  assert.equal((await api.request(app, { url: '/?package=bad' })).status, 400);
  assert.equal(
    (await api.request(app, { url: '/?package=com.example&package=com.other' })).status,
    400,
  );
  assert.deepEqual(calls, []);
  assert.deepEqual((await api.request(base + '/system')).body, { state: 'ok' });
  assert.deepEqual((await api.request(app, { url: '/?package=com.example' })).body, {
    name: 'com.example',
  });
  assert.deepEqual((await api.request(base + '/apps')).body, { apps: [] });
  const failure = await api.request(base + '/status');
  assert.equal(failure.status, 503);
  assert.deepEqual(failure.body, { error: 'companion-not-connected' });
  assert.deepEqual(calls, ['system', 'com.example', 'apps', 'status']);
});

test('native action and shell adapters only forward validated envelopes to fixed endpoints', async () => {
  const calls = [];
  const forward = async (url, options) => {
    calls.push({ url, options });
    return new Response('{"fixture":true}', { status: 202 });
  };
  const cases = [
    {
      api: fixture(remoteShellApi(forward)),
      route: '/api/v1/shizuku/remote-shell',
      native: 'http://127.0.0.1:18791/shell/run',
      payload: { command: 'id' },
    },
    {
      api: fixture(androidActionApi(forward)),
      route: '/api/v1/shizuku/action',
      native: 'http://127.0.0.1:18791/action/run',
      payload: { action: 'launch', target: 'com.example.app', value: '' },
    },
  ];
  const headers = {
    host: '127.0.0.1:8787',
    origin: 'http://127.0.0.1:8787',
    'content-type': 'application/json',
  };
  const request = { method: 'POST', url: '/run', headers };
  for (const { api, route, native, payload } of cases) {
    assert.equal((await api.request(route)).status, 403);
    assert.equal((await api.request(route, { ...request, url: '/other' })).status, 405);
    assert.equal((await api.request(route, request, '{}')).status, 400);
    assert.equal(
      (
        await api.request(
          route,
          { ...request, headers: { ...headers, 'content-length': '2049' } },
          JSON.stringify(payload),
        )
      ).status,
      400,
    );
    assert.equal(
      calls.some((call) => call.url === native),
      false,
    );
    const result = await api.request(route, request, JSON.stringify(payload));
    assert.equal(result.status, 202);
    assert.deepEqual(result.body, { fixture: true });
    const call = calls.at(-1);
    assert.equal(call.url, native);
    assert.equal(call.options.method, 'POST');
    assert.equal(call.options.redirect, 'error');
    assert.deepEqual(JSON.parse(call.options.body), payload);
  }
  assert.equal(calls.length, 2);
});
