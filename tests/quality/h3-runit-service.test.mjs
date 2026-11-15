import assert from 'node:assert/strict';
import test from 'node:test';
import os from 'node:os';
import path from 'node:path';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, existsSync } from 'node:fs';
import { TermuxServiceAdmin } from '../../src/modules/host/termux-service-admin.ts';

function fixture() {
  const tmp = mkdtempSync(path.join(os.tmpdir(), 'pockethost-h3-runit-'));
  const services = path.join(tmp, 'services');
  mkdirSync(services);
  mkdirSync(path.join(services, 'site-worker'));
  mkdirSync(path.join(services, 'wreckscanner'));
  mkdirSync(path.join(services, 'wreckscanner-backup'));
  mkdirSync(path.join(services, 'pockethost-panel'));
  mkdirSync(path.join(services, 'pockethost-panel-watch'));
  return { tmp, services, registry: path.join(tmp, 'state', 'registry.json') };
}

test('H3 generic lifecycle never adopts a discovered runit service', async () => {
  const { tmp, services, registry } = fixture();
  const admin = new TermuxServiceAdmin(services, registry);
  const calls = [];
  const fakeRun = async (binary, args) => {
    calls.push([binary, args]);
    return { exit: 0, output: 'should never execute' };
  };
  try {
    const observed = admin.list(() => 'running');
    assert.equal(observed.find((item) => item.name === 'site-worker')?.registered, false);
    assert.equal(observed.find((item) => item.name === 'wreckscanner')?.registered, false);
    assert.equal(observed.find((item) => item.name === 'wreckscanner')?.protected, true);
    await assert.rejects(admin.apply('start', 'site-worker', fakeRun), /not explicitly registered/);
    await assert.rejects(admin.apply('stop', 'site-worker', fakeRun), /not explicitly registered/);
    await assert.rejects(
      admin.apply('restart', 'site-worker', fakeRun),
      /not explicitly registered/,
    );
    await assert.rejects(admin.apply('once', 'wreckscanner', fakeRun), /not explicitly registered/);
    await assert.rejects(
      admin.apply('register', 'site-worker', fakeRun),
      /attested PocketHost provisioner/,
    );
    await assert.rejects(admin.apply('unregister', 'site-worker', fakeRun), /Unregister refused/);
    assert.equal(admin.isRegistered('site-worker'), false);
    assert.deepEqual(calls, []);
    assert.equal(existsSync(registry), false);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('H3 runit protects PocketHost units and rejects aliases, traversal and adoption', async () => {
  const { tmp, services, registry } = fixture();
  const admin = new TermuxServiceAdmin(services, registry);
  const calls = [];
  const fakeRun = async () => {
    calls.push('called');
    return { exit: 0, output: '' };
  };
  try {
    for (const name of ['wreckscanner', 'wreckscanner-backup']) {
      assert.equal(admin.list(() => 'running').find((item) => item.name === name)?.protected, true);
      assert.equal(admin.isRegistered(name), false);
      await assert.rejects(
        admin.apply('register', name, fakeRun),
        /attested PocketHost provisioner/,
      );
      await assert.rejects(admin.apply('stop', name, fakeRun), /not explicitly registered/);
    }
    for (const name of ['pockethost-panel', 'pockethost-panel-watch']) {
      assert.equal(admin.list(() => 'running').find((item) => item.name === name)?.protected, true);
      for (const operation of [
        'register',
        'unregister',
        'start',
        'stop',
        'restart',
        'once',
        'enable',
        'disable',
      ]) {
        await assert.rejects(admin.apply(operation, name, fakeRun), /Protected service/);
      }
      assert.throws(() => admin.isRegistered(name), /Protected service/);
    }
    await assert.rejects(admin.apply('register', '../service', fakeRun), /Invalid/);
    await assert.rejects(admin.apply('start', 'site-worker/../wreckscanner', fakeRun), /Invalid/);
    symlinkSync(path.join(services, 'wreckscanner'), path.join(services, 'alias'));
    assert.equal(admin.isRegistered('alias'), false);
    await assert.rejects(admin.apply('stop', 'alias', fakeRun), /not explicitly registered/);
    symlinkSync(path.join(services, 'pockethost-panel'), path.join(services, 'protected-alias'));
    await assert.rejects(admin.apply('start', 'protected-alias', fakeRun), /Protected/);
    await assert.rejects(
      admin.apply('register', 'not-present', fakeRun),
      /attested PocketHost provisioner/,
    );
    await assert.rejects(admin.apply('start', 'not-present', fakeRun), /unavailable/);
    assert.deepEqual(calls, []);
    assert.equal(existsSync(registry), false);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('H3.4 runit enable/disable requires separately attested worker enrollment', async () => {
  const { tmp, services, registry } = fixture();
  const admin = new TermuxServiceAdmin(services, registry);
  const calls = [];
  const fakeRun = async () => {
    calls.push('called');
    return { exit: 0, output: '' };
  };
  try {
    await assert.rejects(
      admin.apply('enable', 'site-worker', fakeRun),
      /not explicitly registered/,
    );
    await assert.rejects(
      admin.apply('disable', 'wreckscanner', fakeRun),
      /not explicitly registered/,
    );
    await assert.rejects(admin.apply('disable', 'pockethost-panel', fakeRun), /Protected service/);
    await assert.rejects(
      admin.apply('register', 'site-worker', fakeRun),
      /attested PocketHost provisioner/,
    );
    assert.deepEqual(calls, []);
    assert.equal(existsSync(registry), false);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('H3 exact runit inspection separates foreign services from protected PocketHost services', () => {
  const { tmp, services, registry } = fixture();
  const admin = new TermuxServiceAdmin(services, registry);
  try {
    assert.equal(admin.isRegistered('site-worker'), false);
    assert.equal(admin.isRegistered('wreckscanner'), false);
    assert.throws(() => admin.isRegistered('pockethost-panel'), /Protected/);
    assert.throws(() => admin.isRegistered('not-registered'), /unavailable/);
    assert.equal(existsSync(registry), false);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});
