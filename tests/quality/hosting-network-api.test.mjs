import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer, request } from 'node:http';
import { createServer as createSocket } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { ownedDemoApi } from '../../apps/admin/plugins/owned-demo-api.ts';
import { ownedSiteFleetApi } from '../../apps/admin/plugins/site-fleet-api.ts';
import { networkAccessApi } from '../../apps/admin/plugins/network-access-api.ts';
import { createLanControl } from '../../src/modules/host/lan-control.mjs';
import { SiteFleetHost } from '../../src/modules/host/site-fleet-host.ts';

async function withApi(plugin, route, run) {
  let handler;
  const server = createServer((req, res) => {
    assert(req.url.startsWith(route));
    req.url = req.url.slice(route.length) || '/';
    Promise.resolve(handler(req, res)).catch(() => {
      res.statusCode = 500;
      res.end();
    });
  });
  plugin.configureServer({
    httpServer: server,
    middlewares: {
      use(prefix, fn) {
        assert.equal(prefix, route);
        assert.equal(handler, undefined);
        handler = fn;
      },
    },
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const port = server.address().port;
  const call = (url = '/', method = 'GET', headers = {}, body) =>
    new Promise((resolve, reject) => {
      const req = request(
        {
          hostname: '127.0.0.1',
          port,
          path: route + url,
          method,
          headers: {
            host: '127.0.0.1:8787',
            connection: 'close',
            ...(body === undefined ? {} : { 'content-length': Buffer.byteLength(body) }),
            ...headers,
          },
        },
        (res) => {
          const chunks = [];
          res.on('data', (chunk) => chunks.push(chunk));
          res.once('error', reject);
          res.once('end', () => {
            const bytes = Buffer.concat(chunks);
            resolve({ status: res.statusCode, headers: res.headers, bytes });
          });
        },
      );
      req.once('error', reject);
      req.setTimeout(5000, () => req.destroy(new Error('fixture timeout')));
      req.end(body);
    });
  try {
    await run(call);
  } finally {
    await new Promise((resolve, reject) => server.close((e) => (e ? reject(e) : resolve())));
  }
}

function json(result) {
  return JSON.parse(result.bytes.toString('utf8'));
}

function flags(t, enabled) {
  for (const key of ['POCKETHOST_ENABLE_OWNED_SITE_DEV', 'POCKETHOST_ENABLE_USER_SITES_DEV']) {
    const old = process.env[key];
    process.env[key] = enabled ? '1' : '0';
    t.after(() => {
      if (old === undefined) delete process.env[key];
      else process.env[key] = old;
    });
  }
}

test('disabled hosting registers legacy and fleet routes without creating a fleet', async (t) => {
  flags(t, false);
  await withApi(ownedDemoApi(), '/api/v1/owned-site', async (call) => {
    assert.deepEqual(json(await call()), { enabled: false, site: null });
    assert.equal((await call('/project')).status, 404);
  });
  const plugin = ownedSiteFleetApi(() => {
    throw Error('disabled fleet must never be created');
  });
  await withApi(plugin, '/api/v1/sites', async (call) => {
    assert.equal((await call()).status, 404);
    assert.equal((await call('/', 'GET', { host: 'foreign.test' })).status, 403);
  });
});

test('static API creates, publishes, rolls back and removes only a temporary fixture', async (t) => {
  flags(t, true);
  const tmp = mkdtempSync(path.join(os.tmpdir(), 'pockethost-s4d-api-'));
  t.after(() => rmSync(tmp, { recursive: true, force: true }));
  const socket = createSocket();
  await new Promise((resolve, reject) => {
    socket.once('error', reject);
    socket.listen(0, '127.0.0.1', resolve);
  });
  const port = socket.address().port;
  await new Promise((resolve) => socket.close(resolve));
  const fleet = new SiteFleetHost(path.join(tmp, 'managed'), port);
  const events = [];
  const plugin = ownedSiteFleetApi(
    () => fleet,
    (event) => events.push(event),
  );
  const intent = {
    origin: 'http://127.0.0.1:8787',
    'x-pockethost-intent': 'owned-sites',
    'content-type': 'application/json',
  };
  const bundle = (value) =>
    JSON.stringify({
      files: [{ name: 'index.html', base64: Buffer.from(value).toString('base64') }],
    });
  await withApi(plugin, '/api/v1/sites', async (call) => {
    assert.deepEqual(json(await call()), { sites: [] });
    assert.equal((await call('/', 'POST', {}, '{"name":"Fixture"}')).status, 403);
    assert.deepEqual(json(await call()), { sites: [] });
    const created = await call('/', 'POST', intent, '{"name":"Fixture"}');
    assert.equal(created.status, 201);
    const id = json(created).site.id;
    const target = '/' + id;
    const published = await call(target + '/deploy', 'PUT', intent, bundle('<h1>one</h1>'));
    assert.equal(published.status, 200);
    const first = json(published).site;
    assert.equal(
      (await call(target + '/deploy', 'PUT', intent, bundle('<h1>two</h1>'))).status,
      200,
    );
    const rolled = await call(target + '/rollback', 'POST', intent);
    assert.equal(rolled.status, 200);
    assert.equal(json(rolled).site.activeRelease, first.activeRelease);
    const exported = await call(target + '/export');
    assert.equal(exported.status, 200);
    assert.equal(exported.headers['content-type'], 'application/zip');
    assert.equal(Number(exported.headers['content-length']), exported.bytes.length);
    const current = json(await call(target)).site;
    const snapshot = JSON.stringify({
      activeRelease: current.activeRelease,
      releases: current.releases,
    });
    const removed = await call(target, 'DELETE', intent, snapshot);
    assert.equal(removed.status, 200);
    assert.deepEqual(json(removed), { deleted: id });
    assert.deepEqual(json(await call()), { sites: [] });
    assert.deepEqual(events, [
      'owned-release-published',
      'owned-release-published',
      'owned-release-rolled-back',
    ]);
  });
});

test('LAN adapter preserves intent, deferred disable and owned-only listener lifecycle', async () => {
  const calls = [];
  const interfaces = () => [{ name: 'wlan0', address: '192.168.0.100' }];
  const control = createLanControl({
    interfaces,
    start: async (bind) => {
      calls.push('start:' + bind);
      return { close: async () => calls.push('close') };
    },
  });
  const plugin = networkAccessApi({
    autoStart: false,
    createController: () => control,
    interfaces,
  });
  await withApi(plugin, '/api/v1/network-access', async (call) => {
    assert.equal(json(await call()).enabled, false);
    assert.equal((await call('/enable', 'POST')).status, 403);
    assert.deepEqual(calls, []);
    const intent = {
      origin: 'http://127.0.0.1:8787',
      'x-pockethost-intent': 'lan-control',
      'x-pockethost-lan-bind': '192.168.0.100',
      'content-length': '0',
    };
    assert.equal((await call('/enable', 'POST', intent)).status, 200);
    assert.equal(json(await call()).enabled, true);
    assert.equal(json(await call('/disable', 'POST', intent)).enabled, false);
    assert.equal(json(await call()).enabled, false);
    assert.deepEqual(calls, ['start:192.168.0.100', 'close']);
  });
  assert.deepEqual(calls, ['start:192.168.0.100', 'close']);
});

test('public static publication requires separate intent and verified running site', async (t) => {
  flags(t, true);
  const id = 'site-' + 'a'.repeat(32);
  const calls = [];
  let ready = false;
  let state = { siteId: null, state: 'stopped', url: null, reason: null };
  const publication = {
    status: () => state,
    start: async (siteId) => {
      calls.push('start:' + siteId);
      state = { siteId, state: 'url-assigned', url: 'https://fixture.trycloudflare.com', reason: null };
      return state;
    },
    stop: async (siteId) => {
      if (siteId !== state.siteId) throw Error('foreign');
      calls.push('stop:' + siteId);
      state = { siteId, state: 'stopped', url: null, reason: null };
      return state;
    },
  };
  const fleet = {
    inspect: (siteId) => {
      assert.equal(siteId, id);
      return { state: ready ? 'running' : 'stopped' };
    },
    health: async () => ready,
    stop: async () => {
      calls.push('site-stop');
      return { state: 'stopped' };
    },
  };
  const plugin = ownedSiteFleetApi(() => fleet, () => {}, () => publication);
  const intent = {
    origin: 'http://127.0.0.1:8787',
    'x-pockethost-intent': 'public-static',
  };
  await withApi(plugin, '/api/v1/sites', async (call) => {
    const route = '/' + id;
    assert.deepEqual(json(await call('/publication')), { publication: state });
    assert.equal((await call(route + '/publish-public', 'POST')).status, 403);
    assert.equal((await call(route + '/publish-public?port=8787', 'POST', intent)).status, 403);
    assert.equal((await call(route + '/publish-public', 'POST', intent, '{}')).status, 403);
    assert.equal((await call(route + '/publish-public', 'POST', intent)).status, 409);
    assert.deepEqual(calls, []);
    ready = true;
    assert.equal((await call(route + '/publish-public', 'POST', intent)).status, 200);
    assert.equal(json(await call('/publication')).publication.url, 'https://fixture.trycloudflare.com');
    const siteIntent = { ...intent, 'x-pockethost-intent': 'owned-sites' };
    assert.equal((await call(route + '/stop', 'POST', siteIntent)).status, 409);
    assert.equal((await call(route + '/unpublish-public', 'POST', intent)).status, 200);
    assert.equal((await call(route + '/stop', 'POST', siteIntent)).status, 200);
    assert.deepEqual(calls, ['start:' + id, 'stop:' + id, 'site-stop']);
  });
});
