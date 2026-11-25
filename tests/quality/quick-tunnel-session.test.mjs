import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { test } from 'node:test';
import { QuickTunnelSession, quickTunnelUrl } from '../../src/modules/host/quick-tunnel-session.mjs';

const id = 'site-' + 'a'.repeat(32);
const other = 'site-' + 'b'.repeat(32);
const url = 'https://demo-one.trycloudflare.com';

function fixture({ startupMs = 1000, stopMs = 100, acknowledgeStop = true } = {}) {
  const child = new EventEmitter();
  Object.assign(child, {
    pid: 42,
    exitCode: null,
    signalCode: null,
    stdout: new PassThrough(),
    stderr: new PassThrough(),
  });
  const calls = [];
  child.kill = (signal) => {
    calls.push(signal);
    if (acknowledgeStop) {
      queueMicrotask(() => {
        child.signalCode = signal;
        child.emit('close');
      });
    }
    return true;
  };
  const origin = {
    address: () => ({ address: '127.0.0.1', port: 32123 }),
    close: () => calls.push('close-origin'),
    closeAllConnections: () => calls.push('close-connections'),
  };
  const manager = new QuickTunnelSession({
    resolveSite: (target) => (target === '/h2/' + id + '/' ? { port: 19080, path: '/' } : null),
    openOrigin: async () => origin,
    launch: (port) => {
      assert.equal(port, 32123);
      calls.push('launch');
      return child;
    },
    startupMs,
    stopMs,
  });
  return { manager, child, calls };
}

test('URL parsing accepts only dedicated HTTPS Quick Tunnel rows', () => {
  assert.equal(quickTunnelUrl('|  ' + url + '  |'), url);
  assert.equal(quickTunnelUrl(url), url);
  for (const invalid of [
    'https://api.trycloudflare.com',
    'http://demo-one.trycloudflare.com',
    url + '.example.org',
    url + '/admin',
    url + ':443',
    'https://-demo.trycloudflare.com',
    'https://demo-.trycloudflare.com',
    'https://a.b.trycloudflare.com',
    'unexpected log ' + url,
  ]) {
    assert.equal(quickTunnelUrl(invalid), null, invalid);
  }
});

test('explicit publication assigns a URL, excludes other sites and stops only its child', async () => {
  const { manager, child, calls } = fixture();
  assert.equal(manager.status().state, 'stopped');
  await assert.rejects(manager.start(other));
  assert.deepEqual(calls, []);
  assert.equal((await manager.start(id)).state, 'starting');
  await assert.rejects(manager.start(id));
  await assert.rejects(manager.stop(other));
  child.stderr.write('Requesting https://api.trycloudflare.com\n');
  child.stderr.write('| https://demo-');
  assert.equal(manager.status().state, 'starting');
  child.stderr.write('one.trycloudflare.com |\n');
  assert.deepEqual(manager.status(), { siteId: id, state: 'url-assigned', reason: null, url });
  child.stdout.write('https://another.trycloudflare.com\n');
  assert.equal(manager.status().url, url);
  assert.equal((await manager.stop(id)).state, 'stopped');
  assert.equal(manager.status().url, null);
  assert.deepEqual(calls, ['launch', 'close-origin', 'close-connections', 'SIGTERM']);
  child.stderr.write(url + '\n');
  assert.equal(manager.status().state, 'stopped');
});

test('connector exit withdraws the URL and closes the origin', async () => {
  const { manager, child, calls } = fixture();
  await manager.start(id);
  child.stdout.write(url + '\n');
  child.exitCode = 1;
  child.emit('close');
  assert.equal(manager.status().state, 'failed');
  assert.equal(manager.status().reason, 'connector-exited');
  assert.equal(manager.status().url, null);
  assert.deepEqual(calls, ['launch', 'close-origin', 'close-connections']);
});

test('startup timeout closes the origin and stops its child', async () => {
  const { manager, calls } = fixture({ startupMs: 5 });
  await manager.start(id);
  await new Promise((resolve) => setTimeout(resolve, 40));
  assert.equal(manager.status().state, 'failed');
  assert.equal(manager.status().reason, 'startup-timeout');
  assert.deepEqual(calls, ['launch', 'close-origin', 'close-connections', 'SIGTERM']);
});

test('unknown stop blocks another launch until the original child closes', async () => {
  const { manager, child, calls } = fixture({ stopMs: 5, acknowledgeStop: false });
  await manager.start(id);
  const stopped = manager.stop(id);
  await new Promise((resolve) => setTimeout(resolve, 40));
  assert.equal((await stopped).state, 'unknown');
  await assert.rejects(manager.start(id));
  assert.equal(calls.filter((call) => call === 'SIGTERM').length, 1);
  child.emit('close');
  assert.equal(manager.status().state, 'stopped');
});

test('failed origin never starts a connector', async () => {
  const manager = new QuickTunnelSession({
    resolveSite: () => ({ port: 19080, path: '/' }),
    openOrigin: async () => {
      throw new Error('fixture failure');
    },
    launch: () => assert.fail('must not launch'),
  });
  assert.equal((await manager.start(id)).state, 'failed');
  assert.equal(manager.status().reason, 'launch-rejected');
});
