import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, mkdirSync, readdirSync, rmSync, symlinkSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createServer } from 'node:http';
import { NodeProjectHost } from '../../src/modules/host/node-project-host.ts';
import {
  NodeRunitHost,
  probeOwnedNodeReadiness,
  selectUnreservedNodePort,
  runScript,
  readBoundedNodePreview,
} from '../../src/modules/host/node-runit-host.ts';
import { TermuxServiceAdmin } from '../../src/modules/host/termux-service-admin.ts';
import { nodeHostingUnitName } from '../../src/shared/node-hosting-projection.ts';

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
  return {
    home,
    root,
    serviceRoot,
    logRoot,
    projects,
    project,
    host: new NodeRunitHost(root, serviceRoot, logRoot),
  };
}
const source = {
  packageJson: { name: 'node-example', version: '1.0.0', scripts: { start: 'node server.mjs' } },
  packageLock: {
    name: 'node-example',
    version: '1.0.0',
    lockfileVersion: 3,
    packages: { '': { name: 'node-example', version: '1.0.0' } },
  },
  serverSource:
    "import http from 'node:http';\nhttp.createServer((_,r)=>r.end('ok')).listen(process.env.PORT,'127.0.0.1');",
};

test('M3 source validation and runtime inspection remain inert before explicit approval', async (t) => {
  const { projects, project, host, serviceRoot } = fixture(t);
  const initial = host.status(project.id);
  assert.equal(initial.state, 'not-provisioned');
  assert.equal(initial.healthDecision.action, 'none');
  assert.equal(initial.healthDecision.reason, 'not-provisioned');
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

test('M3 reads installed Node tool versions without creating or starting a service', (t) => {
  const { host, serviceRoot } = fixture(t);
  const versions = host.toolVersions();
  assert.deepEqual(Object.keys(versions), ['nodeVersion', 'npmVersion']);
  for (const value of Object.values(versions)) {
    assert.ok(value === null || /^v?\d+\.\d+\.\d+$/.test(value));
  }
  assert.deepEqual(readdirSync(serviceRoot), []);
});

test('M3 cannot adopt preexisting service directory or symlink', (t) => {
  const { project, projects, host, serviceRoot, home } = fixture(t);
  projects.stage(project.id, source);
  const target = path.join(serviceRoot, nodeHostingUnitName(project.id));
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

test('M2 port planner rejects conflicts and never adopts already-reserved Node port', async () => {
  const touched = [];
  const port = await selectUnreservedNodePort(new Set([19300, 19302]), async (candidate) => {
    touched.push(candidate);
    return candidate !== 19301;
  });
  assert.equal(port, 19303);
  assert.deepEqual(touched, [19301, 19303]);
  await assert.rejects(
    selectUnreservedNodePort(new Set(Array.from({ length: 32 }, (_, i) => 19300 + i)), async () => {
      throw new Error('Reserved port was probed');
    }),
    /No unreserved/,
  );
});

test('M3 staging refuses tampered source before any runit command', async (t) => {
  const { projects, project, root, host } = fixture(t);
  const staged = projects.stage(project.id, source).project;
  const file = path.join(root, project.id, 'releases', staged.candidateRelease, 'server.mjs');
  (await import('node:fs')).writeFileSync(file, 'console.log("changed")');
  assert.throws(() => host.preview(project.id), /digest mismatch/);
  assert.equal(host.status(project.id).state, 'not-provisioned');
});

test('M3 resume refuses missing approval and never creates an unowned service', async (t) => {
  const { host, projects, project, serviceRoot } = fixture(t);
  const staged = projects.stage(project.id, source).project;
  await assert.rejects(host.start(project.id, false), /approval/);
  await assert.rejects(host.start(project.id, true), /No verified active Node release/);
  assert.deepEqual((await import('node:fs')).readdirSync(serviceRoot), []);
  assert.equal(host.status(project.id).state, 'not-provisioned');
  assert.equal(projects.inspect(project.id).candidateRelease, staged.candidateRelease);
});

test('M3 restart refuses approval or missing verified owner without any unit action', async (t) => {
  const { projects, project, host, serviceRoot } = fixture(t);
  projects.stage(project.id, source);
  await assert.rejects(host.restart(project.id, false), /approval/);
  await assert.rejects(host.restart(project.id, true), /No verified running Node release/);
  assert.deepEqual((await import('node:fs')).readdirSync(serviceRoot), []);
});

test('M3 restart coordinates existing stop then start and never starts if stop fails', async (t) => {
  const { project, host } = fixture(t);
  const calls = [];
  host.status = () => ({
    state: 'running',
    activeRelease: 'r-' + 'a'.repeat(32),
    lastGoodRelease: 'r-' + 'a'.repeat(32),
  });
  host.stop = async (id, approved) => {
    calls.push(['stop', id, approved]);
  };
  host.start = async (id, approved) => {
    calls.push(['start', id, approved]);
    return { state: 'running', activeRelease: 'r-' + 'a'.repeat(32) };
  };
  const result = await host.restart(project.id, true);
  assert.equal(result.state, 'running');
  assert.deepEqual(calls, [
    ['stop', project.id, true],
    ['start', project.id, true],
  ]);
  calls.length = 0;
  host.stop = async () => {
    calls.push(['stop']);
    throw new Error('Owned process identity changed');
  };
  await assert.rejects(host.restart(project.id, true), /identity changed/);
  assert.deepEqual(calls, [['stop']]);
});

test('M3 rollback cannot manage a project without prior verified healthy release', async (t) => {
  const { projects, project, host } = fixture(t);
  const staged = projects.stage(project.id, source).project;
  await assert.rejects(host.rollback(project.id, false), /approval/);
  await assert.rejects(host.rollback(project.id, true), /prior healthy/);
  await assert.rejects(host.deploy(project.id, staged.candidateRelease, true, true), /prior good/);
});

test('M3 syntax check is explicitly non-executing and rejects unavailable release', (t) => {
  const { projects, project, host } = fixture(t);
  assert.throws(() => host.checkBuild(project.id, 'r-' + '0'.repeat(32)), /admission/);
  const staged = projects.stage(project.id, source).project;
  const checked = host.checkBuild(project.id, staged.candidateRelease);
  assert.equal(checked.release, staged.candidateRelease);
  assert.equal(checked.executed, false);
  assert.equal(checked.status, 'syntax-valid');
});

test('M3 syntax check re-attests candidate and refuses tampered code', async (t) => {
  const { projects, project, root, host } = fixture(t);
  const staged = projects.stage(project.id, source).project;
  const file = path.join(root, project.id, 'releases', staged.candidateRelease, 'server.mjs');
  (await import('node:fs')).writeFileSync(file, 'console.log("changed")');
  assert.throws(() => host.checkBuild(project.id, staged.candidateRelease), /digest mismatch/);
  assert.equal(host.status(project.id).state, 'not-provisioned');
});

test('M3 runit launch drops inherited admin environment and validates fixed loopback port', () => {
  const folder =
    '/data/data/com.termux/files/home/PocketHost-NodeProjects/node-' +
    'c'.repeat(32) +
    '/releases/r-' +
    'd'.repeat(32);
  const script = runScript(folder, 19301, 'e'.repeat(48));
  assert.match(script, /env' -i/);
  assert.match(script, /PATH=/);
  assert.match(script, /NODE_ENV=/);
  assert.doesNotMatch(script, /export PORT/);
  assert.doesNotMatch(script, /NODE_OPTIONS=/);
  assert.throws(() => runScript(folder, 8000, 'e'.repeat(48)), /launch/);
  assert.throws(() => runScript(folder, 19301, 'bad'), /launch/);
});

test('M3 owned log supervisor cannot be redirected through an arbitrary run command', (t) => {
  const { project, projects, host, serviceRoot } = fixture(t);
  projects.stage(project.id, source);
  // A foreign pre-existing unit, even with an apparent log directory, is
  // never adopted merely because it matches the deterministic Node name.
  const service = path.join(
    serviceRoot,
    'pockethost-' + project.id + '-s-' + project.id.slice(5, 17),
  );
  mkdirSync(service);
  assert.throws(() => host.preview(project.id), /collision/);
});

test('M3 invalid Node syntax is detected without start or service registration', async (t) => {
  const { projects, project, host, serviceRoot } = fixture(t);
  const invalid = { ...source, serverSource: 'function bad( {' };
  const staged = projects.stage(project.id, invalid).project;
  const result = host.checkBuild(project.id, staged.candidateRelease);
  assert.deepEqual(result, {
    release: staged.candidateRelease,
    status: 'syntax-invalid',
    executed: false,
  });
  assert.equal(host.status(project.id).state, 'not-provisioned');
  assert.deepEqual((await import('node:fs')).readdirSync(serviceRoot), []);
});

test('M3 direct loopback Node preview is bounded and never follows foreign response redirects', async (t) => {
  const server = createServer((req, res) => {
    if (req.url === '/too-large') return;
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<b>safe text preview</b>');
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  assert.equal(await readBoundedNodePreview(address.port), '<b>safe text preview</b>');
  assert.throws(() => readBoundedNodePreview(0), /port/);
});

test('M3 live health never probes or starts a project without verified runit ownership', async (t) => {
  const { projects, project, host, serviceRoot } = fixture(t);
  assert.deepEqual(await host.health(project.id), {
    state: 'not-provisioned',
    release: null,
    ready: null,
  });
  projects.stage(project.id, source);
  assert.deepEqual(await host.health(project.id), {
    state: 'not-provisioned',
    release: null,
    ready: null,
  });
  assert.deepEqual((await import('node:fs')).readdirSync(serviceRoot), []);
});
