import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { NodeProjectHost } from '../../src/modules/host/node-project-host.ts';
import { NodeBuildPreparer } from '../../src/modules/host/node-build-preparer.ts';

function fixture(t) {
  const home = mkdtempSync(path.join(os.tmpdir(), 'ph-node-build-'));
  const root = path.join(home, 'projects');
  t.after(() => rmSync(home, { recursive: true, force: true }));
  const projects = new NodeProjectHost(root);
  const project = projects.create('Owned builder');
  const source = {
    packageJson: {
      name: 'builder', version: '1.0.0',
      scripts: { start: 'node server.mjs', build: 'node server.mjs --build' },
    },
    packageLock: {
      name: 'builder', version: '1.0.0', lockfileVersion: 3,
      packages: { '': { name: 'builder', version: '1.0.0' } },
    },
    serverSource: "console.log('build example')",
  };
  const release = projects.stage(project.id, source).project.candidateRelease;
  return { root, projects, project, release, source };
}
function artifact(dir) {
  mkdirSync(path.join(dir, 'dist'), { mode: 0o700 });
  writeFileSync(path.join(dir, 'dist', 'index.html'), '<h1>Built</h1>');
}

test('explicit build approval publishes only proven dist and not a service', async (t) => {
  const { root, projects, project, release } = fixture(t);
  const called = [];
  const host = new NodeBuildPreparer(projects, root, () => false, async (dir) => {
    called.push(dir);
    artifact(dir);
  });
  assert.equal(host.buildScript(project.id, release), 'node server.mjs --build');
  await assert.rejects(host.prepare(project.id, release, false), /approval/);
  assert.equal(called.length, 0);
  const built = await host.prepare(project.id, release, true);
  assert.deepEqual(built, { release, entries: 1, bytes: 14, prepared: true });
  assert.equal(called.length, 1);
  assert.equal(host.verifyBuilt(project.id, release).verified, true);
  const output = path.join(projects.release(project.id, release).folder, 'dist');
  assert.equal(readFileSync(path.join(output, 'index.html'), 'utf8'), '<h1>Built</h1>');
  assert.equal(existsSync(path.join(root, '.node-ports.lock')), false);
  await assert.rejects(host.prepare(project.id, release, true), /Existing or ambiguous/);
});

test('tampered build output cannot be readmitted', async (t) => {
  const { root, projects, project, release } = fixture(t);
  const host = new NodeBuildPreparer(projects, root, () => false, async (dir) => artifact(dir));
  await host.prepare(project.id, release, true);
  writeFileSync(path.join(projects.release(project.id, release).folder, 'dist', 'index.html'), 'tampered');
  assert.throws(() => host.verifyBuilt(project.id, release), /integrity mismatch/);
});

test('failed or unsafe build leaves no dist or global lock', async (t) => {
  const { root, projects, project, release } = fixture(t);
  const host = new NodeBuildPreparer(projects, root, () => false, async (dir) => {
    mkdirSync(path.join(dir, 'dist'), { mode: 0o700 });
    symlinkSync(path.join(dir, 'server.mjs'), path.join(dir, 'dist', 'external'));
  });
  await assert.rejects(host.prepare(project.id, release, true), /Unsafe Node build artifact entry|no regular files/);
  assert.equal(existsSync(path.join(projects.release(project.id, release).folder, 'dist')), false);
  assert.equal(existsSync(path.join(root, '.node-ports.lock')), false);
});

test('stale or active candidate never executes build', async (t) => {
  const { root, projects, project, release, source } = fixture(t);
  let executed = false;
  const host = new NodeBuildPreparer(projects, root, () => true, async () => {
    executed = true;
  });
  await assert.rejects(host.prepare(project.id, release, true), /Active or unknown/);
  const next = projects.stage(project.id, {
    ...source,
    serverSource: source.serverSource + '\n// next version',
  }).project.candidateRelease;
  assert.notEqual(next, release);
  await assert.rejects(host.prepare(project.id, release, true), /candidate changed/);
  assert.equal(executed, false);
});
