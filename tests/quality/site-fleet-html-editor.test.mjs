import assert from 'node:assert/strict';
import test from 'node:test';
import os from 'node:os';
import path from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { SiteFleetHost } from '../../src/modules/host/site-fleet-host.ts';

async function freePort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

test('static HTML editor reads exactly the published index, update and rollback', async () => {
  const tmp = mkdtempSync(path.join(os.tmpdir(), 'pockethost-html-editor-'));
  const fleet = new SiteFleetHost(path.join(tmp, 'sites'), await freePort());
  try {
    const site = await fleet.create('One HTML page');
    assert.deepEqual(fleet.readActiveHtml(site.id), { release: null, html: null });

    const firstHtml = '<!doctype html><title>Zażółć v1</title>';
    const first = await fleet.deploy(site.id, [
      { name: 'index.html', bytes: Buffer.from(firstHtml, 'utf8') },
    ]);
    assert.deepEqual(fleet.readActiveHtml(site.id), {
      release: first.activeRelease,
      html: firstHtml,
    });

    const secondHtml = '<!doctype html><title>Updated v2</title>';
    const second = await fleet.deploy(site.id, [
      { name: 'index.html', bytes: Buffer.from(secondHtml, 'utf8') },
    ]);
    assert.notEqual(first.activeRelease, second.activeRelease);
    assert.equal(second.previousRelease, first.activeRelease);
    assert.deepEqual(fleet.readActiveHtml(site.id), {
      release: second.activeRelease,
      html: secondHtml,
    });

    const rollback = await fleet.rollback(site.id);
    assert.equal(rollback.activeRelease, first.activeRelease);
    assert.equal(fleet.readActiveHtml(site.id).html, firstHtml);
    assert.equal(fleet.readActiveHtml(site.id).release, first.activeRelease);
    assert.throws(() => fleet.readActiveHtml('site-' + 'f'.repeat(32)));
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('owned test site serves v1, v2 and rollback over loopback HTTP', async () => {
  const tmp = mkdtempSync(path.join(os.tmpdir(), 'pockethost-html-loopback-'));
  const fleet = new SiteFleetHost(path.join(tmp, 'sites'), await freePort());
  let siteId = null;
  try {
    const site = await fleet.create('Isolated HTML verification site');
    siteId = site.id;
    const firstHtml = '<!doctype html><title>Version one</title><p>v1</p>';
    const first = await fleet.deploy(siteId, [
      { name: 'index.html', bytes: Buffer.from(firstHtml, 'utf8') },
    ]);
    const started = await fleet.start(siteId);
    assert.equal(started.state, 'running');
    assert.equal(started.activeRelease, first.activeRelease);

    async function served(expectedRelease, expectedHtml) {
      assert.equal(await fleet.health(siteId), true);
      const response = await fetch('http://127.0.0.1:' + started.port + '/', {
        cache: 'no-store',
        redirect: 'error',
        signal: AbortSignal.timeout(5000),
      });
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('x-pockethost-release'), expectedRelease);
      assert.equal(await response.text(), expectedHtml);
    }
    await served(first.activeRelease, firstHtml);

    const secondHtml = '<!doctype html><title>Version two</title><p>v2</p>';
    const second = await fleet.deploy(siteId, [
      { name: 'index.html', bytes: Buffer.from(secondHtml, 'utf8') },
    ]);
    assert.notEqual(second.activeRelease, first.activeRelease);
    await served(second.activeRelease, secondHtml);

    const restored = await fleet.rollback(siteId);
    assert.equal(restored.activeRelease, first.activeRelease);
    await served(first.activeRelease, firstHtml);
  } finally {
    // Only the temporary owned child may be stopped. Never signal an
    // unverified/foreign process, and retain its marker for inspection if unsafe.
    if (siteId) {
      const current = fleet.inspect(siteId);
      if (current.state === 'running') await fleet.stop(siteId);
      assert.equal(fleet.inspect(siteId).state, 'stopped');
    }
    rmSync(tmp, { recursive: true, force: true });
  }
});
