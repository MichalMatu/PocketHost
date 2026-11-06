import assert from 'node:assert/strict';
import { createServer, request as httpRequest } from 'node:http';
import test from 'node:test';
import {
  createGateway,
  ownLanInterface,
  sameSubnet,
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
    assert.equal(
      await requestWithHeaders(port, { Host: 'evil.example' }),
      403,
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
    assert.equal(
      (await request('/', { headers: { Origin: 'http://evil.example' } })).status,
      403,
    );
    assert.equal(
      (await request('/', { headers: { 'Sec-Fetch-Site': 'cross-site' } })).status,
      403,
    );
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
