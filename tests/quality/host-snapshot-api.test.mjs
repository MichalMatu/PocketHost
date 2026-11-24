import assert from 'node:assert/strict';
import test from 'node:test';
import { termuxReadOnlyApi } from '../../apps/admin/plugins/host-snapshot-api.ts';

function fixture(readSnapshot) {
  let handler;
  const plugin = termuxReadOnlyApi(readSnapshot);
  assert.equal(plugin.name, 'pockethost-read-only-host');
  assert.equal(plugin.apply, 'serve');
  plugin.configureServer({
    middlewares: {
      use(route, callback) {
        assert.equal(route, '/api/v1/host/snapshot');
        assert.equal(handler, undefined);
        handler = callback;
      },
    },
  });
  assert.equal(typeof handler, 'function');
  return (changes = {}) => {
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
      statusCode: 0,
      setHeader(name, value) {
        headers.set(name.toLowerCase(), value);
      },
      end(value) {
        body = value;
        ended++;
      },
    };
    handler(request, response);
    assert.equal(ended, 1);
    return { status: response.statusCode, headers, body };
  };
}

test('snapshot API preserves both allowed loopback hosts and query routing', () => {
  let calls = 0;
  const payload = { version: 1, mode: 'read-only', services: [] };
  const request = fixture(() => {
    calls++;
    return payload;
  });
  for (const host of ['127.0.0.1:8787', 'localhost:8787']) {
    const result = request({
      url: '/?scope=monitoring',
      headers: { host, origin: 'http://' + host },
      socket: { remoteAddress: '::ffff:127.0.0.1' },
    });
    assert.equal(result.status, 200);
    assert.deepEqual(JSON.parse(result.body), payload);
    assert.equal(result.headers.get('content-type'), 'application/json; charset=utf-8');
    assert.equal(result.headers.get('cache-control'), 'no-store');
    assert.equal(result.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(result.headers.get('content-security-policy'), "default-src 'none'");
  }
  assert.equal(calls, 2);
});

test('snapshot API rejects foreign peers, hosts, origins, methods and subpaths before probing', () => {
  let calls = 0;
  const request = fixture(() => {
    calls++;
    throw new Error('unexpected observation');
  });
  const allowed = { host: '127.0.0.1:8787' };
  const cases = [
    [{ headers: { host: 'example.test' } }, 403],
    [{ headers: { ...allowed, origin: 'https://example.test' } }, 403],
    [{ headers: { ...allowed, 'sec-fetch-site': 'cross-site' } }, 403],
    [{ socket: { remoteAddress: '192.0.2.1' } }, 403],
    [{ url: '/missing' }, 404],
    [{ method: 'POST' }, 405],
    [{ method: 'HEAD' }, 405],
  ];
  for (const [changes, status] of cases) {
    const result = request(changes);
    assert.equal(result.status, status);
    assert.equal(result.body, undefined);
    if (status === 405) assert.equal(result.headers.get('allow'), 'GET');
  }
  assert.equal(calls, 0);
});

test('snapshot API preserves unavailable response without exposing probe error', () => {
  const request = fixture(() => {
    throw new Error('private probe error');
  });
  const result = request();
  assert.equal(result.status, 503);
  assert.equal(result.body, undefined);
});
