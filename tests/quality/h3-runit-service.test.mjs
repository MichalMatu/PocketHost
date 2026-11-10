import assert from 'node:assert/strict';
import test from 'node:test';
import os from 'node:os';
import path from 'node:path';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, readFileSync } from 'node:fs';
import { TermuxServiceAdmin } from '../../src/modules/host/termux-service-admin.ts';

function fixture() {
  const tmp = mkdtempSync(path.join(os.tmpdir(), 'pockethost-h3-runit-'));
  const services = path.join(tmp, 'services');
  mkdirSync(services);
  mkdirSync(path.join(services, 'site-worker'));
  mkdirSync(path.join(services, 'wreckscanner'));
  mkdirSync(path.join(services, 'wreckscanner-backup'));
  return { tmp, services, registry: path.join(tmp, 'state', 'registry.json') };
}

test('H3 runit registration must be explicit; only then allow fixed argv lifecycle actions', async () => {
  const { tmp, services, registry } = fixture();
  const admin = new TermuxServiceAdmin(services, registry);
  const calls = [];
  const fakeRun = async (binary, args, options) => {
    calls.push([binary, args, options]);
    return { exit: 0, output: 'fixture only' };
  };
  try {
    const observed = admin.list(() => 'running');
    assert.equal(observed.find((item) => item.name === 'site-worker')?.registered, false);
    assert.equal(observed.find((item) => item.name === 'wreckscanner')?.protected, true);
    await assert.rejects(admin.apply('stop', 'site-worker', fakeRun), /not explicitly registered/);
    assert.equal(calls.length, 0);
    await admin.apply('register', 'site-worker', fakeRun);
    assert.equal(
      admin.list(() => 'running').find((item) => item.name === 'site-worker')?.registered,
      true,
    );
    const action = await admin.apply('restart', 'site-worker', fakeRun);
    assert.equal(action.changed, true);
    assert.deepEqual(
      calls.map(([binary, args]) => [binary, args]),
      [['/data/data/com.termux/files/usr/bin/sv', ['restart', path.join(services, 'site-worker')]]],
    );
    assert.equal(calls[0][2].timeout, 20000);
    assert.ok(!readFileSync(registry, 'utf8').includes('secret'));
    await admin.apply('unregister', 'site-worker', fakeRun);
    await assert.rejects(admin.apply('start', 'site-worker', fakeRun), /not explicitly registered/);
    assert.equal(calls.length, 1);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('H3 protected services, path traversal and symlink aliases never become manageable', async () => {
  const { tmp, services, registry } = fixture();
  const admin = new TermuxServiceAdmin(services, registry);
  try {
    await assert.rejects(admin.apply('register', 'wreckscanner'), /Protected/);
    await assert.rejects(admin.apply('stop', 'wreckscanner'), /Protected/);
    await assert.rejects(admin.apply('register', 'wreckscanner-backup'), /Protected/);
    await assert.rejects(admin.apply('stop', 'wreckscanner-backup'), /Protected/);
    assert.equal(
      admin.list(() => 'running').find((x) => x.name === 'wreckscanner-backup')?.protected,
      true,
    );
    await assert.rejects(admin.apply('register', '../service'), /Invalid/);
    await assert.rejects(admin.apply('start', 'site-worker/../wreckscanner'), /Invalid/);
    symlinkSync(path.join(services, 'wreckscanner'), path.join(services, 'alias'));
    await assert.rejects(admin.apply('register', 'alias'), /Protected/);
    symlinkSync(path.join(services, 'wreckscanner-backup'), path.join(services, 'backup-alias'));
    await assert.rejects(admin.apply('register', 'backup-alias'), /Protected/);
    await assert.rejects(admin.apply('register', 'not-present'), /unavailable/);
    assert.deepEqual(
      admin.list(() => 'stopped').map((x) => x.name),
      ['alias', 'backup-alias', 'site-worker', 'wreckscanner', 'wreckscanner-backup'],
    );
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('H3.4 runit enable/disable only explicitly registered non-protected exact services', async () => {
  const { tmp, services, registry } = fixture();
  const admin = new TermuxServiceAdmin(services, registry);
  const calls = [];
  const run = async (binary, args, opts) => {
    calls.push([binary, args, opts]);
    return { exit: 0, output: 'fixture only' };
  };
  try {
    await assert.rejects(admin.apply('enable', 'site-worker', run), /not explicitly registered/);
    await assert.rejects(admin.apply('disable', 'wreckscanner', run), /Protected/);
    await admin.apply('register', 'site-worker', run);
    await admin.apply('enable', 'site-worker', run);
    await admin.apply('disable', 'site-worker', run);
    assert.deepEqual(
      calls.map(([bin, args]) => [bin, args]),
      [
        ['/data/data/com.termux/files/usr/bin/sv-enable', ['site-worker']],
        ['/data/data/com.termux/files/usr/bin/sv-disable', ['site-worker']],
      ],
    );
    assert.ok(calls.every(([, , opts]) => opts.env.SVDIR === services));
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('exact runit registration inspection refuses unowned and protected services', async () => {
  const { tmp, services, registry } = fixture();
  const admin = new TermuxServiceAdmin(services, registry);
  try {
    assert.equal(admin.isRegistered('site-worker'), false);
    assert.throws(() => admin.isRegistered('wreckscanner'), /Protected/);
    assert.throws(() => admin.isRegistered('not-registered'), /unavailable/);
    await admin.apply('register', 'site-worker');
    assert.equal(admin.isRegistered('site-worker'), true);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});
