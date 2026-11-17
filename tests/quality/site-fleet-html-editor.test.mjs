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
