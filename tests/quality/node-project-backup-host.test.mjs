import assert from 'node:assert/strict';
import test from 'node:test';
import {
  mkdtempSync,
  mkdirSync,
  cpSync,
  symlinkSync,
  writeFileSync,
  existsSync,
  rmSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { NodeProjectBackupHost } from '../../src/modules/host/node-project-backup-host.ts';
import { NodeProjectHost } from '../../src/modules/host/node-project-host.ts';

function setup(t) {
  const home = mkdtempSync(path.join(os.tmpdir(), 'ph-node-restic-'));
  const root = path.join(home, 'private-node');
  const state = path.join(home, 'node-restic');
  t.after(() => rmSync(home, { recursive: true, force: true }));
  return {
    home,
    root,
    state,
    host: new NodeProjectBackupHost(root, state),
    projects: new NodeProjectHost(root),
  };
}
test('M2 Node Restic refuses unapproved backup and never uses the H3/system source', async (t) => {
  const { root, state, host } = setup(t);
  assert.deepEqual(host.status(), {
    initialized: false,
    repositoryPresent: false,
    keyPresent: false,
  });
  await assert.rejects(host.backup(false), /approval/);
  await assert.rejects(host.backup(true), /explicitly created/);
  await assert.rejects(host.restoreToStaging('a'.repeat(64), false), /approval/);
  assert.equal(existsSync(root), false);
  assert.equal(existsSync(state), false);
});
test('M2 Node Restic uses a separate scoped repository and restores to staging only', async (t) => {
  const { root, state, host, projects } = setup(t);
  const project = projects.create('Backup test');
  const calls = [];
  const snapshot = 'c'.repeat(64);
  const run = async (binary, args, opts) => {
    assert.equal(binary, '/data/data/com.termux/files/usr/bin/restic');
    assert.ok(args.includes('-r'));
    assert.equal(opts.env.RESTIC_PASSWORD_FILE, path.join(state, 'password'));
    assert.equal(opts.env.RESTIC_REPOSITORY, undefined);
    calls.push({ args, cwd: opts.cwd });
    if (args.includes('init')) {
      mkdirSync(path.join(state, 'repo'), { recursive: true, mode: 0o700 });
      writeFileSync(path.join(state, 'repo', 'config'), '{}', { mode: 0o600 });
    }
    if (args.includes('snapshots')) {
      return {
        exit: 0,
        output: JSON.stringify([
          {
            id: snapshot,
            time: '2026-11-10T12:00:00Z',
            paths: [root],
          },
        ]),
      };
    }
    if (args.includes('restore')) {
      const destination = args[args.indexOf('--target') + 1];
      mkdirSync(destination, { recursive: true, mode: 0o700 });
      cpSync(root, path.join(destination, path.basename(root)), { recursive: true });
    }
    return { exit: 0, output: 'ok' };
  };
  await host.backup(true, run);
  assert.ok(
    calls.some(
      (call) =>
        call.args.includes('pockethost-node') &&
        call.args.includes('backup') &&
        call.cwd === path.dirname(root),
    ),
  );
  assert.ok(calls.some((call) => call.args.includes('**/.node-ports.lock')));
  assert.ok(calls.some((call) => call.args.includes('**/.node-runtime.lock')));
  assert.ok(
    calls.every(
      (call) =>
        !call.args.includes('home') && !call.args.includes('prefix') && !call.args.includes('all'),
    ),
  );
  const restored = await host.restoreToStaging(snapshot, true, run);
  assert.ok(restored.restoredTo.startsWith(path.join(state, 'restores') + path.sep));
  assert.equal(restored.verifiedProjects, 1);
  assert.equal(projects.inspect(project.id).activeRelease, null);
});

test('M2 Node Restic refuses foreign source and pending deployment entries before CLI', async (t) => {
  const { root, host, projects } = setup(t);
  projects.create('Owned project');
  const called = [];
  const run = async () => {
    called.push('restic');
    return { exit: 0, output: '' };
  };
  writeFileSync(path.join(root, 'foreign.txt'), 'outside ownership');
  await assert.rejects(host.backup(true, run), /Unexpected entry/);
  rmSync(path.join(root, 'foreign.txt'));
  writeFileSync(path.join(root, '.node-ports.lock'), '', { mode: 0o600 });
  await assert.rejects(host.backup(true, run), /Unexpected entry|deployment in progress/);
  assert.equal(called.length, 0);
});

test('M2 Node Restic enforces a shared exclusive runtime/backup lock', async (t) => {
  const { root, host, projects } = setup(t);
  projects.create('Safe root');
  const calls = [];
  const run = async () => {
    calls.push('unexpected');
    return { exit: 0, output: '' };
  };
  const lock = path.join(root, '.node-ports.lock');
  writeFileSync(lock, '', { mode: 0o600 });
  await assert.rejects(host.backup(true, run), /Unexpected entry|deployment in progress/);
  assert.deepEqual(calls, []);
});

test('M2 restored Node scope refuses symlink insertion instead of importing external data', async (t) => {
  const { root, state, host, projects } = setup(t);
  const project = projects.create('Restic tamper');
  const snapshot = 'd'.repeat(64);
  const run = async (_binary, args) => {
    if (args.includes('init')) {
      mkdirSync(path.join(state, 'repo'), { recursive: true, mode: 0o700 });
      writeFileSync(path.join(state, 'repo', 'config'), '{}', { mode: 0o600 });
    }
    if (args.includes('snapshots')) {
      return {
        exit: 0,
        output: JSON.stringify([
          {
            id: snapshot,
            time: '2026-11-10T12:00:00Z',
            paths: [root],
          },
        ]),
      };
    }
    if (args.includes('restore')) {
      const destination = args[args.indexOf('--target') + 1];
      mkdirSync(destination, { recursive: true, mode: 0o700 });
      const restored = path.join(destination, path.basename(root));
      cpSync(root, restored, { recursive: true });
      symlinkSync('/dev/null', path.join(restored, project.id, 'foreign'));
    }
    return { exit: 0, output: 'ok' };
  };
  await host.backup(true, run);
  await assert.rejects(host.restoreToStaging(snapshot, true, run), /Unexpected entry/);
  assert.equal(projects.inspect(project.id).activeRelease, null);
});

test('M2 Node Restic backs up only attested multi-file text and binary source, restoring to staging', async (t) => {
  const { root, state, host, projects } = setup(t);
  const project = projects.create('Source assets');
  const image = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j2WcAAAAASUVORK5CYII=';
  const extras = { 'index.html': '<main>Verified</main>', 'src/main.ts': 'export const answer = 42' };
  const assets = { 'public/img/logo.png': image };
  const packageJson = { name: 'assets-fixture', version: '1.0.0', scripts: { start: 'node server.mjs' } };
  const packageLock = {
    name: 'assets-fixture', version: '1.0.0', lockfileVersion: 3,
    packages: { '': { name: 'assets-fixture', version: '1.0.0' } },
  };
  const staged = projects.stage(project.id, {
    packageJson, packageLock, serverSource: "console.log('ready')",
    extraFiles: extras, assetFiles: assets,
  });
  const calls = [];
  const snapshot = 'e'.repeat(64);
  const run = async (_binary, args) => {
    calls.push(args);
    if (args.includes('init')) {
      mkdirSync(path.join(state, 'repo'), { recursive: true, mode: 0o700 });
      writeFileSync(path.join(state, 'repo', 'config'), '{}', { mode: 0o600 });
    }
    if (args.includes('snapshots')) {
      return { exit: 0, output: JSON.stringify([{
        id: snapshot, time: '2026-11-21T22:00:00Z', paths: [root],
      }]) };
    }
    if (args.includes('restore')) {
      const destination = args[args.indexOf('--target') + 1];
      mkdirSync(destination, { recursive: true, mode: 0o700 });
      cpSync(root, path.join(destination, path.basename(root)), { recursive: true });
    }
    return { exit: 0, output: 'ok' };
  };
  await host.backup(true, run);
  assert.ok(calls.some(args => args.includes('backup')));
  const restored = await host.restoreToStaging(snapshot, true, run);
  assert.equal(restored.verifiedProjects, 1);
  assert.ok(restored.restoredTo.startsWith(path.join(state, 'restores') + path.sep));
  const reimport = new NodeProjectHost(path.join(restored.restoredTo, path.basename(root)));
  assert.deepEqual(reimport.candidateSource(project.id).extraFiles, extras);
  assert.deepEqual(reimport.candidateSource(project.id).assetFiles, assets);
  assert.equal(reimport.inspect(project.id).candidateRelease, staged.project.candidateRelease);
  assert.equal(projects.inspect(project.id).candidateRelease, staged.project.candidateRelease);
});

test('M2 Node Restic excludes mutable application data and rejects foreign nested source before CLI', async (t) => {
  const { root, host, projects } = setup(t);
  const project = projects.create('No unknown data');
  const src = {
    packageJson: { name: 'scoped-fixture', version: '1.0.0', scripts: { start: 'node server.mjs' } },
    packageLock: {
      name: 'scoped-fixture', version: '1.0.0', lockfileVersion: 3,
      packages: { '': { name: 'scoped-fixture', version: '1.0.0' } },
    },
    serverSource: "console.log('ready')",
    extraFiles: { 'src/main.ts': 'export const x = 1' },
  };
  const staged = projects.stage(project.id, src);
  const folder = path.join(root, project.id, 'releases', staged.project.candidateRelease);
  let invocations = 0;
  const run = async () => { invocations++; return { exit: 0, output: 'ok' }; };
  mkdirSync(path.join(root, project.id, 'uploads'), { mode: 0o700 });
  writeFileSync(path.join(root, project.id, 'uploads', 'record.db'), 'persistent state', { mode: 0o600 });
  await assert.rejects(host.backup(true, run), /Unexpected entry/);
  assert.equal(invocations, 0);
  rmSync(path.join(root, project.id, 'uploads'), { recursive: true });
  writeFileSync(path.join(folder, 'src', 'untracked.ts'), 'untracked', { mode: 0o600 });
  await assert.rejects(host.backup(true, run), /Unexpected file|Unexpected entry/);
  assert.equal(invocations, 0);
  assert.equal(projects.inspect(project.id).candidateRelease, staged.project.candidateRelease);
});
