import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'node:http';
import { createServer as createSocket } from 'node:net';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SiteFleetHost } from '../../src/modules/host/site-fleet-host.ts';
import { startSiteServer } from '../../src/modules/host/site-fleet-server.mjs';
import { NodeProjectHost } from '../../src/modules/host/node-project-host.ts';
import { runScript } from '../../src/modules/host/node-runit-probes.ts';
import { readTraffic } from '../../src/modules/host/traffic-store.mjs';
import { readOwnedTraffic } from '../../src/modules/host/traffic-runtime.ts';
import '../../src/modules/host/traffic-node-preload.mjs';
import { ownedSiteFleetApi } from '../../apps/admin/plugins/site-fleet-api.ts';
import { nodeProjectApi } from '../../apps/admin/plugins/node-project-api.ts';

async function freePort() {
  const server = createSocket();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

async function waitFor(fn) {
  for (let i = 0; i < 200; i++) {
    try {
      const value = await fn();
      if (value) return value;
    } catch {
      // A newly started isolated server or pending flush is not yet ready.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('Isolated traffic fixture did not become ready');
}

async function api(plugin, fn) {
  let handler;
  plugin.configureServer({ middlewares: { use(_route, callback) { handler = callback; } } });
  const server = createServer((req, res) => {
    Promise.resolve(handler(req, res)).catch(() => { res.statusCode = 500; res.end(); });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const base = 'http://127.0.0.1:' + server.address().port;
    await fn(async (route, options = {}) => {
      const response = await fetch(base + route, {
        ...options, headers: { host: '127.0.0.1:8787', ...options.headers },
      });
      return { status: response.status, body: await response.json() };
    });
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
}

test('owned Static and Node traffic, real HTTP, separate histories and read-only project APIs', async () => {
  assert.equal(typeof startSiteServer, 'function');
  const tmp = mkdtempSync(path.join(os.tmpdir(), 'pockethost-traffic-hosting-'));
  const keys = ['HOME', 'POCKETHOST_ENABLE_OWNED_SITE_DEV', 'POCKETHOST_ENABLE_USER_SITES_DEV', 'POCKETHOST_ENABLE_NODE_HOSTING_DEV'];
  const before = keys.map((key) => process.env[key]);
  let fleet;
  let site;
  let child;
  try {
    process.env.HOME = tmp;
    for (const key of keys.slice(1)) process.env[key] = '1';
    mkdirSync(path.join(tmp, 'Projects'));
    const state = path.join(tmp, '.local', 'state', 'pockethost');
    mkdirSync(state, { recursive: true, mode: 0o700 });
    const root = path.join(state, 'traffic-v1');
    fleet = new SiteFleetHost(undefined, await freePort());
    site = await fleet.create('Traffic Static');
    await fleet.deploy(site.id, [{ name: 'index.html', bytes: Buffer.from('hello') }]);
    await fleet.start(site.id);
    const staticUrl = 'http://127.0.0.1:' + site.port;
    const success = await fetch(staticUrl + '/?private=secret');
    assert.equal(await success.text(), 'hello');
    assert.equal((await fetch(staticUrl + '/missing')).status, 404);
    assert.equal((await fetch(staticUrl + '/', { method: 'HEAD' })).status, 200);
    const project = new NodeProjectHost().create('Traffic Node');
    const port = await freePort();
    const folder = path.join(tmp, 'PocketHost-NodeProjects', project.id, 'releases', 'r-' + 'a'.repeat(32));
    mkdirSync(folder);
    const source = path.join(folder, 'server.mjs');
    writeFileSync(source, "import http from 'node:http'; http.createServer((req,res)=>{res.writeHead(req.url.startsWith('/bad')?503:200);res.end('node');}).listen(Number(process.env.PORT),'127.0.0.1',()=>console.log('READY'));");
    const script = runScript(folder, 19301, 'e'.repeat(48));
    assert.match(script, /--import/);
    assert.match(script, /POCKETHOST_TRAFFIC_ID=/);
    const preload = fileURLToPath(new URL('../../src/modules/host/traffic-node-preload.mjs', import.meta.url));
    child = spawn(process.execPath, ['--import', preload, source], { cwd: folder,
      env: { ...process.env, PORT: String(port), POCKETHOST_TRAFFIC_ID: project.id, POCKETHOST_TRAFFIC_ROOT: root },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    await waitFor(() => child.stdout.read()?.toString().includes('READY'));
    const nodeUrl = 'http://127.0.0.1:' + port;
    assert.equal(await (await fetch(nodeUrl + '/hello?token=secret')).text(), 'node');
    assert.equal((await fetch(nodeUrl + '/bad')).status, 503);
    await (await fetch(nodeUrl + '/__pockethost/ready')).text();
    const data = await waitFor(() => {
      const a = readTraffic(root, site.id);
      const b = readTraffic(root, project.id);
      return a.state === 'available' && a.summary.statuses.some(([code]) => code === 404) &&
        b.state === 'available' && b.summary.requests === 2 ? { a, b } : null;
    });
    assert.equal(data.b.summary.bytes, 8);
    assert.deepEqual(data.b.summary.statuses, [[200, 1], [503, 1]]);
    assert.deepEqual(data.b.summary.topPaths, [['/bad', 1], ['/hello', 1]]);
    assert.ok(!JSON.stringify(data).includes('secret'));
    assert.equal(readOwnedTraffic(project.id, '?range=7d', data.b.session).current, true);
    assert.throws(() => readOwnedTraffic(project.id, '?range=bad', null), /range/);
    await api(ownedSiteFleetApi(() => fleet), async (call) => {
      const result = await call('/' + site.id + '/traffic?range=7d');
      assert.equal(result.status, 200);
      assert.equal(result.body.projectId, site.id);
      assert.equal(result.body.current, true);
      assert.equal(result.body.summary.range, '7d');
      assert.equal((await call('/' + project.id + '/traffic')).status, 404);
      assert.equal((await call('/' + site.id + '/traffic', { headers: { origin: 'https://foreign.invalid' } })).status, 403);
      assert.equal((await call('/' + site.id + '/traffic', { method: 'POST' })).status, 404);
    });
    await api(nodeProjectApi(), async (call) => {
      const result = await call('/' + project.id + '/traffic');
      assert.equal(result.status, 200);
      assert.equal(result.body.projectId, project.id);
      // A fixture launched without runit must never be presented as an attested live process.
      assert.equal(result.body.current, false);
      assert.equal(result.body.summary.rps, null);
      assert.equal(result.body.summary.requests, 2);
      assert.equal((await call('/node-' + 'f'.repeat(32) + '/traffic')).status, 409);
    });
  } finally {
    if (child && child.exitCode === null && child.signalCode === null) { const exit = once(child, 'exit'); child.kill(); await exit; }
    if (site && fleet) await fleet.stop(site.id).catch(() => {});
    for (let i = 0; i < keys.length; i++) {
      if (before[i] === undefined) delete process.env[keys[i]];
      else process.env[keys[i]] = before[i];
    }
    rmSync(tmp, { recursive: true, force: true });
  }
});
