import assert from 'node:assert/strict';
import test from 'node:test';
import os from 'node:os';
import path from 'node:path';
import { mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { SiteFleetHost } from '../../src/modules/host/site-fleet-host.ts';

async function freePort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const value = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return value;
}
test('H3 reads only exact-owned active assets, not release metadata or other sites', async () => {
  const tmp = mkdtempSync(path.join(os.tmpdir(), 'pockethost-h3-files-'));
  const fleet = new SiteFleetHost(path.join(tmp, 'sites'), await freePort());
  try {
    const one = await fleet.create('Read only assets');
    const two = await fleet.create('Other assets');
    assert.deepEqual(fleet.listActiveFiles(one.id), []);
    await fleet.deploy(one.id, [
      { name: 'index.html', bytes: Buffer.from('index') },
      { name: 'css/site.css', bytes: Buffer.from('colors') },
    ]);
    await fleet.deploy(two.id, [{ name: 'index.html', bytes: Buffer.from('secret') }]);
    assert.deepEqual(fleet.listActiveFiles(one.id), [
      { name: 'css/site.css', bytes: 6 },
      { name: 'index.html', bytes: 5 },
    ]);
    assert.deepEqual(fleet.listActiveFiles(two.id), [{ name: 'index.html', bytes: 6 }]);
    assert.throws(() => fleet.listActiveFiles('../../other'), /Unknown site/);
    const original = path.join(tmp, 'outside.css');
    writeFileSync(original, 'safe-external');
    const release = fleet.inspect(one.id).activeRelease;
    symlinkSync(original, path.join(tmp, 'sites', one.id, 'releases', release, 'linked.css'));
    assert.throws(() => fleet.listActiveFiles(one.id), /Linked static asset/);
    assert.equal(fleet.listActiveFiles(two.id).length, 1);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});
