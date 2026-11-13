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

test('M3 preserves attested multi-file Node source and rejects tampered extras', (t) => {
  const { host, root } = setup(t);
  const project = host.create('Multi-file frontend');
  const input = {
    ...source(),
    packageJson: {
      ...source().packageJson,
      scripts: { start: 'node server.mjs', build: 'vite build' },
    },
    extraFiles: {
      'index.html': '<main id="root"></main>',
      'src/main.tsx': 'import "./style.css"',
      'src/style.css': 'body { margin: 0 }',
      'vite.config.ts': 'export default {}',
    },
  };
  const staged = host.stage(project.id, input);
  const folder = path.join(root, project.id, 'releases', staged.project.candidateRelease);
  const release = host.release(project.id, staged.project.candidateRelease);
  assert.deepEqual(release.source.extraFiles, input.extraFiles);
  assert.deepEqual(host.candidateSource(project.id).extraFiles, input.extraFiles);
  assert.equal(readFileSync(path.join(folder, 'src', 'main.tsx'), 'utf8'), input.extraFiles['src/main.tsx']);
  assert.equal(host.stage(project.id, input).unchanged, true);
  const updated = { ...input, extraFiles: { ...input.extraFiles, 'src/style.css': 'body { color: red }' } };
  assert.equal(host.stage(project.id, updated).unchanged, false);
  writeFileSync(path.join(folder, 'src', 'main.tsx'), 'tampered');
  assert.throws(() => host.release(project.id, staged.project.candidateRelease), /digest mismatch/);
});

test('M3 extra source allowlist blocks traversal, dotfiles, binaries and unsafe envelopes', (t) => {
  const { host } = setup(t);
  const project = host.create('Extra source validation');
  for (const name of [
    '../escape.js', '/tmp/out.js', 'src/../escape.js', 'src/.env', 'public/logo.png',
    'src//main.tsx', 'node_modules/pkg/index.js', '.github/workflows/build.yml',
    'src/deep/a/b/c/d/e/f/g/h.js',
  ]) {
    assert.throws(() => host.stage(project.id, {
      ...source(), extraFiles: { [name]: 'data' },
    }), /Unsafe extra Node source/);
  }
  assert.throws(() => host.stage(project.id, {
    ...source(), extraFiles: { 'src/empty.ts': '' },
  }), /Unsafe extra Node source/);
  assert.throws(() => host.stage(project.id, {
    ...source(), extraFiles: Object.fromEntries(
      Array.from({ length: 33 }, (_, i) => ['src/' + i + '.js', 'ok']),
    ),
  }), /file count/);
  assert.equal(host.inspect(project.id).candidateRelease, null);
});

test('M3 refuses untracked source injections in both legacy and multi-file releases', (t) => {
  const { host, root } = setup(t);
  const project = host.create('Reject injected modules');
  const legacy = host.stage(project.id, source()).project.candidateRelease;
  const legacyFolder = path.join(root, project.id, 'releases', legacy);
  writeFileSync(path.join(legacyFolder, 'unexpected.mjs'), 'console.log("foreign")');
  assert.throws(() => host.release(project.id, legacy), /Unexpected file/);
  rmSync(path.join(legacyFolder, 'unexpected.mjs'));
  const multi = host.stage(project.id, {
    ...source('1.0.1'), extraFiles: { 'src/main.ts': 'export const ok = true' },
  }).project.candidateRelease;
  const multiFolder = path.join(root, project.id, 'releases', multi);
  writeFileSync(path.join(multiFolder, 'src', 'injected.js'), 'export const bad = true');
  assert.throws(() => host.release(project.id, multi), /Unexpected file/);
  rmSync(path.join(multiFolder, 'src', 'injected.js'));
  assert.deepEqual(host.release(project.id, multi).source.extraFiles,
    { 'src/main.ts': 'export const ok = true' });
});


test('M3 new binary manifest is immutable and backward compatible with old releases', (t) => {
  const { host, root } = setup(t);
  const project = host.create('Binary frontend');
  const previous = host.stage(project.id, source()).project.candidateRelease;
  const image = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j2WcAAAAASUVORK5CYII=';
  const assets = { 'public/logo.png': image };
  const current = host.stage(project.id, {
    ...source('1.0.1'), extraFiles: { 'index.html': '<img src="/logo.png">' },
    assetFiles: assets,
  }).project.candidateRelease;
  assert.deepEqual(host.release(project.id, current).source.assetFiles, assets);
  assert.deepEqual(host.candidateSource(project.id).assetFiles, assets);
  assert.equal(host.release(project.id, previous).source.assetFiles, undefined);
  assert.equal(host.stage(project.id, {
    ...source('1.0.1'), extraFiles: { 'index.html': '<img src="/logo.png">' },
    assetFiles: assets,
  }).unchanged, true);
  writeFileSync(path.join(root, project.id, 'releases', current, 'public', 'logo.png'), 'tampered');
  assert.throws(() => host.release(project.id, current), /Unsafe private Node binary asset|digest mismatch/);
});

test('M3 unsafe, malformed and mislabeled binary assets are never staged', (t) => {
  const { host } = setup(t);
  const project = host.create('Invalid media');
  for (const files of [
    { 'public/../logo.png': 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j2WcAAAAASUVORK5CYII=' },
    { 'public/.env.png': 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j2WcAAAAASUVORK5CYII=' },
    { 'src/logo.png': 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j2WcAAAAASUVORK5CYII=' },
    { 'public/logo.js': 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j2WcAAAAASUVORK5CYII=' },
    { 'public/logo.jpg': 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j2WcAAAAASUVORK5CYII=' },
    { 'public/logo.png': 'not-base64!!' },
    Object.fromEntries(Array.from({ length: 13 }, (_, i) =>
      ['public/' + i + '.png', 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j2WcAAAAASUVORK5CYII='])),
  ]) {
    assert.throws(() => host.stage(project.id, { ...source(), assetFiles: files }),
      /asset|format|budget|binary/i);
  }
  assert.equal(host.inspect(project.id).candidateRelease, null);
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

test('M3 concurrent Node editors cannot replace an unexpected source candidate', (t) => {
  const { host } = setup(t);
  const project = host.create('Concurrent editors');
  const first = host.stage(project.id, source(), null);
  assert.equal(first.unchanged, false);
  const firstId = first.project.candidateRelease;
  const latest = host.stage(project.id, source('1.0.1'), firstId);
  assert.equal(latest.unchanged, false);
  assert.equal(latest.project.previousCandidate, firstId);
  const latestId = latest.project.candidateRelease;
  assert.throws(
    () => host.stage(project.id, source('1.0.2'), firstId),
    /candidate changed/,
  );
  assert.throws(
    () => host.stage(project.id, source(), null),
    /candidate changed/,
  );
  assert.throws(
    () => host.stage(project.id, source('1.0.3'), 'bad-release'),
    /Invalid expected/,
  );
  assert.equal(host.inspect(project.id).candidateRelease, latestId);
  assert.equal(host.inspect(project.id).previousCandidate, firstId);
  assert.equal(host.inspect(project.id).deploymentCount, 2);
  assert.equal(host.candidates(project.id).length, 2);
  const retry = host.stage(project.id, source('1.0.1'), latestId);
  assert.equal(retry.unchanged, true);
  assert.equal(retry.project.candidateRelease, latestId);
});

test('M3 candidate restore rejects stale revisions even after A-B-A transitions', (t) => {
  const { host } = setup(t);
  const project = host.create('Safe restore revisions');
  const a = host.stage(project.id, source(), null, 0).project;
  const b = host.stage(project.id, source('1.0.1'), a.candidateRelease, 1).project;
  const restoredA = host.restoreCandidate(project.id, b.candidateRelease, 2);
  assert.equal(restoredA.candidateRelease, a.candidateRelease);
  assert.equal(restoredA.previousCandidate, b.candidateRelease);
  assert.equal(restoredA.deploymentCount, 3);
  assert.throws(() => host.restoreCandidate(project.id, b.candidateRelease, 2), /candidate changed/);
  const restoredB = host.restoreCandidate(project.id, a.candidateRelease, 3);
  assert.equal(restoredB.candidateRelease, b.candidateRelease);
  assert.equal(restoredB.deploymentCount, 4);
  assert.throws(() => host.restoreCandidate(project.id, b.candidateRelease, 2), /candidate changed/);
  assert.throws(() => host.stage(project.id, source('1.0.2'), b.candidateRelease, 2),
    /candidate changed/);
  assert.equal(host.inspect(project.id).deploymentCount, 4);
  assert.equal(host.candidates(project.id).length, 2);
});

test('M3 restore refuses tampered previous source without changing candidate pointer', (t) => {
  const { host, root } = setup(t);
  const project = host.create('Restore verified only');
  const a = host.stage(project.id, source()).project;
  const b = host.stage(project.id, source('1.0.1')).project;
  writeFileSync(path.join(root, project.id, 'releases', a.candidateRelease, 'server.mjs'),
    'console.log("tampered")');
  assert.throws(() => host.restoreCandidate(project.id, b.candidateRelease, 2),
    /digest mismatch/);
  const latest = host.inspect(project.id);
  assert.equal(latest.candidateRelease, b.candidateRelease);
  assert.equal(latest.previousCandidate, a.candidateRelease);
  assert.equal(latest.deploymentCount, 2);
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
  assert.equal(host.inspect(project.id).candidateRelease, staged.candidateRelease);
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
