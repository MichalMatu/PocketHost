import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, readFileSync, writeFileSync, symlinkSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { NodeProjectHost } from '../../src/modules/host/node-project-host.ts';
function source(version = '1.0.0') {
  return {
    packageJson: { name: 'pocket-node-test', version, scripts: { start: 'node server.mjs' } },
    packageLock: {
      name: 'pocket-node-test',
      version,
      lockfileVersion: 3,
      packages: { '': { name: 'pocket-node-test', version } },
    },
    serverSource:
      "import http from 'node:http';\nhttp.createServer((_,r)=>r.end('ok')).listen(0,'127.0.0.1');",
  };
}
function setup(t) {
  const home = mkdtempSync(path.join(os.tmpdir(), 'ph-node-'));
  const root = path.join(home, 'projects');
  t.after(() => rmSync(home, { recursive: true, force: true }));
  return { host: new NodeProjectHost(root), root };
}
test('M3 creates a private project, stages immutable source and preserves prior candidate', (t) => {
  const { host, root } = setup(t);
  const created = host.create('Example Node');
  assert.equal(created.runtime, 'not-provisioned');
  assert.equal(created.activeRelease, null);
  assert.equal(host.list().length, 1);
  const first = host.stage(created.id, source()).project;
  const second = host.stage(created.id, source('1.0.1')).project;
  assert.notEqual(first.candidateRelease, second.candidateRelease);
  assert.equal(second.previousCandidate, first.candidateRelease);
  assert.equal(host.candidates(created.id).length, 2);
  const saved = path.join(root, created.id, 'releases', first.candidateRelease, 'server.mjs');
  assert.match(readFileSync(saved, 'utf8'), /createServer/);
  assert.equal(host.restoreCandidate(created.id).candidateRelease, first.candidateRelease);
  assert.equal(host.inspect(created.id).activeRelease, null);
});
test('M3 source save is idempotent for an attested identical candidate', (t) => {
  const { host } = setup(t);
  const project = host.create('Retry safe Node');
  const first = host.stage(project.id, source());
  assert.equal(first.unchanged, false);
  const repeated = host.stage(project.id, source());
  assert.equal(repeated.unchanged, true);
  assert.equal(repeated.project.candidateRelease, first.project.candidateRelease);
  assert.equal(repeated.project.previousCandidate, null);
  assert.equal(repeated.project.deploymentCount, 1);
  assert.equal(host.candidates(project.id).length, 1);
  const updated = host.stage(project.id, source('1.0.1'));
  assert.equal(updated.unchanged, false);
  assert.equal(updated.project.previousCandidate, first.project.candidateRelease);
  assert.equal(updated.project.deploymentCount, 2);
  const anotherRetry = host.stage(project.id, source('1.0.1'));
  assert.equal(anotherRetry.unchanged, true);
  assert.equal(anotherRetry.project.candidateRelease, updated.project.candidateRelease);
  assert.equal(anotherRetry.project.deploymentCount, 2);
  assert.equal(host.candidates(project.id).length, 2);
});

test('M3 duplicate save remains valid at release limit without bypassing new release budget', (t) => {
  const { host } = setup(t);
  const project = host.create('Full release budget');
  let latest;
  for (let i = 0; i < 12; i++) {
    latest = host.stage(project.id, source('1.0.' + i));
  }
  assert.equal(host.candidates(project.id).length, 12);
  const repeated = host.stage(project.id, source('1.0.11'));
  assert.equal(repeated.unchanged, true);
  assert.equal(repeated.project.candidateRelease, latest.project.candidateRelease);
  assert.equal(host.candidates(project.id).length, 12);
  assert.throws(() => host.stage(project.id, source('1.0.12')), /release budget/);
});

test('M3 duplicate save cannot hide tampered release source or forged source proof', (t) => {
  const { host, root } = setup(t);
  const project = host.create('Source attestation');
  const staged = host.stage(project.id, source()).project;
  const folder = path.join(root, project.id, 'releases', staged.candidateRelease);
  writeFileSync(path.join(folder, 'server.mjs'), 'console.log("tampered")');
  assert.throws(() => host.stage(project.id, source()), /digest mismatch/);
  assert.equal(host.inspect(project.id).deploymentCount, 1);
  assert.equal(host.candidates(project.id).length, 1);
});

test('M3 rejects foreign id, malformed source and project limit or unknown release', (t) => {
  const { host } = setup(t);
  const project = host.create('Safe node');
  assert.throws(() => host.inspect('../../external'), /ID/);
  assert.throws(() => host.stage(project.id, { ...source(), serverSource: '' }), /source/);
  assert.throws(
    () => host.stage(project.id, { ...source(), packageJson: { name: 'x' } }),
    /version|start/,
  );
  assert.throws(() => host.restoreCandidate(project.id), /previous/);
});
test('M3 rejects symlink replacements inside private project roots', (t) => {
  const { host, root } = setup(t);
  const project = host.create('Safe node');
  const marker = path.join(root, project.id, '.pockethost-node.json');
  rmSync(marker);
  symlinkSync('/dev/null', marker);
  assert.throws(() => host.inspect(project.id), /Unsafe/);
});
test('M3 refuses untrusted release directory and never executes user source', (t) => {
  const { host, root } = setup(t);
  const project = host.create('Safe node');
  const first = host.stage(project.id, source()).project;
  const folder = path.join(root, project.id, 'releases', first.candidateRelease);
  rmSync(folder, { recursive: true });
  symlinkSync(os.tmpdir(), folder);
  assert.throws(() => host.inspect(project.id), /Unsafe/);
});

test('M3 re-attests staged source hashes and refuses changed release files', (t) => {
  const { host, root } = setup(t);
  const project = host.create('Hashed node');
  const staged = host.stage(project.id, source()).project;
  const release = staged.candidateRelease;
  assert.equal(host.release(project.id, release).plan.dependencyCount, 0);
  const file = path.join(root, project.id, 'releases', release, 'server.mjs');
  writeFileSync(file, 'console.log("modified")');
  assert.throws(() => host.release(project.id, release), /digest mismatch/);
});
test('M3 legacy source lacking proof cannot run without re-staging', (t) => {
  const { host, root } = setup(t);
  const project = host.create('Legacy node');
  const staged = host.stage(project.id, source()).project;
  rmSync(
    path.join(
      root,
      project.id,
      'releases',
      staged.candidateRelease,
      '.pockethost-node-source.json',
    ),
  );
  assert.equal(host.candidates(project.id).length, 1);
  assert.throws(() => host.release(project.id, staged.candidateRelease), /ENOENT|source/);
});

test('M3 existing legacy candidate remains visible but requires fresh staging', (t) => {
  const { host, root } = setup(t);
  const project = host.create('Legacy verified node');
  const release = host.stage(project.id, source()).project.candidateRelease;
  assert.equal(host.candidates(project.id)[0].sourceIntegrity, 'verified');
  rmSync(path.join(root, project.id, 'releases', release, '.pockethost-node-source.json'));
  assert.equal(host.candidates(project.id)[0].sourceIntegrity, 'legacy-needs-restaging');
});

test('M3 source staging and candidate restore respect shared active deploy/backup lock', (t) => {
  const { host, root } = setup(t);
  const project = host.create('Locked project');
  const first = host.stage(project.id, source()).project;
  const second = host.stage(project.id, source('1.0.1')).project;
  assert.notEqual(first.candidateRelease, second.candidateRelease);
  const lock = path.join(root, '.node-ports.lock');
  writeFileSync(lock, '', { mode: 0o600 });
  assert.throws(() => host.stage(project.id, source('1.0.2')), /EEXIST/);
  assert.throws(() => host.restoreCandidate(project.id), /EEXIST/);
  assert.throws(() => host.create('Blocked new project'), /EEXIST/);
  rmSync(lock);
  assert.equal(host.restoreCandidate(project.id).candidateRelease, first.candidateRelease);
});

test('M3 editor recovers only the currently attested source candidate', (t) => {
  const { host, root } = setup(t);
  const project = host.create('Editable node');
  assert.throws(() => host.candidateSource(project.id), /No staged/);
  const first = host.stage(project.id, source()).project;
  const second = host.stage(project.id, source('1.0.1')).project;
  const latest = host.candidateSource(project.id);
  assert.equal(latest.release, second.candidateRelease);
  assert.equal(JSON.parse(latest.manifest).version, '1.0.1');
  assert.equal(JSON.parse(latest.lockfile).version, '1.0.1');
  assert.equal(latest.serverSource, source().serverSource);
  host.restoreCandidate(project.id);
  assert.equal(host.candidateSource(project.id).release, first.candidateRelease);
  const file = path.join(root, project.id, 'releases', first.candidateRelease, 'server.mjs');
  writeFileSync(file, 'console.log("changed")');
  assert.throws(() => host.candidateSource(project.id), /digest mismatch/);
});
