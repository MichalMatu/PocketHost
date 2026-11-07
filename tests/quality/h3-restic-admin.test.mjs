import assert from 'node:assert/strict';
import test from 'node:test';
import os from 'node:os';
import path from 'node:path';
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { WorkspaceFiles } from '../../src/modules/host/termux-admin.ts';
import { ResticWorkspaceAdmin } from '../../src/modules/host/termux-restic-admin.ts';

function sample() {
  const root = mkdtempSync(path.join(os.tmpdir(), 'pockethost-h3-restic-'));
  const workspace = new WorkspaceFiles(path.join(root, 'workspace'));
  const state = path.join(root, 'restic');
  workspace.apply('save', 'note.md', { content: 'original' });
  return { root, state, workspace, restic: new ResticWorkspaceAdmin(workspace, state) };
}
test('H3 native Restic initializes a locally encrypted repo automatically, without UI login', async () => {
  const sampleData = sample();
  const commands = [];
  const runner = async (binary, args, options) => {
    commands.push({ binary, args, options });
    assert.equal(binary, '/data/data/com.termux/files/usr/bin/restic');
    assert.equal(args[0], '-r');
    assert.equal(args[1], path.join(sampleData.state, 'repo'));
    assert.ok(options.env.RESTIC_PASSWORD_FILE.startsWith(sampleData.state));
    assert.equal(options.env.RESTIC_PASSWORD, undefined);
    if (args.includes('init')) {
      mkdirSync(path.join(sampleData.state, 'repo'), { recursive: true });
      writeFileSync(path.join(sampleData.state, 'repo', 'config'), '{}');
    }
    return { exit: 0, output: 'mock completion' };
  };
  try {
    assert.deepEqual(sampleData.restic.status(), {
      initialized: false,
      repositoryPresent: false,
      keyPresent: false,
    });
    await sampleData.restic.backup(runner);
    assert.equal(commands.length, 2);
    assert.ok(commands[0].args.includes('init'));
    assert.deepEqual(commands[1].args.slice(2), [
      'backup',
      '--tag',
      'pockethost-h3',
      '--',
      sampleData.workspace.root,
    ]);
    const key = path.join(sampleData.state, 'password');
    assert.equal(lstatSync(key).mode & 0o077, 0);
    assert.ok(readFileSync(key, 'utf8').trim().length >= 32);
    assert.equal(sampleData.restic.status().initialized, true);
    assert.equal(sampleData.workspace.read('note.md'), 'original');
  } finally {
    rmSync(sampleData.root, { recursive: true, force: true });
  }
});
test('H3 Restic exact snapshot IDs, check, staged restore, forget and no workspace overwrite', async () => {
  const sampleData = sample();
  const id = 'a'.repeat(64);
  const records = [{ id, time: '2026-11-07T14:00:00.000Z', paths: [sampleData.workspace.root] }];
  const calls = [];
  const runner = async (binary, args) => {
    calls.push([binary, args]);
    if (args.includes('init')) {
      mkdirSync(path.join(sampleData.state, 'repo'), { recursive: true });
      writeFileSync(path.join(sampleData.state, 'repo', 'config'), '{}');
    }
    if (args.includes('snapshots')) return { exit: 0, output: JSON.stringify(records) };
    if (args.includes('restore')) {
      const index = args.indexOf('--target');
      mkdirSync(args[index + 1], { recursive: true });
    }
    return { exit: 0, output: 'mock completion' };
  };
  try {
    await sampleData.restic.initialize(runner);
    assert.deepEqual(await sampleData.restic.snapshots(runner), records);
    await sampleData.restic.check(runner);
    await assert.rejects(sampleData.restic.restoreToStaging('../evil', runner), /Invalid/);
    await assert.rejects(sampleData.restic.forget('f'.repeat(64), runner), /Unknown/);
    const restored = await sampleData.restic.restoreToStaging(id, runner);
    assert.ok(restored.restoredTo.startsWith(path.join(sampleData.state, 'restores')));
    assert.ok(existsSync(restored.restoredTo));
    assert.equal(sampleData.workspace.read('note.md'), 'original');
    await sampleData.restic.forget(id, runner);
    assert.ok(calls.some(([, args]) => args.includes('check')));
    assert.ok(calls.some(([, args]) => args.includes('forget') && args.includes('--prune')));
    assert.ok(calls.every(([binary]) => binary.endsWith('/restic')));
  } finally {
    rmSync(sampleData.root, { recursive: true, force: true });
  }
});
test('H3 Restic refuses linked repositories and unsafe recovery key permissions', async () => {
  const sampleData = sample();
  try {
    mkdirSync(sampleData.state);
    symlinkSync(sampleData.workspace.root, path.join(sampleData.state, 'repo'));
    await assert.rejects(sampleData.restic.initialize(), /Unsafe Restic repository/);
    rmSync(path.join(sampleData.state, 'repo'));
    writeFileSync(path.join(sampleData.state, 'password'), 'x'.repeat(48), { mode: 0o666 });
    chmodSync(path.join(sampleData.state, 'password'), 0o644);
    await assert.rejects(sampleData.restic.initialize(), /Unsafe Restic password file/);
  } finally {
    rmSync(sampleData.root, { recursive: true, force: true });
  }
});
