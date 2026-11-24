import assert from 'node:assert/strict';
import test from 'node:test';
import os from 'node:os';
import path from 'node:path';
import { existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { SITE_LIMIT, SiteFleetHost } from '../../src/modules/host/site-fleet-host.ts';

async function fixture(run) {
  const tmp = mkdtempSync(path.join(os.tmpdir(), 'pockethost-remove-test-'));
  const root = path.join(tmp, 'managed');
  const socket = createServer();
  await new Promise((resolve, reject) => {
    socket.once('error', reject);
    socket.listen(0, '127.0.0.1', resolve);
  });
  const port = socket.address().port;
  await new Promise((resolve) => socket.close(resolve));
  const fleet = new SiteFleetHost(root, port);
  try {
    await run(fleet, root, tmp);
  } finally {
    for (const site of fleet.list()) {
      if (site.state === 'running') await fleet.stop(site.id);
    }
    rmSync(tmp, { recursive: true, force: true });
  }
}
const snapshot = (site) => ({ activeRelease: site.activeRelease, releases: site.releases });
const html = (value) => [{ name: 'index.html', bytes: Buffer.from(value) }];

test('H2 removal releases capacity and permits the last site to disappear', async () => {
  await fixture(async (fleet, root) => {
    const first = await fleet.create('First');
    const second = await fleet.create('Second');
    const published = await fleet.deploy(first.id, html('<h1>First</h1>'));
    await fleet.deploy(second.id, html('<h1>Second</h1>'));
    assert.deepEqual(await fleet.remove(first.id, snapshot(published)), { deleted: first.id });
    assert.equal(existsSync(path.join(root, first.id)), false);
    assert.deepEqual(
      fleet.list().map((site) => site.id),
      [second.id],
    );
    const again = await fleet.create('Again');
    assert.equal(again.port, first.port);
    await fleet.remove(again.id, snapshot(again));
    await fleet.remove(second.id, snapshot(fleet.inspect(second.id)));
    assert.deepEqual(fleet.list(), []);
  });
});

test('H2 removal refuses running sites and stale release snapshots', async () => {
  await fixture(async (fleet) => {
    const first = await fleet.create('First');
    const published = await fleet.deploy(first.id, html('<h1>First</h1>'));
    await fleet.start(first.id);
    await assert.rejects(fleet.remove(first.id, snapshot(published)), /Stop and verify/);
    assert.equal(await fleet.health(first.id), true);
    await fleet.stop(first.id);
    const updated = await fleet.deploy(first.id, html('<h1>Updated</h1>'));
    await assert.rejects(fleet.remove(first.id, snapshot(published)), /Site changed/);
    assert.equal(fleet.inspect(first.id).activeRelease, updated.activeRelease);
    await fleet.remove(first.id, snapshot(updated));
    assert.deepEqual(fleet.list(), []);
  });
});

test('H2 removal refuses unexpected entries, symlinks and unknown identities', async () => {
  await fixture(async (fleet, root, tmp) => {
    const first = await fleet.create('First');
    const foreign = path.join(tmp, 'foreign');
    writeFileSync(foreign, 'keep');
    const link = path.join(root, first.id, 'activity.log');
    symlinkSync(foreign, link);
    await assert.rejects(fleet.remove(first.id, snapshot(first)), /Unsafe or linked/);
    assert.equal(existsSync(foreign), true);
    rmSync(link);
    const unexpected = path.join(root, first.id, 'unexpected');
    writeFileSync(unexpected, 'keep');
    await assert.rejects(fleet.remove(first.id, snapshot(first)), /Unexpected site files/);
    assert.equal(existsSync(unexpected), true);
    await assert.rejects(fleet.remove('../foreign', snapshot(first)), /Unknown site/);
    rmSync(unexpected);
    await fleet.remove(first.id, snapshot(first));
  });
});

test('H2 removal reclaims a slot from a full eight-site catalog', async () => {
  await fixture(async (fleet) => {
    const sites = [];
    for (let i = 0; i < SITE_LIMIT; i++) sites.push(await fleet.create('Site ' + i));
    assert.equal(sites.length, 8);
    await assert.rejects(fleet.create('Overflow'), /Site limit/);
    const victim = sites[3];
    await fleet.remove(victim.id, snapshot(victim));
    const replacement = await fleet.create('Replacement');
    assert.equal(replacement.port, victim.port);
    assert.notEqual(replacement.id, victim.id);
    assert.equal(fleet.list().length, SITE_LIMIT);
    for (const site of sites.filter((item) => item.id !== victim.id)) {
      assert.equal(fleet.inspect(site.id).id, site.id);
    }
    for (const site of fleet.list()) await fleet.remove(site.id, snapshot(site));
    assert.deepEqual(fleet.list(), []);
  });
});

test('H2 serialized deploy and removal reject a stale snapshot and duplicate removal', async () => {
  await fixture(async (fleet) => {
    const site = await fleet.create('Concurrent');
    const [published, rejected] = await Promise.allSettled([
      fleet.deploy(site.id, html('<h1>New version</h1>')),
      fleet.remove(site.id, snapshot(site)),
    ]);
    assert.equal(published.status, 'fulfilled');
    assert.equal(rejected.status, 'rejected');
    assert.match(rejected.reason.message, /Site changed/);
    const current = fleet.inspect(site.id);
    assert.equal(current.activeRelease, published.value.activeRelease);
    const results = await Promise.allSettled([
      fleet.remove(site.id, snapshot(current)),
      fleet.remove(site.id, snapshot(current)),
    ]);
    assert.equal(results[0].status, 'fulfilled');
    assert.equal(results[1].status, 'rejected');
    assert.deepEqual(fleet.list(), []);
  });
});

test('H2 removal refuses uncertain ownership without signalling the recorded PID', async () => {
  await fixture(async (fleet, root) => {
    const site = await fleet.create('Uncertain');
    const marker = path.join(root, site.id, '.pockethost-site.json');
    const original = readFileSync(marker, 'utf8');
    const forged = JSON.parse(original);
    forged.process = { pid: process.pid, ticks: '0', startedAt: new Date().toISOString() };
    writeFileSync(marker, JSON.stringify(forged));
    try {
      assert.equal(fleet.inspect(site.id).state, 'unknown');
      await assert.rejects(fleet.remove(site.id, snapshot(site)), /Stop and verify/);
      assert.equal(existsSync(marker), true);
    } finally {
      writeFileSync(marker, original);
    }
    await fleet.remove(site.id, snapshot(site));
  });
});

test('H2 removal refuses an occupied port and preserves the other site', async () => {
  await fixture(async (fleet) => {
    const victim = await fleet.create('Victim');
    const other = await fleet.create('Other site');
    await fleet.deploy(other.id, html('<h1>Other</h1>'));
    const running = await fleet.start(other.id);
    const listener = createServer();
    await new Promise((resolve, reject) => {
      listener.once('error', reject);
      listener.listen(victim.port, '127.0.0.1', resolve);
    });
    try {
      await assert.rejects(fleet.remove(victim.id, snapshot(victim)), /Stop and verify/);
      assert.equal(fleet.inspect(victim.id).state, 'stopped');
      assert.equal(listener.listening, true);
    } finally {
      await new Promise((resolve) => listener.close(resolve));
    }
    await fleet.remove(victim.id, snapshot(victim));
    const observed = fleet.inspect(other.id);
    assert.equal(observed.pid, running.pid);
    assert.equal(observed.startTicks, running.startTicks);
    assert.equal(await fleet.health(other.id), true);
    await fleet.stop(other.id);
    await fleet.remove(other.id, snapshot(fleet.inspect(other.id)));
  });
});
