import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer, request } from 'node:http';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { nodeProjectApi } from '../../apps/admin/plugins/node-project-api.ts';
import { nodeOwnerAccess } from '../../src/modules/host/node-owner-access.ts';
import { NodeRunitHost } from '../../src/modules/host/node-runit-host.ts';
import { NodeProjectHost } from '../../src/modules/host/node-project-host.ts';
import { nodeHostingUnitName } from '../../src/shared/node-hosting-projection.ts';

const TOKEN = 'A'.repeat(40);
const PREFIX = '/data/data/com.termux/files/usr';
const envKeys = [
  'HOME',
  'POCKETHOST_ENABLE_OWNED_SITE_DEV',
  'POCKETHOST_ENABLE_NODE_HOSTING_DEV',
  'POCKETHOST_ENABLE_NODE_RUNTIME_DEV',
  'POCKETHOST_NODE_ACCESS_MODE',
  'POCKETHOST_NODE_OWNER_TOKEN',
];
const source = {
  packageJson: { name: 'node-e2e', version: '1.0.0', scripts: { start: 'node server.mjs' } },
  packageLock: {
    name: 'node-e2e', version: '1.0.0', lockfileVersion: 3,
    packages: { '': { name: 'node-e2e', version: '1.0.0' } },
  },
  serverSource: "import http from 'node:http'; http.createServer((q,r)=>{if(q.url==='/__pockethost/ready')r.setHeader('X-PocketHost-Ready',process.env.POCKETHOST_READINESS_NONCE);r.end('fixture');}).listen(Number(process.env.PORT),'127.0.0.1');",
};
function approval(project, active = null) {
  return {
    approved: true, expectedRevision: project.deploymentCount,
    expectedCandidate: project.candidateRelease, expectedActiveRelease: active,
  };
}
async function fixture(t, mode, secret, fn) {
  const previous = envKeys.map(key => process.env[key]);
  const home = mkdtempSync(path.join(os.tmpdir(), 'ph-node-remove-'));
  const serviceRoot = path.join(home, 'services');
  const logRoot = path.join(home, 'logs');
  const root = path.join(home, 'PocketHost-NodeProjects');
  mkdirSync(serviceRoot, { mode: 0o700 });
  mkdirSync(logRoot, { mode: 0o700 });
  process.env.HOME = home;
  process.env.POCKETHOST_ENABLE_OWNED_SITE_DEV = '1';
  process.env.POCKETHOST_ENABLE_NODE_HOSTING_DEV = '1';
  process.env.POCKETHOST_ENABLE_NODE_RUNTIME_DEV = '1';
  process.env.POCKETHOST_NODE_ACCESS_MODE = mode;
  process.env.POCKETHOST_NODE_OWNER_TOKEN = secret;
  let handler;
  nodeProjectApi({ serviceRoot, logRoot }).configureServer({
    middlewares: { use(_route, callback) { handler = callback; } },
  });
  const server = createServer((req, res) => {
    Promise.resolve(handler(req, res)).catch(() => { res.statusCode = 500; res.end('{}'); });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const call = (route, body, headers = {}) => new Promise((resolve, reject) => {
    const payload = body === undefined ? undefined : JSON.stringify(body);
    const req = request({
      hostname: '127.0.0.1', port: server.address().port, path: route,
      method: payload === undefined ? 'GET' : 'POST',
      headers: {
        host: '127.0.0.1:8787', connection: 'close',
        ...(payload === undefined ? {} : {
          origin: 'http://127.0.0.1:8787', 'x-pockethost-intent': 'owned-node-project',
          'content-type': 'application/json', 'content-length': Buffer.byteLength(payload),
        }), ...headers,
      },
    }, res => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(Buffer.concat(chunks).toString()) }); }
        catch (error) { reject(error); }
      });
    });
    req.on('error', reject);
    req.setTimeout(90000, () => req.destroy(new Error('Fixture HTTP timeout')));
    req.end(payload);
  });
  let supervisor;
  try {
    await fn({
      call, home, root, serviceRoot, logRoot,
      startSupervisor() {
        assert.equal(process.env.HOME, home);
        supervisor = spawn(PREFIX + '/bin/runsvdir', [serviceRoot], {
          detached: true, stdio: 'ignore', cwd: home,
        });
        return once(supervisor, 'spawn');
      },
    });
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    if (supervisor?.pid && supervisor.exitCode === null && supervisor.signalCode === null) {
      const exited = once(supervisor, 'exit');
      process.kill(-supervisor.pid, 'SIGTERM');
      await exited;
    }
    // This is the private mkdtemp fixture only, never the actual A8 registry or app data.
    rmSync(home, { recursive: true, force: true });
    envKeys.forEach((key, i) => {
      if (previous[i] === undefined) delete process.env[key];
      else process.env[key] = previous[i];
    });
  }
}

test('owner token is optional only for explicit trusted LAN; invalid policy fails closed', () => {
  assert.equal(nodeOwnerAccess(undefined, '').authorized(undefined), false);
  assert.equal(nodeOwnerAccess('protected', TOKEN).authorized(undefined), false);
  assert.equal(nodeOwnerAccess('protected', TOKEN).authorized('B'.repeat(40)), false);
  assert.equal(nodeOwnerAccess('protected', TOKEN).authorized(TOKEN), true);
  assert.equal(nodeOwnerAccess('trusted-lan', '').authorized(undefined), true);
  assert.equal(nodeOwnerAccess('invalid', TOKEN).authorized(TOKEN), false);
  assert.equal(spawnSync('sh', ['-n', 'ops/termux/panel-service.sh']).status, 0);
});

test('protected HTTP lifecycle requires token; never-provisioned removal preserves source and data', async t => {
  await fixture(t, 'protected', TOKEN, async ({ call, root, home }) => {
    const auth = { 'x-pockethost-node-owner': TOKEN };
    assert.equal((await call('/owner-session')).body.authorized, false);
    assert.equal((await call('/', { name: 'Denied' })).status, 403);
    const created = await call('/', { name: 'Protected fixture' }, auth);
    assert.equal(created.status, 201);
    const p = created.body.project;
    assert.equal((await call('/' + p.id + '/remove', approval(p))).status, 403);
    assert.equal((await call('/' + p.id + '/remove', { ...approval(p), expectedRevision: 1 }, auth)).status, 409);
    const data = path.join(home, '.local/state/pockethost/node-project-data', p.id);
    mkdirSync(data, { recursive: true, mode: 0o700 });
    writeFileSync(path.join(data, 'keep.txt'), 'keep', { mode: 0o600 });
    const removed = await call('/' + p.id + '/remove', approval(p), auth);
    assert.deepEqual(removed, { status: 200, body: { removed: true, id: p.id, filesRetained: true } });
    assert.deepEqual((await call('/')).body.projects, []);
    assert.equal(existsSync(path.join(root, p.id)), false);
    assert.equal(existsSync(path.join(root + '-retired', p.id, 'project')), true);
    assert.equal(readFileSync(path.join(data, 'keep.txt'), 'utf8'), 'keep');
    assert.equal((await call('/' + p.id + '/remove', approval(p), auth)).status, 409);
  });
});

test('trusted LAN HTTP mode needs no token but rejects wrong origin, missing intent and stale approval', async t => {
  await fixture(t, 'trusted-lan', '', async ({ call }) => {
    assert.deepEqual((await call('/owner-session')).body, { configured: false, authorized: true, mode: 'trusted-lan' });
    assert.equal((await call('/')).body.accessMode, 'trusted-lan');
    assert.equal((await call('/', { name: 'Denied' }, { origin: 'https://foreign.invalid' })).status, 403);
    assert.equal((await call('/', { name: 'Denied' }, { 'x-pockethost-intent': '' })).status, 403);
    assert.equal((await call('/', { name: 'Denied' }, { 'sec-fetch-site': 'cross-site' })).status, 403);
    const p = (await call('/', { name: 'Trusted fixture' })).body.project;
    assert.equal((await call('/' + p.id + '/remove', { approved: false })).status, 400);
    assert.equal((await call('/' + p.id + '/remove', approval(p))).status, 200);
    assert.deepEqual((await call('/')).body.projects, []);
  });
});

test('isolated real runit HTTP E2E: deploy, stop/start, reject running deletion, retire stopped project', {
  skip: process.env.POCKETHOST_NODE_RUNIT_E2E !== '1',
  timeout: 180000,
}, async t => {
  assert.equal(process.platform, 'android');
  await fixture(t, 'trusted-lan', '', async ({ call, root, serviceRoot, logRoot, startSupervisor }) => {
    await startSupervisor();
    const p = (await call('/', { name: 'Isolated runtime fixture' })).body.project;
    const staged = await call('/' + p.id + '/stage', {
      ...source, expectedCandidate: null, expectedRevision: 0,
    });
    assert.equal(staged.status, 200);
    const project = staged.body.project;
    const release = project.candidateRelease;
    const deployed = await call('/' + p.id + '/deploy', { approved: true, release });
    assert.equal(deployed.status, 200, JSON.stringify(deployed.body));
    assert.equal(deployed.body.runtime.state, 'running');
    assert.equal((await call('/' + p.id + '/health')).body.health.ready, true);
    assert.equal((await call('/' + p.id + '/remove', approval(project, release))).status, 409);
    assert.equal((await call('/' + p.id + '/stop', { approved: true })).body.runtime.state, 'stopped');
    assert.equal((await call('/' + p.id + '/start', { approved: true })).body.runtime.state, 'running');
    assert.equal((await call('/' + p.id + '/stop', { approved: true })).body.runtime.state, 'stopped');
    const removed = await call('/' + p.id + '/remove', approval(project, release));
    assert.equal(removed.status, 200, JSON.stringify(removed.body));
    assert.deepEqual((await call('/')).body.projects, []);
    const unit = nodeHostingUnitName(p.id);
    assert.equal(existsSync(path.join(serviceRoot, unit)), false);
    assert.equal(existsSync(path.join(logRoot, unit)), true);
    assert.equal(existsSync(path.join(root + '-retired', p.id, 'unit')), true);
    assert.equal(existsSync(path.join(root + '-retired', p.id, 'project', 'releases', release, 'server.mjs')), true);
    assert.deepEqual(new NodeProjectHost(root).list(), []);
    assert.equal(new NodeRunitHost(root, serviceRoot, logRoot).registryProjection().projects.length, 0);
  });
});
