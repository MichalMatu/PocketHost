import assert from 'node:assert/strict';
import test from 'node:test';
import os from 'node:os';
import path from 'node:path';
import { createServer } from 'node:net';
import { mkdtempSync, rmSync } from 'node:fs';
import { SiteFleetHost } from '../../src/modules/host/site-fleet-host.ts';
import { decodeSiteZip } from '../../src/modules/sites/site-bundle.ts';

async function availablePort() {
  for (let attempt = 0; attempt < 8; attempt++) {
    const server = createServer();
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });
    const port = server.address().port;
    await new Promise((resolve) => server.close(resolve));
    if (port <= 65519) return port;
  }
  throw new Error('No valid loopback fixture port');
}

async function servedAsset(site, filename) {
  const encoded = filename.split('/').map(encodeURIComponent).join('/');
  const response = await fetch('http://127.0.0.1:' + site.port + '/' + encoded);
  assert.equal(response.status, 200, filename + ' must be served');
  assert.equal(response.headers.get('x-pockethost-release'), site.activeRelease);
  return Buffer.from(await response.arrayBuffer());
}

test('H2 active ZIP export reimports into another isolated owned site, preserving bytes and original', async () => {
  const tmp = mkdtempSync(path.join(os.tmpdir(), 'pockethost-zip-reimport-'));
  const fleet = new SiteFleetHost(path.join(tmp, 'owned-sites'), await availablePort());
  const created = [];
  let cleanupSafe = true;
  try {
    const original = await fleet.create('ZIP source fixture');
    created.push(original.id);
    const files = [
      { name: 'index.html', bytes: Buffer.from('<!doctype html><h1>Unchanged source</h1>') },
      { name: 'assets/icon.svg', bytes: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>') },
      { name: 'assets/pixel.png', bytes: Buffer.from([137, 80, 78, 71, 0, 255, 1, 2]) },
      { name: 'css/app.css', bytes: Buffer.from('body{color:navy}') },
    ];
    const published = await fleet.deploy(original.id, files);
    assert.equal((await fleet.start(original.id)).state, 'running');
    const sourceBefore = fleet.inspect(original.id);
    const exported = fleet.exportActiveZip(original.id);
    assert.equal(exported.release, published.activeRelease);
    const importedFiles = decodeSiteZip(exported.archive);
    assert.deepEqual(importedFiles.map(({ name }) => name).sort(), files.map(({ name }) => name).sort());

    const imported = await fleet.create('ZIP imported fixture');
    created.push(imported.id);
    const restored = await fleet.deploy(imported.id, importedFiles);
    assert.notEqual(restored.activeRelease, sourceBefore.activeRelease);
    assert.notEqual(imported.id, original.id);
    assert.notEqual(imported.port, original.port);
    assert.equal((await fleet.start(imported.id)).state, 'running');

    const destination = fleet.inspect(imported.id);
    for (const file of files) {
      const cloneBytes = await servedAsset(destination, file.name);
      const sourceBytes = await servedAsset(sourceBefore, file.name);
      assert.deepEqual(cloneBytes, file.bytes, file.name + ' round-trip bytes');
      assert.deepEqual(sourceBytes, file.bytes, file.name + ' original bytes');
    }
    const sourceAfter = fleet.inspect(original.id);
    assert.equal(sourceAfter.activeRelease, sourceBefore.activeRelease);
    assert.equal(sourceAfter.previousRelease, sourceBefore.previousRelease);
    assert.equal(sourceAfter.pid, sourceBefore.pid);
    assert.equal(sourceAfter.startTicks, sourceBefore.startTicks);
    assert.equal(sourceAfter.releases, sourceBefore.releases);
    assert.equal(sourceAfter.state, 'running');
    assert.equal(fleet.list().length, 2);
  } finally {
    for (const id of created.reverse()) {
      try {
        if (fleet.inspect(id).state === 'running') await fleet.stop(id);
        if (fleet.inspect(id).state === 'unknown') cleanupSafe = false;
      } catch {
        cleanupSafe = false;
      }
    }
    // Never delete a fixture directory while its process ownership is uncertain.
    if (cleanupSafe) rmSync(tmp, { recursive: true, force: true });
  }
});
