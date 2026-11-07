import assert from 'node:assert/strict';
import test from 'node:test';
import os from 'node:os';
import path from 'node:path';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, symlinkSync } from 'node:fs';
import { createServer } from 'node:net';
import { SiteFleetHost } from '../../src/modules/host/site-fleet-host.ts';

function fixture() {
  const tmp = mkdtempSync(path.join(os.tmpdir(), 'pockethost-h2-fleet-test-'));
  return { tmp, root: path.join(tmp, 'managed') };
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
const file = (name, value) => ({ name, bytes: Buffer.from(value) });

test('H2: two real isolated sites, live asset release, HTTP health and one-step rollback', async () => {
  const { tmp, root } = fixture();
  const port = await freePort();
  const fleet = new SiteFleetHost(root, port);
  let firstId;
  let secondId;
  try {
    const first = await fleet.create('My Website');
    const second = await fleet.create('Second site');
    firstId = first.id;
    secondId = second.id;
    assert.notEqual(first.id, second.id);
    assert.notEqual(first.port, second.port);
    assert.equal(fleet.list().length, 2);
    assert.equal(first.state, 'stopped');
    assert.equal(first.activeRelease, null);
    assert.equal(first.pid, null);
    assert.equal(await fleet.health(firstId), false);
    await assert.rejects(fleet.start(firstId), /Publish/);

    const published = await fleet.deploy(firstId, [
      file(
        'index.html',
        '<html><link rel="stylesheet" href="./css/site.css"><h1>Uploaded H2 v1</h1></html>',
      ),
      file('css/site.css', 'body{color:red}'),
    ]);
    assert.equal(published.state, 'stopped');
    assert.equal(published.fileCount, 2);
    assert.equal(published.history[0].action, 'publish');
    assert.equal(published.canRollback, false);
    assert.equal((await fleet.start(firstId)).state, 'running');
    assert.equal(await fleet.health(firstId), true);
    const original = fleet.inspect(firstId);
    assert.ok(original.pid >= 2);
    assert.match(original.startTicks, /^\d+$/);
    assert.ok(original.uptimeSeconds >= 0);
    let response = await fetch('http://127.0.0.1:' + first.port + '/');
    assert.equal(response.status, 200);
    assert.match(await response.text(), /Uploaded H2 v1/);
    assert.match(response.headers.get('x-pockethost-instance'), /^[0-9a-f-]{36}$/);
    response = await fetch('http://127.0.0.1:' + first.port + '/css/site.css');
    assert.equal(response.status, 200);
    assert.equal(await response.text(), 'body{color:red}');
    assert.equal(
      (await fetch('http://127.0.0.1:' + first.port + '/.pockethost-site.json')).status,
      404,
    );
    assert.equal((await fetch('http://127.0.0.1:' + first.port + '/missing.js')).status, 404);
    assert.equal(
      (await fetch('http://127.0.0.1:' + first.port + '/', { method: 'POST' })).status,
      405,
    );

    const updated = await fleet.deploy(firstId, [file('index.html', '<h1>Uploaded H2 v2</h1>')]);
    assert.equal(updated.state, 'running');
    assert.notEqual(updated.activeRelease, original.activeRelease);
    assert.equal(updated.previousRelease, original.activeRelease);
    assert.equal(updated.canRollback, true);
    assert.equal(updated.fileCount, 1);
    response = await fetch('http://127.0.0.1:' + first.port + '/');
    assert.match(await response.text(), /Uploaded H2 v2/);
    const undone = await fleet.rollback(firstId);
    assert.equal(undone.activeRelease, original.activeRelease);
    assert.equal(undone.previousRelease, null);
    response = await fetch('http://127.0.0.1:' + first.port + '/');
    assert.match(await response.text(), /Uploaded H2 v1/);
    await assert.rejects(fleet.rollback(firstId), /previous/);

    const restarted = await fleet.restart(firstId);
    assert.equal(restarted.state, 'running');
    assert.ok(restarted.pid !== original.pid || restarted.startTicks !== original.startTicks);
    assert.equal(await fleet.health(firstId), true);
    assert.ok(fleet.logs(firstId).some((line) => /PocketHost owned H2 site listening/.test(line)));
    assert.equal((await fleet.stop(firstId)).state, 'stopped');
    assert.equal(await fleet.health(firstId), false);

    await fleet.deploy(secondId, [file('index.html', '<h1>Second project</h1>')]);
    assert.equal((await fleet.start(secondId)).state, 'running');
    const response2 = await fetch('http://127.0.0.1:' + second.port + '/');
    assert.match(await response2.text(), /Second project/);
    assert.equal((await fleet.stop(secondId)).state, 'stopped');
    assert.equal(fleet.list().length, 2);
  } finally {
    for (const id of [firstId, secondId].filter(Boolean)) {
      try {
        if (fleet.inspect(id).state === 'running') await fleet.stop(id);
      } catch {
        /* fail closed */
      }
    }
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('H2: invalid name, unknown ID and unowned directory fail closed', async () => {
  const { tmp, root } = fixture();
  try {
    const fleet = new SiteFleetHost(root, await freePort());
    await assert.rejects(fleet.create('../IleStoi'), /name/);
    await assert.rejects(fleet.create('A'), /name/);
    assert.throws(() => fleet.inspect('photomap-test'), /Unknown site/);
    mkdirSync(root);
    mkdirSync(path.join(root, 'site-' + 'a'.repeat(32)));
    assert.throws(() => fleet.list(), /ENOENT|marker|directory/i);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('H2: impossible source paths and malicious symlinks cannot become releases', async () => {
  const { tmp, root } = fixture();
  try {
    const fleet = new SiteFleetHost(root, await freePort());
    const item = await fleet.create('Owned static');
    await assert.rejects(
      fleet.deploy(item.id, [file('index.html', '<h1>safe</h1>'), file('../outside.js', 'bad')]),
      /Unsafe|denied/,
    );
    await assert.rejects(
      fleet.deploy(item.id, [file('index.html', '<h1>safe</h1>'), file('index.html', 'collision')]),
      /duplicate/i,
    );
    assert.equal(fleet.inspect(item.id).activeRelease, null);
    const external = path.join(tmp, 'foreign.html');
    writeFileSync(external, '<h1>external</h1>');
    symlinkSync(external, path.join(root, item.id, 'releases', 'evil-release'));
    await fleet.deploy(item.id, [file('index.html', '<h1>safe</h1>')]);
    assert.equal(fleet.inspect(item.id).activeRelease !== null, true);
    assert.equal(readFileSync(external, 'utf8'), '<h1>external</h1>');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('H2: occupied port is never adopted or terminated', async () => {
  const { tmp, root } = fixture();
  const fleet = new SiteFleetHost(root, await freePort());
  const foreign = createServer((_req, res) => res.end('foreign'));
  try {
    const owned = await fleet.create('Port conflict site');
    await fleet.deploy(owned.id, [file('index.html', '<h1>Owned</h1>')]);
    await new Promise((resolve, reject) => {
      foreign.once('error', reject);
      foreign.listen(owned.port, '127.0.0.1', resolve);
    });
    await assert.rejects(fleet.start(owned.id), /occupied/);
    assert.equal(fleet.inspect(owned.id).state, 'stopped');
    assert.equal(foreign.listening, true);
  } finally {
    if (foreign.listening) await new Promise((resolve) => foreign.close(resolve));
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('H2: forged own marker PID cannot signal another process', async () => {
  const { tmp, root } = fixture();
  try {
    const fleet = new SiteFleetHost(root, await freePort());
    const owned = await fleet.create('Process safety');
    const stat = readFileSync('/proc/' + process.pid + '/stat', 'utf8');
    const ticks = stat
      .slice(stat.lastIndexOf(')') + 2)
      .trim()
      .split(/\s+/)[19];
    const filename = path.join(root, owned.id, '.pockethost-site.json');
    const marker = JSON.parse(readFileSync(filename, 'utf8'));
    marker.process = { pid: process.pid, ticks, startedAt: new Date().toISOString() };
    writeFileSync(filename, JSON.stringify(marker));
    assert.equal(fleet.inspect(owned.id).state, 'unknown');
    assert.equal(fleet.inspect(owned.id).pid, null);
    await assert.rejects(fleet.stop(owned.id), /signal denied/);
    await assert.rejects(fleet.start(owned.id), /Publish|Unverified/);
    assert.equal(process.kill(process.pid, 0), true);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('H2: symlink root refuses all site creation without touching unrelated files', async () => {
  const { tmp, root } = fixture();
  const external = path.join(tmp, 'foreign');
  mkdirSync(external);
  symlinkSync(external, root);
  try {
    const fleet = new SiteFleetHost(root, await freePort());
    await assert.rejects(fleet.create('Do not adopt'), /linked/);
    assert.throws(() => fleet.list(), /linked/);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});
