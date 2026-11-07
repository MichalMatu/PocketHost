import assert from 'node:assert/strict';
import test from 'node:test';
import {
  listInstalledTermuxPackages,
  searchAvailableTermuxPackages,
} from '../../src/modules/host/termux-package-catalog.ts';

test('H3 full installed Termux inventory reuses fixed dpkg-query format and rejects malformed names', async () => {
  const commands = [];
  const fake = async (binary, argv, opts) => {
    commands.push({ binary, argv, opts });
    return { exit: 0, output: 'curl\t8.0\nnodejs\t26.4.0\n../unsafe\t9\n' };
  };
  const result = await listInstalledTermuxPackages(fake);
  assert.deepEqual(result.packages, [
    { name: 'curl', version: '8.0' },
    { name: 'nodejs', version: '26.4.0' },
  ]);
  assert.equal(result.truncated, false);
  assert.equal(commands[0].binary, '/data/data/com.termux/files/usr/bin/dpkg-query');
  assert.deepEqual(commands[0].argv, ['-W', '-f=${binary:Package}\\t${Version}\\n']);
  assert.ok(commands[0].opts.outputLimit >= 150000);
});

test('H3 apt-cache lookup is a literal, bounded, read-only search', async () => {
  const commands = [];
  const fake = async (binary, argv, opts) => {
    commands.push([binary, argv, opts]);
    return { exit: 0, output: 'restic - Fast encrypted backup utility\nunsafe/name - bad\n' };
  };
  const result = await searchAvailableTermuxPackages('restic', fake);
  assert.deepEqual(result.packages, [
    { name: 'restic', description: 'Fast encrypted backup utility' },
  ]);
  assert.deepEqual(commands[0][1], ['search', '--names-only', 'restic']);
  assert.equal(commands[0][0], '/data/data/com.termux/files/usr/bin/apt-cache');
  await assert.rejects(searchAvailableTermuxPackages('../../root', fake), /Invalid/);
  await assert.rejects(searchAvailableTermuxPackages('foo|bar', fake), /Invalid/);
  assert.equal(commands.length, 1);
});
