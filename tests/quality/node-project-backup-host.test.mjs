import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { NodeProjectBackupHost } from '../../src/modules/host/node-project-backup-host.ts';
import { NodeProjectHost } from '../../src/modules/host/node-project-host.ts';

function setup(t) {
  const home = mkdtempSync(path.join(os.tmpdir(), 'ph-node-restic-'));
  const root = path.join(home, 'private-node');
  const state = path.join(home, 'node-restic');
  t.after(() => rmSync(home, { recursive: true, force: true }));
  return { home, root, state,
    host: new NodeProjectBackupHost(root, state),
    projects: new NodeProjectHost(root) };
}
test('M2 Node Restic refuses unapproved backup and never uses the H3/system source', async (t) => {
  const { root, state, host } = setup(t);
  assert.deepEqual(host.status(), {
    initialized: false, repositoryPresent: false, keyPresent: false,
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
      return { exit: 0, output: JSON.stringify([{
        id: snapshot, time: '2026-11-10T12:00:00Z', paths: [root],
      }]) };
    }
    if (args.includes('restore')) {
      const destination = args[args.indexOf('--target') + 1];
      mkdirSync(destination, { recursive: true, mode: 0o700 });
    }
    return { exit: 0, output: 'ok' };
  };
  await host.backup(true, run);
  assert.ok(calls.some((call) => call.args.includes('pockethost-node') &&
    call.args.includes('backup') && call.cwd === path.dirname(root)));
  assert.ok(calls.some((call) => call.args.includes('**/.node-ports.lock')));
  assert.ok(calls.some((call) => call.args.includes('**/.node-runtime.lock')));
  assert.ok(calls.every((call) => !call.args.includes('home') &&
    !call.args.includes('prefix') && !call.args.includes('all')));
  const restored = await host.restoreToStaging(snapshot, true, run);
  assert.ok(restored.restoredTo.startsWith(path.join(state, 'restores') + path.sep));
  assert.equal(projects.inspect(project.id).activeRelease, null);
});

test('M2 Node Restic refuses foreign source and pending deployment entries before CLI', async (t) => {
  const { root, host, projects } = setup(t);
  projects.create('Owned project');
  const called = [];
  const run = async () => { called.push('restic'); return { exit: 0, output: '' }; };
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
  const run = async () => { calls.push('unexpected'); return { exit: 0, output: '' }; };
  const lock = path.join(root, '.node-ports.lock');
  writeFileSync(lock, '', { mode: 0o600 });
  await assert.rejects(host.backup(true, run), /Unexpected entry|deployment in progress/);
  assert.deepEqual(calls, []);
});
