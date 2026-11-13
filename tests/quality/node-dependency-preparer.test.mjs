import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, existsSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { NodeProjectHost } from '../../src/modules/host/node-project-host.ts';
import { NodeDependencyPreparer } from '../../src/modules/host/node-dependency-preparer.ts';

const cleanSource = {
  packageJson: {
    name: 'owned-dependency-test', version: '1.0.0',
    scripts: { start: 'node server.mjs' }, dependencies: { 'is-odd': '3.0.1' },
  },
  packageLock: {
    name: 'owned-dependency-test', version: '1.0.0', lockfileVersion: 3,
    packages: {
      '': {
        name: 'owned-dependency-test', version: '1.0.0',
        dependencies: { 'is-odd': '3.0.1' },
      },
      'node_modules/is-odd': {
        version: '3.0.1',
        resolved: 'https://registry.npmjs.org/is-odd/-/is-odd-3.0.1.tgz',
        integrity: 'sha512-' + 'A'.repeat(86) + '==',
      },
    },
  },
  serverSource: "console.log('never executed during installation')",
};

function fixture(t) {
  const home = mkdtempSync(path.join(os.tmpdir(), 'pockethost-dep-'));
  const root = path.join(home, 'projects');
  t.after(() => rmSync(home, { recursive: true, force: true }));
  const projects = new NodeProjectHost(root);
  const project = projects.create('Dependency fixture');
  const release = projects.stage(project.id, cleanSource).project.candidateRelease;
  return { root, projects, project, release };
}

test('isolated, manually approved npm preparation uses fixed safe argv and never starts a service', async (t) => {
  const { root, projects, project, release } = fixture(t);
  const executed = [];
  const execute = async (dir, args) => {
    executed.push({ dir, args: [...args] });
    assert.ok(dir.startsWith(path.join(root, project.id) + path.sep));
    assert.equal(readFileSync(path.join(dir, 'package.json'), 'utf8'),
      JSON.stringify(cleanSource.packageJson));
    mkdirSync(path.join(dir, 'node_modules'), { mode: 0o700 });
    writeFileSync(path.join(dir, 'node_modules', 'index.js'), 'export default 1');
  };
  const host = new NodeDependencyPreparer(projects, root, () => false, execute);
  const result = await host.prepare(project.id, release, true);
  assert.deepEqual(result, { release, dependencyCount: 1, prepared: true });
  assert.equal(executed.length, 1);
  assert.deepEqual(executed[0].args,
    ['ci', '--ignore-scripts', '--no-bin-links', '--no-audit', '--no-fund', '--omit=dev']);
  const candidate = projects.release(project.id, release).folder;
  assert.equal(readFileSync(path.join(candidate, 'node_modules', 'index.js'), 'utf8'),
    'export default 1');
  const attestation = JSON.parse(readFileSync(
    path.join(candidate, '.pockethost-node-packages.json'), 'utf8'));
  assert.equal(attestation.owner, 'pockethost-node-packages');
  assert.equal(attestation.release, release);
  assert.equal(attestation.dependencyCount, 1);
  assert.ok(!existsSync(path.join(root, '.node-ports.lock')));
  assert.ok(!readdirSync(path.join(root, project.id)).some((name) =>
    name.startsWith('.node-packages-')));
  await assert.rejects(host.prepare(project.id, release, true),
    /Existing or ambiguous/);
  assert.equal(executed.length, 1);
});

test('dependency preparation refuses missing approval, active releases and stale candidates', async (t) => {
  const { root, projects, project, release } = fixture(t);
  let touched = 0;
  const host = new NodeDependencyPreparer(projects, root, () => true, async () => { touched++; });
  await assert.rejects(host.prepare(project.id, release, false), /approval/);
  await assert.rejects(host.prepare(project.id, 'invalid', true), /release/);
  await assert.rejects(host.prepare(project.id, release, true), /Active or unverified/);
  const next = projects.stage(project.id, {
    ...cleanSource,
    packageJson: { ...cleanSource.packageJson, version: '1.0.1' },
    packageLock: {
      ...cleanSource.packageLock, version: '1.0.1',
      packages: {
        ...cleanSource.packageLock.packages,
        '': { ...cleanSource.packageLock.packages[''], version: '1.0.1' },
      },
    },
  }).project.candidateRelease;
  assert.notEqual(next, release);
  await assert.rejects(host.prepare(project.id, release, true), /candidate changed/);
  assert.equal(touched, 0);
  assert.ok(!existsSync(path.join(root, '.node-ports.lock')));
});

test('dependency installation errors clean private staging without installing into release', async (t) => {
  const { root, projects, project, release } = fixture(t);
  const host = new NodeDependencyPreparer(projects, root, () => false, async (dir) => {
    mkdirSync(path.join(dir, 'node_modules'), { mode: 0o700 });
    throw new Error('mock npm failure');
  });
  await assert.rejects(host.prepare(project.id, release, true), /mock npm failure/);
  const candidate = projects.release(project.id, release).folder;
  assert.ok(!existsSync(path.join(candidate, 'node_modules')));
  assert.ok(!existsSync(path.join(candidate, '.pockethost-node-packages.json')));
  assert.ok(!existsSync(path.join(root, '.node-ports.lock')));
  assert.ok(!readdirSync(path.join(root, project.id)).some((name) =>
    name.startsWith('.node-packages-')));
});

test('unreviewed package origin and lifecycle hooks never reach npm', async (t) => {
  const { root, projects, project } = fixture(t);
  const changed = {
    ...cleanSource,
    packageLock: {
      ...cleanSource.packageLock,
      packages: {
        ...cleanSource.packageLock.packages,
        'node_modules/is-odd': {
          ...cleanSource.packageLock.packages['node_modules/is-odd'],
          resolved: 'file:../foreign',
          hasInstallScript: true,
        },
      },
    },
  };
  const release = projects.stage(project.id, changed).project.candidateRelease;
  let executed = 0;
  const host = new NodeDependencyPreparer(projects, root, () => false,
    async () => { executed++; });
  await assert.rejects(host.prepare(project.id, release, true), /manual review/);
  assert.equal(executed, 0);
  assert.ok(!existsSync(path.join(root, '.node-ports.lock')));
});

test('failed source attestation prevents npm admission', async (t) => {
  const { root, projects, project, release } = fixture(t);
  const sourceFile = path.join(root, project.id, 'releases', release, 'server.mjs');
  writeFileSync(sourceFile, 'console.log("tampered")');
  let executed = 0;
  const host = new NodeDependencyPreparer(projects, root, () => false,
    async () => { executed++; });
  await assert.rejects(host.prepare(project.id, release, true), /digest mismatch/);
  assert.equal(executed, 0);
});
