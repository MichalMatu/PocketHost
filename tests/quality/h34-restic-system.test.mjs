import assert from 'node:assert/strict';
import test from 'node:test';
import os from 'node:os';
import path from 'node:path';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { WorkspaceFiles } from '../../src/modules/host/termux-admin.ts';
import { ResticWorkspaceAdmin } from '../../src/modules/host/termux-restic-admin.ts';

test('H3.4 Restic full system backup uses two fixed roots, excludes own key and repository', async () => {
  const temp = mkdtempSync(path.join(os.tmpdir(), 'pockethost-h34-system-'));
  const workspace = new WorkspaceFiles(path.join(temp, 'scratch'));
  const resticState = path.join(temp, 'encrypted');
  const restic = new ResticWorkspaceAdmin(workspace, resticState);
  const calls = [];
  const fake = async (binary, args, opts) => {
    calls.push([binary, args, opts]);
    if (args.includes('init')) {
      mkdirSync(path.join(resticState, 'repo'), { recursive: true });
      writeFileSync(path.join(resticState, 'repo', 'config'), '{}');
    }
    if (args.includes('snapshots')) return { exit: 0, output: JSON.stringify([
      { id: 'a'.repeat(64), time: '2026-11-07T14:00:00.000Z',
        paths: [os.homedir(), '/data/data/com.termux/files/usr'] },
    ]) };
    if (args.includes('restore')) {
      const target = args[args.indexOf('--target') + 1];
      mkdirSync(target, { recursive: true });
    }
    return { exit: 0, output: 'fixture only' };
  };
  try {
    await restic.backupScope('all', fake);
    const backup = calls.find(([, args]) => args.includes('backup'));
    assert.deepEqual(backup[1].slice(2), [
      'backup', '--tag', 'pockethost-h34-all', '--exclude', resticState, '--',
      os.homedir(), '/data/data/com.termux/files/usr',
    ]);
    assert.equal(backup[2].env.RESTIC_PASSWORD_FILE, path.join(resticState, 'password'));
    assert.equal(backup[2].env.RESTIC_PASSWORD, undefined);
    const snaps = await restic.scopeSnapshots('all', fake);
    assert.equal(snaps.length, 1);
    const result = await restic.restoreScopeToStaging('all', 'a'.repeat(64), fake);
    assert.ok(result.restoredTo.startsWith(path.join(resticState, 'restores')));
    await restic.forgetScope('all', 'a'.repeat(64), fake);
    assert.ok(calls.some(([, args]) => args.includes('forget')));
    await assert.rejects(restic.backupScope('strange', fake), /Unknown backup scope/);
    await assert.rejects(restic.restoreScopeToStaging('all', '../escape', fake), /Invalid Restic snapshot/);
    assert.equal(workspace.list().length, 0);
  } finally { rmSync(temp, { recursive: true, force: true }); }
});
