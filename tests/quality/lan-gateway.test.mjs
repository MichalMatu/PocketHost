import assert from 'node:assert/strict';
import { createServer, request as httpRequest } from 'node:http';
import { mkdtempSync, rmSync, chmodSync, writeFileSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  createGateway,
  ownLanInterface,
  passwordMatches,
  safePassword,
  sameSubnet,
} from '../../src/modules/host/lan-gateway.mjs';

const bind = '127.0.0.1';
const mask = '255.0.0.0';
const password = 'test-only-long-password-do-not-use-in-prod';
const auth = 'Basic ' + Buffer.from('pocket:' + password).toString('base64');

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

async function requestWithHost(port, host) {
  return new Promise((resolve, reject) => {
    const request = httpRequest(
      { hostname: bind, port, path: '/', method: 'GET', headers: { Host: host, Authorization: auth } },
      (response) => {
        response.resume();
        response.once('end', () => resolve(response.statusCode));
      },
    );
    request.once('error', reject);
    request.end();
  });
}

test('LAN network scope requires same subnet and refuses public or other clients', () => {
  assert.equal(sameSubnet('192.168.10.12', '192.168.10.2', '255.255.255.0'), true);
  assert.equal(sameSubnet('::ffff:192.168.10.13', '192.168.10.2', '255.255.255.0'), true);
  assert.equal(sameSubnet('192.168.11.12', '192.168.10.2', '255.255.255.0'), false);
  assert.equal(sameSubnet('2001:db8::1', '192.168.10.2', '255.255.255.0'), false);
  assert.throws(() => ownLanInterface('0.0.0.0'), /requires an exact/);
  assert.throws(() => ownLanInterface('127.0.0.1'), /requires an exact/);
  assert.throws(() => ownLanInterface('8.8.8.8'), /requires an exact/);
});

test('owner-only password file and strict Basic credentials are required', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'pockethost-lan-gate-'));
  const file = path.join(dir, 'password');
  try {
    writeFileSync(file, password, { mode: 0o600 });
    assert.equal(safePassword(file), password);
    assert.equal(passwordMatches(auth, password), true);
    assert.equal(
      passwordMatches('Basic ' + Buffer.from('pocket:wrong').toString('base64'), password),
      false,
    );
    assert.equal(passwordMatches('Bearer something', password), false);
    assert.equal(passwordMatches(undefined, password), false);
    chmodSync(file, 0o644);
    assert.throws(() => safePassword(file), /owner-only/);
    chmodSync(file, 0o600);
    const linked = path.join(dir, 'linked');
    symlinkSync(file, linked);
    assert.throws(() => safePassword(linked), /owner-only/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('LAN gateway guards admin and forwards only authorized same-origin requests', async () => {
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
    password,
    port: 0,
    testUpstreamPort: upstream,
  });
  try {
    const port = await listen(gateway);
    const url = 'http://' + bind + ':' + port;
    const request = (route = '/', options = {}) => fetch(url + route, options);
    let response = await request();
    assert.equal(response.status, 401);
    assert.match(response.headers.get('www-authenticate'), /PocketHost LAN/);
    assert.equal((await request('/', { headers: { Authorization: 'Basic broken' } })).status, 401);
    response = await request('/owned-site', { headers: { Authorization: auth } });
    assert.equal(response.status, 200);
    let body = await response.json();
    assert.equal(body.host, '127.0.0.1:' + upstream);
    assert.equal(body.authorizationForwarded, false);
    assert.equal(body.path, '/owned-site');
    assert.equal(await requestWithHost(port, 'evil.example'), 403);
    assert.equal(
      (await request('/', { headers: { Authorization: auth, Origin: 'http://evil.example' } }))
        .status,
      403,
    );
    assert.equal(
      (await request('/', { headers: { Authorization: auth, 'Sec-Fetch-Site': 'cross-site' } }))
        .status,
      403,
    );
    response = await request('/api/v1/owned-site/publish', {
      method: 'POST',
      headers: {
        Authorization: auth,
        Origin: url,
        'X-PocketHost-Intent': 'owned-demo',
        'Content-Length': '0',
      },
    });
    assert.equal(response.status, 200);
    body = await response.json();
    assert.equal(body.origin, 'http://127.0.0.1:8787'.replace('8787', String(upstream)));
    assert.equal(body.intent, 'owned-demo');
    assert.equal(body.authorizationForwarded, false);
  } finally {
    await close(gateway);
    await close(backend);
  }
});

test('LAN site gateway is unauthenticated but GET and HEAD only', async () => {
  const backend = createServer((_request, response) => response.end('First local site'));
  const upstream = await listen(backend);
  const gateway = createGateway({
    bind,
    mask,
    admin: false,
    password,
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
    assert.equal((await fetch(url, { headers: { Origin: 'http://evil.example' } })).status, 403);
  } finally {
    await close(gateway);
    await close(backend);
  }
});
