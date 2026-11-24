import assert from 'node:assert/strict';
import test from 'node:test';
import os from 'node:os';
import path from 'node:path';
import { existsSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { SiteFleetHost } from '../../src/modules/host/site-fleet-host.ts';

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
