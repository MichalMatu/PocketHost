import assert from 'node:assert/strict';
import test from 'node:test';
import os from 'node:os';
import path from 'node:path';
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
  symlinkSync,
  appendFileSync,
} from 'node:fs';
import { createServer } from 'node:net';
import { OwnedDemoHost } from '../../src/modules/host/owned-site-host.ts';

function allocatePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = address.port;
      server.close(() => resolve(port));
    });
  });
}
function fixture() {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'pockethost-owned-test-'));
  return { directory, root: path.join(directory, 'sites') };
}

test('owned demo: explicit create, start, live deploy, rollback, logs and verified stop', async () => {
  const { directory, root } = fixture();
  const port = await allocatePort();
  const site = new OwnedDemoHost(root, port);
  try {
    assert.equal(site.inspect().state, 'absent');
    assert.equal(site.create().state, 'stopped');
    assert.equal(site.create().contentVersion, 1);
    const [firstStart, concurrentStart] = await Promise.all([site.start(), site.start()]);
    assert.equal(firstStart.state, 'running');
    assert.equal(concurrentStart.state, 'running');
    let response = await fetch(`http://127.0.0.1:${port}/`);
    assert.equal(response.status, 200);
    assert.match(await response.text(), /First local site/);
    assert.equal((await fetch(`http://127.0.0.1:${port}/etc/passwd`)).status, 404);
    assert.equal((await fetch(`http://127.0.0.1:${port}/`, { method: 'POST' })).status, 405);
    assert.equal(site.publish(1).contentVersion, 1);
    assert.equal(site.inspect().canRollback, false);
    assert.throws(() => site.publish(3), /Unsupported demo version/);
    assert.equal(site.publish(2).contentVersion, 2);
    assert.equal(site.publish(2).contentVersion, 2);
    assert.equal(site.inspect().previousVersion, 1);
    response = await fetch(`http://127.0.0.1:${port}/`);
    assert.match(await response.text(), /Updated local site/);
    const restored = site.rollback();
    assert.equal(restored.contentVersion, 1);
    assert.equal(restored.previousVersion, null);
    assert.equal(restored.canRollback, false);
    response = await fetch(`http://127.0.0.1:${port}/`);
    assert.match(await response.text(), /First local site/);
    assert.throws(() => site.rollback(), /No prior demo version/);
    assert.equal(site.inspect().contentVersion, 1);
    // A later explicit publish creates a new rollback window, never a permanent toggle.
    const republished = site.publish(2);
    assert.equal(republished.contentVersion, 2);
    assert.equal(republished.previousVersion, 1);
    assert.equal(republished.canRollback, true);
    assert.equal(site.rollback().contentVersion, 1);
    assert.equal(site.inspect().canRollback, false);
    // Explicit selection of v1 after v2 is a new publication, never a rollback toggle.
    assert.equal(site.publish(2).contentVersion, 2);
    assert.equal(site.publish(1).contentVersion, 1);
    assert.equal(site.inspect().previousVersion, 2);
    assert.equal(site.rollback().contentVersion, 2);
    assert.equal(site.inspect().canRollback, false);
    assert.ok(site.readLogs().some((line) => line.includes('PocketHost owned demo listening')));
    appendFileSync(path.join(root, 'pockethost-demo', 'activity.log'), 'entry one\nentry two\n');
    const lines = site.readLogs();
    assert.ok(lines.includes('entry one'));
    assert.ok(lines.includes('entry two'));
    assert.ok(lines.every((line) => !line.includes('\n')));
    assert.equal((await site.stop()).state, 'stopped');
    assert.equal((await site.stop()).state, 'stopped');
  } finally {
    if (site.inspect().state === 'running') await site.stop();
    rmSync(directory, { recursive: true, force: true });
  }
});

test('occupied port is rejected without starting/stopping unrelated server', async () => {
  const { directory, root } = fixture();
  const server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  try {
    const site = new OwnedDemoHost(root, port);
    site.create();
    await assert.rejects(site.start(), /port already occupied/);
    assert.equal(site.inspect().state, 'stopped');
    assert.equal(server.listening, true);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    rmSync(directory, { recursive: true, force: true });
  }
});

test('forged or recycled PID is never terminated; mismatched instance fails closed', async () => {
  const { directory, root } = fixture();
  const port = await allocatePort();
  const site = new OwnedDemoHost(root, port);
  try {
    site.create();
    const filename = path.join(root, 'pockethost-demo', '.pockethost-owner.json');
    const marker = JSON.parse(readFileSync(filename, 'utf8'));
    const stat = readFileSync(`/proc/${process.pid}/stat`, 'utf8');
    const fields = stat
      .slice(stat.lastIndexOf(')') + 2)
      .trim()
      .split(/\s+/);
    marker.process = { pid: process.pid, startTicks: fields[19] };
    writeFileSync(filename, JSON.stringify(marker));
    assert.equal(site.inspect().state, 'unknown');
    await assert.rejects(site.stop(), /identity/);
    assert.equal(process.kill(process.pid, 0), true);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('a symlink root does not grant ownership or write permission', () => {
  const { directory, root } = fixture();
  const unrelated = path.join(directory, 'unrelated');
  mkdirSync(unrelated);
  symlinkSync(unrelated, root);
  try {
    const site = new OwnedDemoHost(root, 19787);
    assert.throws(() => site.create(), /noncanonical|linked/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
