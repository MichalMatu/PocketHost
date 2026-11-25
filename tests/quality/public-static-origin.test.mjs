import assert from 'node:assert/strict';
import http from 'node:http';
import { test } from 'node:test';
import {
  publicAssetPath,
  startPublicStaticOrigin,
} from '../../src/modules/host/public-static-origin.mjs';

const id = 'site-' + 'a'.repeat(32);

test('public paths admit active assets but not previews or ambiguous paths', () => {
  assert.equal(publicAssetPath('/'), '/');
  assert.equal(publicAssetPath('/assets/main.css?v=2'), '/assets/main.css');
  assert.equal(publicAssetPath('/hello%20world.html'), '/hello%20world.html');
  for (const path of [
    '/__versions/r-123/index.html',
    '/%5f%5fversions/r-123/index.html',
    '/api/v1/sites',
    '/%61pi/v1/sites',
    '/.pockethost-site.json',
    '/a/../index.html',
    '/a/%2e%2e/index.html',
    '/a%2fb',
    '/a%5cb',
    '/a%00b',
    '/a%252fb',
    '/a%ZZ',
    '//example.com/',
    'http://example.com/',
    '/a//b',
    '/a/',
    '/a%0ab',
    '/' + 'x'.repeat(351),
  ]) {
    assert.equal(publicAssetPath(path), null, path);
  }
});

async function listen(server) {
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  return server.address().port;
}

function close(server) {
  server.closeAllConnections();
  return new Promise((resolve) => server.close(resolve));
}

function request(port, path, method = 'GET', headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { host: '127.0.0.1', port, path, method, headers },
      (res) => {
        const parts = [];
        res.on('data', (part) => parts.push(part));
        res.on('end', () =>
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: Buffer.concat(parts).toString(),
          }),
        );
      },
    );
    req.on('error', reject);
    req.end();
  });
}

test('loopback origin forwards only owned active site and safe response headers', async (t) => {
  const seen = [];
  const target = http.createServer((req, res) => {
    seen.push({ path: req.url, method: req.method, headers: req.headers });
    res.writeHead(200, {
      'Content-Type': 'text/html',
      'Content-Length': 6,
      'Content-Security-Policy': "default-src 'none'",
      'X-PocketHost-Release': 'private-marker',
      'Set-Cookie': 'private=1',
    });
    res.end(req.method === 'HEAD' ? undefined : 'active');
  });
  const port = await listen(target);
  t.after(() => close(target));
  let owned = true;
  const resolved = [];
  const origin = await startPublicStaticOrigin({
    siteId: id,
    resolveSite: (path) => {
      resolved.push(path);
      return owned ? { port, path: path.slice(4 + id.length) } : null;
    },
  });
  t.after(() => close(origin));
  const address = origin.address();
  assert.equal(address.address, '127.0.0.1');
  const get = await request(address.port, '/index.html?q=private', 'GET', {
    Authorization: 'not-forwarded',
    Cookie: 'not-forwarded',
    'X-PocketHost-Intent': 'not-forwarded',
    Host: 'public.example',
  });
  assert.equal(get.status, 200);
  assert.equal(get.body, 'active');
  assert.equal(get.headers['content-security-policy'], "default-src 'none'");
  assert.equal(get.headers['cache-control'], 'no-store');
  assert.equal(get.headers['x-pockethost-release'], undefined);
  assert.equal(get.headers['set-cookie'], undefined);
  assert.equal(seen[0].path, '/index.html');
  assert.equal(seen[0].headers.host, '127.0.0.1:' + port);
  assert.equal(seen[0].headers.authorization, undefined);
  assert.equal(seen[0].headers.cookie, undefined);
  assert.equal(seen[0].headers['x-pockethost-intent'], undefined);
  const head = await request(address.port, '/', 'HEAD');
  assert.equal(head.status, 200);
  assert.equal(head.body, '');
  assert.equal(head.headers['content-length'], '6');
  assert.equal((await request(address.port, '/', 'POST')).status, 405);
  assert.equal((await request(address.port, '/__versions/r-123/index.html')).status, 404);
  assert.equal((await request(address.port, '/api/v1/sites')).status, 404);
  assert.equal(seen.length, 2);
  assert.deepEqual(resolved, ['/h2/' + id + '/index.html', '/h2/' + id + '/']);
  owned = false;
  assert.equal((await request(address.port, '/')).status, 503);
  assert.equal(seen.length, 2);
});

test('origin rejects invalid identity, mismatched target and unavailable upstream', async (t) => {
  await assert.rejects(startPublicStaticOrigin({ siteId: 'foreign' }), RangeError);
  const target = http.createServer((_req, res) => {
    res.writeHead(302, { Location: 'http://127.0.0.1:8787/' });
    res.end();
  });
  const port = await listen(target);
  t.after(() => close(target));
  let wrongPath = true;
  const origin = await startPublicStaticOrigin({
    siteId: id,
    resolveSite: () => ({ port, path: wrongPath ? '/other' : '/' }),
  });
  t.after(() => close(origin));
  assert.equal((await request(origin.address().port, '/')).status, 503);
  wrongPath = false;
  const redirect = await request(origin.address().port, '/');
  assert.equal(redirect.status, 502);
  assert.equal(redirect.headers.location, undefined);
});
