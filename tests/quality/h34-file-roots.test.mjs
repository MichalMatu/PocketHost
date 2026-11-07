import assert from 'node:assert/strict';
import test from 'node:test';
import os from 'node:os';
import path from 'node:path';
import { mkdtempSync, mkdirSync, rmSync, readFileSync, writeFileSync, symlinkSync } from 'node:fs';
import { TermuxFileRoots } from '../../src/modules/host/termux-file-roots.ts';

function demo() {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'pockethost-h34-roots-'));
  const roots = { home: path.join(dir, 'home'), prefix: path.join(dir, 'prefix'), shared: path.join(dir, 'shared') };
  for (const item of Object.values(roots)) mkdirSync(item);
  return { dir, roots, files: new TermuxFileRoots(roots) };
}
test('H3.4 full files operate in separately selected roots, including hidden files', () => {
  const { dir, roots, files } = demo();
  try {
    assert.ok(files.available().every(item => item.available));
    files.apply('home', 'mkdir', 'folder');
    files.apply('home', 'save', '.hidden.txt', { content: 'private fixture' });
    files.apply('home', 'save', 'folder/text.md', { content: 'Initial text' });
    assert.equal(files.readText('home', '.hidden.txt').content, 'private fixture');
    assert.equal(files.list('home').entries.some(item => item.name === '.hidden.txt'), true);
    files.apply('home', 'copy', 'folder/text.md', { destination: 'folder/copy.md' });
    files.apply('home', 'move', 'folder/copy.md', { destination: 'folder/moved.md' });
    assert.equal(files.readText('home', 'folder/moved.md').content, 'Initial text');
    const image = Buffer.from([0, 254, 1, 2, 7]).toString('base64');
    files.apply('shared', 'upload', 'binary.bin', { base64: image });
    assert.equal(files.export('shared', 'binary.bin').base64, image);
    assert.deepEqual(files.list('prefix').entries, []);
    assert.throws(() => files.apply('home', 'delete', ''), /Root-level/);
    assert.throws(() => files.apply('home', 'delete', 'folder'), /not empty/);
    files.apply('home', 'delete', 'folder/moved.md');
    files.apply('home', 'delete', 'folder/text.md');
    files.apply('home', 'delete', 'folder');
    assert.equal(readFileSync(path.join(roots.shared, 'binary.bin')).length, 5);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
test('H3.4 roots reject traversal, symlinks and out-of-root mutations', () => {
  const { dir, roots, files } = demo();
  const outside = path.join(dir, 'outside.txt');
  writeFileSync(outside, 'do not touch');
  try {
    symlinkSync(outside, path.join(roots.home, 'outside-link'));
    mkdirSync(path.join(roots.home, 'folder'));
    symlinkSync(roots.prefix, path.join(roots.home, 'folder', 'cross'));
    assert.equal(files.list('home').entries.find(item => item.name === 'outside-link')?.kind, 'link');
    assert.throws(() => files.readText('home', 'outside-link'), /Linked path/);
    assert.throws(() => files.apply('home', 'delete', 'outside-link'), /Linked path/);
    assert.throws(() => files.list('home', 'folder/cross'), /Linked path/);
    assert.throws(() => files.apply('home', 'save', '../outside.txt', { content: 'bad' }), /Unsafe/);
    assert.throws(() => files.apply('home', 'move', 'folder', { destination: '../outside.txt' }), /Unsafe/);
    assert.throws(() => files.apply('invalid', 'mkdir', 'whoops'), /Unknown filesystem root/);
    assert.equal(readFileSync(outside, 'utf8'), 'do not touch');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('H3.4 copies and removes a bounded tree only after validating all nested entries', () => {
  const { dir, roots, files } = demo();
  try {
    files.apply('home', 'mkdir', 'original');
    files.apply('home', 'mkdir', 'original/deep');
    files.apply('home', 'save', 'original/deep/note.txt', { content: 'keep original' });
    files.apply('home', 'copy-tree', 'original', { destination: 'clone' });
    assert.equal(files.readText('home', 'clone/deep/note.txt').content, 'keep original');
    files.apply('home', 'delete-tree', 'clone');
    assert.equal(files.list('home').entries.some(item => item.name === 'clone'), false);
    assert.equal(files.readText('home', 'original/deep/note.txt').content, 'keep original');
    symlinkSync(roots.prefix, path.join(roots.home, 'original', 'foreign-link'));
    assert.throws(() => files.apply('home', 'copy-tree', 'original', { destination: 'unsafe' }), /Linked tree/);
    assert.throws(() => files.apply('home', 'delete-tree', 'original'), /Linked tree/);
    assert.equal(files.readText('home', 'original/deep/note.txt').content, 'keep original');
    assert.throws(() => files.apply('home', 'delete-tree', ''), /Root-level/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
