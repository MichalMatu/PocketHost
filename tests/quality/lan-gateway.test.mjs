import assert from 'node:assert/strict';
import { createServer, request as httpRequest } from 'node:http';
import test from 'node:test';
import {
  createGateway,
  ownLanInterface,
  sameSubnet,
  upstreamTimeoutMs,
} from '../../src/modules/host/lan-gateway.mjs';

const bind = '127.0.0.1';
const mask = '255.0.0.0';

async function listen(server) {
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, bind, resolve);
  });
  return server.address().port;
}

async function close(server) {
  server.closeAllConnections?.();
  await new Promise((resolve) => server.close(resolve));
}

async function requestWithHeaders(port, headers, method = 'GET') {
  return new Promise((resolve, reject) => {
    const request = httpRequest(
      { hostname: bind, port, path: '/', method, headers },
      (response) => {
        response.resume();
        response.once('end', () => resolve(response.statusCode));
      },
    );
    request.once('error', reject);
    request.end();
  });
}

test('only the fixed read-only O1 snapshot gets a bounded extended LAN upstream deadline', () => {
  assert.equal(upstreamTimeoutMs('/api/v1/observability'), 25000);
  assert.equal(upstreamTimeoutMs('/api/v1/observability?refresh=1'), 25000);
  for (const route of [
    '/api/v1/host/snapshot',
    '/api/v1/network-access',
    '/api/v1/owned-site',
    '/api/v1/observability/unexpected',
    '/',
    undefined,
  ]) {
    assert.equal(upstreamTimeoutMs(route), 5000);
  }
});

test('H3 admin LAN timeout is long only for its exact typed endpoint', () => {
  assert.equal(upstreamTimeoutMs('/api/v1/termux-admin?mode=packages', 'GET'), 30000);
  assert.equal(upstreamTimeoutMs('/api/v1/termux-admin', 'POST'), 610000);
  assert.equal(upstreamTimeoutMs('/api/v1/termux-admin?mode=files', 'POST'), 610000);
  assert.equal(upstreamTimeoutMs('/api/v1/termux-admin/unexpected', 'POST'), 5000);
  assert.equal(upstreamTimeoutMs('/api/v1/termux-tools', 'POST'), 5000);
  assert.equal(upstreamTimeoutMs('/api/v1/observability', 'POST'), 25000);
  assert.equal(upstreamTimeoutMs('/api/v1/termux-admin', 'PUT'), 5000);
});

test('Shizuku GET-only inventory routes receive bounded native-aware LAN deadlines', () => {
  for (const route of ['/api/v1/shizuku/apps', '/api/v1/shizuku/app', '/api/v1/shizuku/system']) {
    assert.equal(upstreamTimeoutMs(route), 24000);
    assert.equal(upstreamTimeoutMs(route + '?package=com.example.app'), 24000);
    for (const method of ['POST', 'PUT', 'DELETE', 'HEAD']) {
      assert.equal(upstreamTimeoutMs(route, method), 5000);
    }
  }
  for (const route of [
    '/api/v1/shizuku/status',
    '/api/v1/shizuku/apps/unknown',
    '/api/v1/shizuku/system/unknown',
    '/api/v1/shizuku/app/unknown',
    '/api/v1/shizuku/shell',
  ]) {
    assert.equal(upstreamTimeoutMs(route), 5000);
  }
});

test('direct Android shell has one POST-only LAN timeout exception', () => {
  assert.equal(upstreamTimeoutMs('/api/v1/shizuku/remote-shell/run', 'POST'), 20000);
  assert.equal(upstreamTimeoutMs('/api/v1/shizuku/remote-shell/run?request=1', 'POST'), 20000);
  assert.equal(upstreamTimeoutMs('/api/v1/shizuku/remote-shell/run', 'GET'), 5000);
  assert.equal(upstreamTimeoutMs('/api/v1/shizuku/remote-shell/run', 'DELETE'), 5000);
  assert.equal(upstreamTimeoutMs('/api/v1/shizuku/remote-shell/submit', 'POST'), 5000);
  assert.equal(upstreamTimeoutMs('/api/v1/shizuku/remote-shell/poll', 'POST'), 5000);
});

test('LAN remains exact RFC1918 address only; same subnet and no public bind', () => {
  assert.equal(sameSubnet('192.168.10.12', '192.168.10.2', '255.255.255.0'), true);
  assert.equal(sameSubnet('::ffff:192.168.10.13', '192.168.10.2', '255.255.255.0'), true);
  assert.equal(sameSubnet('192.168.11.12', '192.168.10.2', '255.255.255.0'), false);
  assert.equal(sameSubnet('2001:db8::1', '192.168.10.2', '255.255.255.0'), false);
  assert.throws(() => ownLanInterface('0.0.0.0'), /requires an exact/);
  assert.throws(() => ownLanInterface('127.0.0.1'), /requires an exact/);
  assert.throws(() => ownLanInterface('8.8.8.8'), /requires an exact/);
});

test('LAN admin opens without login but rejects foreign Host, Origin and cross-site requests', async () => {
  const backend = createServer((request, response) => {
    response.setHeader('Content-Type', 'application/json');
    response.end(
      JSON.stringify({
        method: request.method,
        path: request.url,
        host: request.headers.host,
        origin: request.headers.origin ?? null,
        authorizationForwarded: !!request.headers.authorization,
        intent: request.headers['x-pockethost-intent'] ?? null,
        agentIntent: request.headers['x-pockethost-agent-intent'] ?? null,
      }),
    );
  });
  const upstream = await listen(backend);
  const gateway = createGateway({
    bind,
    mask,
    admin: true,
    port: 0,
    testUpstreamPort: upstream,
  });
  try {
    const port = await listen(gateway);
    const url = 'http://' + bind + ':' + port;
    const request = (route = '/', options = {}) => fetch(url + route, options);
    const health = await request('/.well-known/pockethost-lan-health');
    assert.equal(health.status, 204);
    assert.equal(health.headers.get('x-pockethost-lan-gateway'), 'owned');
    let response = await request('/owned-site');
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('www-authenticate'), null);
    let body = await response.json();
    assert.equal(body.host, '127.0.0.1:' + upstream);
    assert.equal(body.authorizationForwarded, false);
    assert.equal(body.path, '/owned-site');
    response = await request('/', { headers: { Authorization: 'Basic should-not-be-needed' } });
    assert.equal(response.status, 200);
    body = await response.json();
    assert.equal(body.authorizationForwarded, false);
    response = await request('/api/v1/termux-admin?mode=agent-capabilities', {
      headers: { 'X-PocketHost-Agent-Intent': 'termux-owner-agent' },
    });
    assert.equal(response.status, 200);
    body = await response.json();
    assert.equal(
      body.agentIntent,
      null,
      'LAN headers may not impersonate the on-device Local Agent',
    );
    assert.equal(await requestWithHeaders(port, { Host: 'evil.example' }), 403);
    assert.equal(
      await requestWithHeaders(port, {
        Host: '127.0.0.1:' + port,
        'Sec-Fetch-Site': 'cross-site',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Dest': 'document',
      }),
      200,
    );
    assert.equal(
      await requestWithHeaders(
        port,
        {
          Host: '127.0.0.1:' + port,
          'Sec-Fetch-Site': 'cross-site',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Dest': 'document',
        },
        'POST',
      ),
      403,
    );
    assert.equal((await request('/', { headers: { Origin: 'http://evil.example' } })).status, 403);
    assert.equal((await request('/', { headers: { 'Sec-Fetch-Site': 'cross-site' } })).status, 403);
    response = await request('/api/v1/owned-site/publish', {
      method: 'POST',
      headers: {
        Origin: url,
        'X-PocketHost-Intent': 'owned-demo',
        'Content-Length': '0',
      },
    });
    assert.equal(response.status, 200);
    body = await response.json();
    assert.equal(body.origin, 'http://127.0.0.1:' + upstream);
    assert.equal(body.intent, 'owned-demo');
    assert.equal(body.authorizationForwarded, false);
  } finally {
    await close(gateway);
    await close(backend);
  }
});

test('LAN site gateway remains read-only GET and HEAD and rejects foreign origins', async () => {
  const backend = createServer((_request, response) => response.end('First local site'));
  const upstream = await listen(backend);
  const gateway = createGateway({
    bind,
    mask,
    admin: false,
    port: 0,
    testUpstreamPort: upstream,
  });
  try {
    const port = await listen(gateway);
    const url = 'http://127.0.0.1:' + port;
    const health = await fetch(url + '/.well-known/pockethost-lan-health');
    assert.equal(health.status, 204);
    assert.equal(health.headers.get('x-pockethost-lan-gateway'), 'owned');
    const response = await fetch(url);
    assert.equal(response.status, 200);
    assert.match(await response.text(), /First local site/);
    assert.equal((await fetch(url, { method: 'HEAD' })).status, 200);
    assert.equal((await fetch(url, { method: 'POST' })).status, 405);
    assert.equal(
      await requestWithHeaders(port, {
        Host: '127.0.0.1:' + port,
        'Sec-Fetch-Site': 'same-site',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Dest': 'document',
      }),
      200,
    );
    assert.equal(
      await requestWithHeaders(port, {
        Host: '127.0.0.1:' + port,
        'Sec-Fetch-Site': 'cross-site',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Dest': 'document',
      }),
      200,
    );
    assert.equal(
      await requestWithHeaders(port, {
        Host: '127.0.0.1:' + port,
        'Sec-Fetch-Site': 'cross-site',
      }),
      403,
    );
    assert.equal((await fetch(url, { headers: { Origin: 'http://evil.example' } })).status, 403);
  } finally {
    await close(gateway);
    await close(backend);
  }
});
