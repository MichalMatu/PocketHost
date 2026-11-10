import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, mkdirSync, rmSync, symlinkSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createServer } from 'node:http';
import { NodeProjectHost } from '../../src/modules/host/node-project-host.ts';
import { NodeRunitHost, probeOwnedNodeReadiness } from '../../src/modules/host/node-runit-host.ts';
import { TermuxServiceAdmin } from '../../src/modules/host/termux-service-admin.ts';

function fixture(t) {
  const home = mkdtempSync(path.join(os.tmpdir(), 'ph-runit-'));
  const root = path.join(home, 'projects');
  const serviceRoot = path.join(home, 'services');
  const logRoot = path.join(home, 'logs');
  mkdirSync(serviceRoot, { mode: 0o700 });
  mkdirSync(logRoot, { mode: 0o700 });
  t.after(() => rmSync(home, { recursive: true, force: true }));
  const projects = new NodeProjectHost(root);
  const project = projects.create('Runit example');
  return { home, root, serviceRoot, logRoot, projects, project,
    host: new NodeRunitHost(root, serviceRoot, logRoot) };
}
const source = {
  packageJson: { name: 'node-example', version: '1.0.0',
    scripts: { start: 'node server.mjs' } },
  packageLock: { name: 'node-example', version: '1.0.0', lockfileVersion: 3,
    packages: { '': { name: 'node-example', version: '1.0.0' } } },
  serverSource: "import http from 'node:http';\nhttp.createServer((_,r)=>r.end('ok')).listen(process.env.PORT,'127.0.0.1');",
};

test('M3 source validation and runtime inspection remain inert before explicit approval', async (t) => {
  const { projects, project, host, serviceRoot } = fixture(t);
  const initial = host.status(project.id);
  assert.equal(initial.state, 'not-provisioned');
  assert.equal(host.preview(project.id).reason, 'stage-source-first');
  const staged = projects.stage(project.id, source).project;
  assert.equal(projects.release(project.id, staged.candidateRelease).plan.dependencyCount, 0);
  const preview = host.preview(project.id);
  assert.equal(preview.release, staged.candidateRelease);
  assert.equal(preview.dependencyCount, 0);
  await assert.rejects(host.deploy(project.id, staged.candidateRelease, false), /approval/);
  await assert.rejects(host.stop(project.id, false), /stop required/);
  assert.equal(host.status(project.id).state, 'not-provisioned');
  assert.deepEqual(host.logs(project.id).lines, []);
  assert.equal((await import('node:fs')).readdirSync(serviceRoot).length, 0);
});

test('M3 cannot adopt preexisting service directory or symlink', (t) => {
  const { project, projects, host, serviceRoot, home } = fixture(t);
  projects.stage(project.id, source);
  const target = path.join(serviceRoot, 'pockethost-node-' + project.id.slice(5));
  mkdirSync(target);
  assert.throws(() => host.preview(project.id), /collision/);
  rmSync(target, { recursive: true });
  symlinkSync(home, target);
  assert.throws(() => host.preview(project.id), /collision/);
});

test('M2 existing runit refuses unregistered one-shot and protected service', async (t) => {
  const { home, serviceRoot } = fixture(t);
  const admin = new TermuxServiceAdmin(serviceRoot, path.join(home, 'registry.json'));
  await assert.rejects(admin.apply('once', 'cloudflared'), /Protected/);
  await assert.rejects(admin.apply('once', 'unknown-unit'), /unavailable/);
});

test('M3 readiness requires exact loopback nonce, not an arbitrary HTTP 200', async (t) => {
  const nonce = 'c'.repeat(48);
  const server = createServer((req, res) => {
    if (req.url === '/__pockethost/ready') {
      res.writeHead(200, { 'X-PocketHost-Ready': nonce });
      res.end('ready');
      return;
    }
    res.writeHead(200);
    res.end('foreign page');
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const port = address.port;
  assert.equal(await probeOwnedNodeReadiness(port, nonce), true);
  assert.equal(await probeOwnedNodeReadiness(port, 'd'.repeat(48)), false);
  assert.throws(() => probeOwnedNodeReadiness(0, nonce), /Unsafe/);
  assert.throws(() => probeOwnedNodeReadiness(port, 'invalid'), /Unsafe/);
});
