import assert from 'node:assert/strict';
import test from 'node:test';
import os from 'node:os';
import path from 'node:path';
import {
  mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync,
} from 'node:fs';
import { createServer } from 'node:net';
import { SiteFleetHost } from '../../src/modules/host/site-fleet-host.ts';

const file = (html) => [{ name: 'index.html', bytes: Buffer.from('<h1>' + html + '</h1>') }];
function temp() {
  const root = mkdtempSync(path.join(os.tmpdir(), 'pockethost-h21-'));
  return { root, sites: path.join(root, 'sites') };
}
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
async function createFleet() {
  const tmp = temp();
  return { ...tmp, fleet: new SiteFleetHost(tmp.sites, await freePort()) };
}
async function cleanup(fleet, root) {
  for (const site of fleet.list()) {
    try {
      if (site.state === 'running') await fleet.stop(site.id);
    } catch {
      /* Negative test markers must never permit an unverified signal. */
    }
  }
  rmSync(root, { recursive: true, force: true });
}
const get = async (port, sub = '/') =>
  fetch('http://127.0.0.1:' + port + sub).then(async (response) => ({
    status: response.status,
    text: await response.text(),
  }));

test('H2.1: list three immutable releases, preview older without a switch, restore any, then undo', async () => {
  const { root, fleet } = await createFleet();
  let project;
  try {
    project = await fleet.create('Version history');
    const first = (await fleet.deploy(project.id, file('Original v1'))).activeRelease;
    const second = (await fleet.deploy(project.id, file('Middle v2'))).activeRelease;
    const third = (await fleet.deploy(project.id, file('Latest v3'))).activeRelease;
    assert.equal(fleet.listReleases(project.id).length, 3);
    assert.deepEqual(new Set(fleet.listReleases(project.id).map((x) => x.id)), new Set([first, second, third]));
    assert.ok(fleet.listReleases(project.id).every(x => x.createdAt && x.fileCount === 1 && x.bytes > 0));
    assert.equal(fleet.listReleases(project.id).filter(x => x.active)[0].id, third);
    assert.equal(fleet.listReleases(project.id).filter(x => x.rollbackTarget)[0].id, second);

    await fleet.start(project.id);
    const originalPid = fleet.inspect(project.id).pid;
    assert.match((await get(project.port)).text, /Latest v3/);
    assert.match((await get(project.port, '/__versions/' + first + '/')).text, /Original v1/);
    assert.match((await get(project.port, '/__versions/' + second + '/')).text, /Middle v2/);
    assert.match((await get(project.port)).text, /Latest v3/);
    assert.equal((await get(project.port, '/__versions/r-invalid/')).status, 404);
    assert.equal((await get(project.port, '/__versions/' + first + '/.pockethost-site.json')).status, 404);
    assert.equal((await get(project.port, '/__versions/' + first + '/%2e%2e/index.html')).status, 404);

    const restored = await fleet.restoreRelease(project.id, first);
    assert.equal(restored.activeRelease, first);
    assert.equal(restored.previousRelease, third);
    assert.equal(restored.canRollback, true);
    assert.equal(restored.pid, originalPid, 'selecting archived release must not restart the process');
    assert.equal(restored.history[0].action, 'restore');
    assert.match((await get(project.port)).text, /Original v1/);
    assert.equal((await fleet.rollback(project.id)).activeRelease, third);
    assert.match((await get(project.port)).text, /Latest v3/);
    await assert.rejects(fleet.rollback(project.id), /previous/);

    const pruned = await fleet.pruneRelease(project.id, first);
    assert.equal(pruned.activeRelease, third);
    assert.equal(pruned.history[0].action, 'prune');
    assert.equal(fleet.listReleases(project.id).length, 2);
    assert.ok(!fleet.listReleases(project.id).some(x => x.id === first));
    assert.equal((await get(project.port, '/__versions/' + first + '/')).status, 404);
    await assert.rejects(fleet.restoreRelease(project.id, first), /ENOENT|release|directory/i);
    assert.equal((await fleet.restoreRelease(project.id, second)).activeRelease, second);
    assert.match((await get(project.port)).text, /Middle v2/);
    assert.equal(fleet.inspect(project.id).releases, 2);
  } finally {
    await cleanup(fleet, root);
  }
});

test('H2.1: prune protects active, rollback and other projects and checks exact IDs', async () => {
  const { root, fleet } = await createFleet();
  try {
    const alpha = await fleet.create('Alpha project');
    const beta = await fleet.create('Beta project');
    const a1 = (await fleet.deploy(alpha.id, file('Alpha v1'))).activeRelease;
    const a2 = (await fleet.deploy(alpha.id, file('Alpha v2'))).activeRelease;
    const b1 = (await fleet.deploy(beta.id, file('Beta v1'))).activeRelease;
    await assert.rejects(fleet.pruneRelease(alpha.id, a2), /Active|rollback-target/);
    await assert.rejects(fleet.pruneRelease(alpha.id, a1), /Active|rollback-target/);
    await assert.rejects(fleet.restoreRelease(alpha.id, a2), /already active/);
    await assert.rejects(fleet.pruneRelease(alpha.id, b1), /ENOENT|release|directory/i);
    await assert.rejects(fleet.restoreRelease(alpha.id, b1), /ENOENT|release|directory/i);
    await assert.rejects(fleet.pruneRelease(alpha.id, '../../foreign'), /Invalid release/);
    await assert.rejects(fleet.restoreRelease(alpha.id, b1.replace('r-', '../')), /Invalid release/);
    assert.equal(fleet.listReleases(beta.id).length, 1);
    assert.equal(fleet.inspect(beta.id).activeRelease, b1);
    assert.equal(fleet.inspect(alpha.id).releases, 2);
  } finally {
    await cleanup(fleet, root);
  }
});

test('H2.1: linked archived content rejects listing, restore and deletion without touching external files', async () => {
  const { root, sites, fleet } = await createFleet();
  try {
    const item = await fleet.create('Linked archive');
    const older = (await fleet.deploy(item.id, file('Older v1'))).activeRelease;
    await fleet.deploy(item.id, file('Newest v2'));
    await fleet.deploy(item.id, file('Newest v3'));
    const external = path.join(root, 'unowned.txt');
    writeFileSync(external, 'foreign content');
    symlinkSync(external, path.join(sites, item.id, 'releases', older, 'linked.css'));
    assert.throws(() => fleet.listReleases(item.id), /Linked static asset/);
    await assert.rejects(fleet.restoreRelease(item.id, older), /Linked static asset/);
    await assert.rejects(fleet.pruneRelease(item.id, older), /Linked static asset/);
    assert.equal(readFileSync(external, 'utf8'), 'foreign content');
    assert.equal(fleet.inspect(item.id).activeRelease !== older, true);
  } finally { await cleanup(fleet, root); }
});

test('H2.1: unknown process owner blocks all mutating archived-version actions', async () => {
  const { root, sites, fleet } = await createFleet();
  try {
    const item = await fleet.create('Unverified owner');
    const older = (await fleet.deploy(item.id, file('Old'))).activeRelease;
    await fleet.deploy(item.id, file('New'));
    await fleet.deploy(item.id, file('Newest'));
    const filename = path.join(sites, item.id, '.pockethost-site.json');
    const marker = JSON.parse(readFileSync(filename, 'utf8'));
    const stat = readFileSync('/proc/' + process.pid + '/stat', 'utf8');
    marker.process = {
      pid: process.pid,
      ticks: stat.slice(stat.lastIndexOf(')') + 2).trim().split(/\s+/)[19],
      startedAt: new Date().toISOString(),
    };
    writeFileSync(filename, JSON.stringify(marker));
    assert.equal(fleet.inspect(item.id).state, 'unknown');
    await assert.rejects(fleet.restoreRelease(item.id, older), /uncertain/);
    await assert.rejects(fleet.pruneRelease(item.id, older), /uncertain/);
    assert.equal(fleet.listReleases(item.id).length, 3);
    assert.equal(fleet.inspect(item.id).activeRelease, marker.activeRelease);
  } finally { await cleanup(fleet, root); }
});

test('H2.1: explicitly pruning only obsolete versions frees a bounded archive slot', async () => {
  const { root, fleet } = await createFleet();
  try {
    const item = await fleet.create('Archive capacity');
    const versions = [];
    for (let i = 0; i < 16; i++) {
      const result = await fleet.deploy(item.id, file('Release ' + i));
      versions.push(result.activeRelease);
    }
    assert.equal(fleet.listReleases(item.id).length, 16);
    await assert.rejects(fleet.deploy(item.id, file('Release overflow')), /limit/);
    await fleet.pruneRelease(item.id, versions[0]);
    assert.equal(fleet.listReleases(item.id).length, 15);
    const recent = await fleet.deploy(item.id, file('Release after pruning'));
    assert.equal(recent.releases, 16);
    assert.equal(fleet.listReleases(item.id).length, 16);
    assert.equal(recent.activeRelease !== versions[0], true);
  } finally { await cleanup(fleet, root); }
});
