import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { NodeProjectHost } from '../../src/modules/host/node-project-host.ts';
import { NodeBuildPreparer, stageNodeBuildBinaries } from '../../src/modules/host/node-build-preparer.ts';
import { NodeDependencyPreparer } from '../../src/modules/host/node-dependency-preparer.ts';
import { NodeRunitHost } from '../../src/modules/host/node-runit-host.ts';

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

test('temporary npm CLI shims work without modifying published modules', (t) => {
  const home = mkdtempSync(path.join(os.tmpdir(), 'ph-build-bins-'));
  t.after(() => rmSync(home, { recursive: true, force: true }));
  const modules = path.join(home, 'node_modules');
  const pkg = path.join(modules, 'vite');
  mkdirSync(path.join(pkg, 'bin'), { recursive: true, mode: 0o700 });
  writeFileSync(path.join(pkg, 'package.json'), JSON.stringify({
    name: 'vite', version: '7.0.0', bin: { vite: 'bin/vite.js' },
  }));
  const entry = path.join(pkg, 'bin', 'vite.js');
  writeFileSync(entry, "console.log('dev-only cli')");
  assert.equal(stageNodeBuildBinaries(home), 1);
  const cmd = readFileSync(path.join(modules, '.bin', 'vite'), 'utf8');
  assert.match(cmd, /exec .*node.*vite\.js/);
  assert.equal(readFileSync(entry, 'utf8'), "console.log('dev-only cli')");
  assert.throws(() => stageNodeBuildBinaries(home), /pre-existing/);
});

test('unsafe npm build entrypoints fail before constructing command shims', (t) => {
  const home = mkdtempSync(path.join(os.tmpdir(), 'ph-build-bin-deny-'));
  t.after(() => rmSync(home, { recursive: true, force: true }));
  const pkg = path.join(home, 'node_modules', 'example');
  mkdirSync(pkg, { recursive: true, mode: 0o700 });
  writeFileSync(path.join(pkg, 'package.json'), JSON.stringify({
    name: 'example', bin: { cmd: '../../outside.js' },
  }));
  assert.throws(() => stageNodeBuildBinaries(home), /Unsafe npm bin target/);
  assert.equal(existsSync(path.join(home, 'node_modules', '.bin')), false);
  writeFileSync(path.join(pkg, 'package.json'), JSON.stringify({
    name: 'example', bin: { cmd: 'bin/start.js' },
  }));
  mkdirSync(path.join(pkg, 'bin'), { mode: 0o700 });
  symlinkSync(path.join(home, 'server.mjs'), path.join(pkg, 'bin', 'start.js'));
  assert.throws(() => stageNodeBuildBinaries(home), /Unsafe npm bin entrypoint/);
  assert.equal(existsSync(path.join(home, 'node_modules', '.bin')), false);
});

test('approved pinned npm install and build form an attestable deploy candidate without starting runit', async (t) => {
  const { root, projects, project, source } = fixture(t);
  const dependencySource = {
    ...source,
    packageJson: {
      ...source.packageJson,
      dependencies: { 'cli-helper': '1.0.0' },
    },
    packageLock: {
      ...source.packageLock,
      packages: {
        '': {
          ...source.packageLock.packages[''],
          dependencies: { 'cli-helper': '1.0.0' },
        },
        'node_modules/cli-helper': {
          version: '1.0.0',
          resolved: 'https://registry.npmjs.org/cli-helper/-/cli-helper-1.0.0.tgz',
          integrity: 'sha512-' + 'A'.repeat(86) + '==',
        },
      },
    },
  };
  const release = projects.stage(project.id, dependencySource).project.candidateRelease;
  const npm = new NodeDependencyPreparer(projects, root, () => false, async (workspace, args) => {
    assert.equal(args.at(-1), '--include=dev');
    const pkg = path.join(workspace, 'node_modules', 'cli-helper');
    mkdirSync(path.join(pkg, 'bin'), { mode: 0o700, recursive: true });
    writeFileSync(path.join(pkg, 'package.json'), JSON.stringify({
      name: 'cli-helper', version: '1.0.0', bin: { helper: 'bin/cli.js' },
    }));
    writeFileSync(path.join(pkg, 'bin', 'cli.js'), "console.log('safe fixture')");
  });
  await npm.prepare(project.id, release, true);
  assert.equal(npm.verifyPrepared(project.id, release).verified, true);
  const built = new NodeBuildPreparer(projects, root, () => false, async workspace => {
    const shim = path.join(workspace, 'node_modules', '.bin', 'helper');
    assert.match(readFileSync(shim, 'utf8'), /cli\.js/);
    assert.equal(existsSync(path.join(projects.release(project.id, release).folder,
      'node_modules', '.bin')), false);
    artifact(workspace);
  });
  await built.prepare(project.id, release, true);
  assert.equal(built.verifyBuilt(project.id, release).verified, true);
  const services = path.join(root, 'unit-services');
  const logs = path.join(root, 'unit-logs');
  mkdirSync(services, { mode: 0o700 });
  mkdirSync(logs, { mode: 0o700 });
  const runit = new NodeRunitHost(root, services, logs);
  runit.toolVersions = () => ({ nodeVersion: 'v26.13.0', npmVersion: '11.6.2' });
  assert.equal(runit.preview(project.id).allowed, true);
  assert.equal(existsSync(path.join(root, '.node-ports.lock')), false);
  assert.deepEqual((await import('node:fs')).readdirSync(services), []);
  writeFileSync(path.join(projects.release(project.id, release).folder, 'dist',
    'index.html'), 'corrupted');
  assert.equal(runit.preview(project.id).allowed, false);
});

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
  assert.deepEqual(host.inspectBuilt(project.id, release), {
    release, entries: 1, bytes: 14, files: ['index.html'], truncated: false,
  });
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
  assert.throws(() => host.inspectBuilt(project.id, release), /integrity mismatch/);
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

test('post-publication proof failure removes only new dist, never source or services', async (t) => {
  const { root, projects, project, release } = fixture(t);
  const host = new NodeBuildPreparer(projects, root, () => false, async dir => artifact(dir));
  host.verifyBuilt = () => { throw new Error('mock published artifact mismatch'); };
  await assert.rejects(host.prepare(project.id, release, true), /published artifact mismatch/);
  assert.equal(existsSync(path.join(root, project.id, 'releases', release, 'dist')), false);
  assert.equal(existsSync(path.join(root, '.node-ports.lock')), false);
  assert.equal(projects.release(project.id, release).source.server, "console.log('build example')");
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
