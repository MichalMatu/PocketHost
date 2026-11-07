import assert from 'node:assert/strict';
import test from 'node:test';
import os from 'node:os';
import path from 'node:path';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, symlinkSync, existsSync } from 'node:fs';
import {
  applyPackageAction, previewPackageAction, WorkspaceFiles, WorkspaceBackups,
} from '../../src/modules/host/termux-admin.ts';

test('H3 package operations dispatch fixed apt-get argv without shell or arbitrary path', async () => {
  const calls = [];
  const mock = async (binary, args, options) => {
    calls.push([binary, args, options]);
    return { exit: 0, output: 'fixture only' };
  };
  await applyPackageAction('refresh', undefined, mock);
  await applyPackageAction('install', 'git', mock);
  await applyPackageAction('remove', 'vim', mock);
  await applyPackageAction('upgrade', 'curl', mock);
  await applyPackageAction('upgrade-all', undefined, mock);
  assert.deepEqual(calls.map(([bin, args]) => [bin, args]), [
    ['/data/data/com.termux/files/usr/bin/apt-get', ['update']],
    ['/data/data/com.termux/files/usr/bin/apt-get', ['-y', 'install', 'git']],
    ['/data/data/com.termux/files/usr/bin/apt-get', ['-y', 'remove', 'vim']],
    ['/data/data/com.termux/files/usr/bin/apt-get', ['-y', 'install', '--only-upgrade', 'curl']],
    ['/data/data/com.termux/files/usr/bin/apt-get', ['-y', 'upgrade']],
  ]);
  assert.equal(calls.length, 5);
  assert.ok(calls.every(([, , options]) => options.timeout <= 600000));
  await assert.rejects(applyPackageAction('install', '../../sshd', mock), /Invalid/);
  await assert.rejects(applyPackageAction('remove', 'curl;rm', mock), /Invalid/);
  await assert.rejects(applyPackageAction('shell', 'echo', mock), /Unsupported/);
  assert.equal(calls.length, 5, 'invalid input must not touch apt');
});

test('H3 workspace create, edit, move, delete and reversible snapshot without external files', () => {
  const tmp = mkdtempSync(path.join(os.tmpdir(), 'pockethost-h3-admin-'));
  const root = path.join(tmp, 'workspace');
  const backupsRoot = path.join(tmp, 'backups');
  const other = path.join(tmp, 'foreign.txt');
  writeFileSync(other, 'foreign-content');
  const files = new WorkspaceFiles(root);
  const backups = new WorkspaceBackups(files, backupsRoot);
  try {
    assert.deepEqual(files.list(), []);
    files.apply('mkdir', 'src');
    files.apply('save', 'src/example.ts', { content: 'export const value = 1' });
    assert.equal(files.read('src/example.ts'), 'export const value = 1');
    assert.deepEqual(files.list('src').map(item => item.name), ['example.ts']);
    files.apply('rename', 'src/example.ts', { destination: 'src/other.ts' });
    assert.throws(() => files.read('src/example.ts'), /absent/);
    assert.equal(files.read('src/other.ts'), 'export const value = 1');

    const snapshot = backups.create();
    assert.equal(snapshot.files, 1);
    files.apply('save', 'src/other.ts', { content: 'changed' });
    assert.equal(files.read('src/other.ts'), 'changed');
    assert.equal(backups.list().length, 1);
    assert.equal(backups.restore(snapshot.name).name, snapshot.name);
    assert.equal(files.read('src/other.ts'), 'export const value = 1');
    assert.equal(readFileSync(other, 'utf8'), 'foreign-content');

    assert.throws(() => files.list('../'), /Unsafe/);
    assert.throws(() => files.apply('save', '../foreign.txt', { content: 'bad' }), /Unsafe/);
    assert.throws(() => files.apply('delete', 'src'), /empty directories/);
    assert.throws(() => files.apply('rename', 'src/other.ts', { destination: '../foreign.txt' }), /Unsafe/);
    files.apply('delete', 'src/other.ts');
    files.apply('delete', 'src');
    assert.deepEqual(files.list(), []);
    backups.delete(snapshot.name);
    assert.deepEqual(backups.list(), []);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('H3 linked workspace entries and forged snapshot names never escape root', () => {
  const tmp = mkdtempSync(path.join(os.tmpdir(), 'pockethost-h3-linked-'));
  const files = new WorkspaceFiles(path.join(tmp, 'owned'));
  const backups = new WorkspaceBackups(files, path.join(tmp, 'snapshots'));
  const outside = path.join(tmp, 'outside.md');
  writeFileSync(outside, 'unchanged');
  try {
    files.list();
    symlinkSync(outside, path.join(files.root, 'linked.md'));
    assert.throws(() => files.read('linked.md'), /Unsafe/);
    assert.throws(() => files.apply('delete', 'linked.md'), /Unsafe/);
    assert.equal(files.list().length, 0, 'linked entry is not adopted');
    assert.throws(() => backups.create(), /Hidden or linked entry/);
    assert.throws(() => backups.restore('../../outside'), /Invalid snapshot/);
    assert.throws(() => backups.delete('../../outside'), /Invalid snapshot/);
    assert.equal(existsSync(outside), true);
    assert.equal(readFileSync(outside, 'utf8'), 'unchanged');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('H3 package simulation uses apt native solver without executing writes or a shell', async () => {
  const calls = [];
  const runner = async (bin, args) => { calls.push([bin, args]); return { exit: 0, output: 'Simulated' }; };
  await previewPackageAction('install', 'git', runner);
  await previewPackageAction('remove', 'vim', runner);
  await previewPackageAction('upgrade', 'curl', runner);
  await previewPackageAction('upgrade-all', undefined, runner);
  assert.deepEqual(calls.map(([, args]) => args), [
    ['-s', 'install', 'git'],
    ['-s', 'remove', 'vim'],
    ['-s', 'install', '--only-upgrade', 'curl'],
    ['-s', 'upgrade'],
  ]);
  assert.ok(calls.every(([bin]) => bin === '/data/data/com.termux/files/usr/bin/apt-get'));
  await assert.rejects(previewPackageAction('install', '../evil', runner), /Invalid/);
  await assert.rejects(previewPackageAction('remove', 'git;echo', runner), /Invalid/);
  assert.equal(calls.length, 4);
});

test('H3 workspace can import, copy, export and delete bounded binary files', () => {
  const tmp = mkdtempSync(path.join(os.tmpdir(), 'pockethost-h3-transfer-'));
  const files = new WorkspaceFiles(path.join(tmp, 'workspace'));
  try {
    const payload = Buffer.from([0, 255, 100, 33]).toString('base64');
    files.apply('upload', 'image.png', { base64: payload });
    assert.equal(files.download('image.png').base64, payload);
    files.apply('copy', 'image.png', { destination: 'image-copy.png' });
    assert.equal(files.download('image-copy.png').bytes, 4);
    assert.throws(() => files.apply('copy', 'image.png', { destination: 'image-copy.png' }), /exists/);
    assert.throws(() => files.apply('upload', 'too-big.bin', { base64: Buffer.alloc(129 * 1024).toString('base64') }), /oversized/);
    assert.throws(() => files.apply('upload', '../evil.png', { base64: payload }), /Unsafe/);
    assert.throws(() => files.apply('upload', 'bad.bin', { base64: '#corrupt!' }), /Invalid/);
    files.apply('delete', 'image-copy.png');
    assert.equal(files.list().length, 1);
  } finally { rmSync(tmp, { recursive: true, force: true }); }
});

test('H3 snapshots have a deterministic digest and refuse tampered recovery', () => {
  const tmp = mkdtempSync(path.join(os.tmpdir(), 'pockethost-h3-integrity-'));
  const workspace = new WorkspaceFiles(path.join(tmp, 'workspace'));
  const backups = new WorkspaceBackups(workspace, path.join(tmp, 'snapshots'));
  try {
    workspace.apply('save', 'note.md', { content: 'Original bytes' });
    const saved = backups.create();
    assert.match(saved.digest, /^[a-f0-9]{64}$/);
    assert.equal(backups.verify(saved.name).state, 'verified');
    const location = path.join(tmp, 'snapshots', saved.name, 'data', 'note.md');
    writeFileSync(location, 'Tampered bytes');
    assert.equal(backups.verify(saved.name).state, 'corrupt');
    workspace.apply('save', 'note.md', { content: 'New current value' });
    assert.throws(() => backups.restore(saved.name), /integrity/);
    assert.equal(workspace.read('note.md'), 'New current value');
  } finally { rmSync(tmp, { recursive: true, force: true }); }
});
