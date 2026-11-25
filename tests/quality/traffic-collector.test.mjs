import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  createTrafficRecorder,
  readTraffic,
  TRAFFIC_FILE_LIMIT,
} from '../../src/modules/host/traffic-store.mjs';
import {
  observeTrafficResponse,
  subscribeTrafficHttp,
} from '../../src/modules/host/traffic-http.mjs';

const start = Date.parse('2026-11-25T01:00:00Z');
const first = 'site-' + 'a'.repeat(32);
const second = 'node-' + 'b'.repeat(32);
const identity = { pid: 123, startTicks: '456' };
const options = { identity, clock: () => start, flushMs: 60000 };
const observation = { at: start, status: 200, bytes: 6, path: '/hello' };

test('bounded project snapshots preserve identity and survive recorder restart', async () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'pockethost-traffic-'));
  const root = path.join(dir, 'traffic');
  try {
    const a = createTrafficRecorder(root, first, options);
    const b = createTrafficRecorder(root, second, options);
    assert.ok(a && b);
    assert.equal(a.record(observation), true);
    assert.equal(b.record({ ...observation, bytes: 2 }), true);
    assert.equal(await a.close(), true);
    assert.equal(await b.close(), true);
    const before = readTraffic(root, first, '24h', start);
    assert.equal(before.state, 'available');
    assert.deepEqual(before.session, identity);
    assert.equal(before.summary.bytes, 6);
    assert.equal(readTraffic(root, second, '24h', start).summary.bytes, 2);
    assert.equal(readTraffic(root, 'site-' + 'c'.repeat(32), '24h', start).state, 'missing');
    const resumed = createTrafficRecorder(root, first, {
      ...options,
      identity: { pid: 789, startTicks: '1011' },
    });
    assert.ok(resumed);
    resumed.record(observation);
    await resumed.close();
    const after = readTraffic(root, first, '24h', start);
    assert.equal(after.session.pid, 789);
    assert.equal(after.summary.requests, 2);
    assert.equal(after.summary.bytes, 12);
    assert.ok(readFileSync(path.join(root, first + '.json')).length < TRAFFIC_FILE_LIMIT);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('invalid storage is unavailable and never overwritten', async () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'pockethost-traffic-'));
  try {
    const root = path.join(dir, 'traffic');
    const recorder = createTrafficRecorder(root, first, options);
    assert.ok(recorder);
    await recorder.close();
    const file = path.join(root, first + '.json');
    writeFileSync(file, 'broken');
    assert.equal(readTraffic(root, first, '24h', start).state, 'unavailable');
    assert.equal(createTrafficRecorder(root, first, options), null);
    assert.equal(readFileSync(file, 'utf8'), 'broken');
    assert.equal(readTraffic(root, '../wrong', '24h', start).state, 'unavailable');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

async function fixture(handler, exercise) {
  const server = http.createServer(handler);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const port = server.address().port;
    await exercise(port, 'http://127.0.0.1:' + port);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
}

test('real HTTP completion counts chunks and UTF-8 payload, not HEAD or 204 bytes', async () => {
  const hits = [];
  await fixture(
    (req, res) => {
      observeTrafficResponse(
        req,
        res,
        (row) => hits.push(row),
        () => start,
      );
      if (req.url === '/empty') {
        res.writeHead(204);
        res.end('not sent');
        return;
      }
      res.writeHead(201);
      res.write('ą');
      res.end(Buffer.from('test'));
    },
    async (_port, base) => {
      assert.equal(await (await fetch(base + '/hello?q=private')).text(), 'ątest');
      assert.equal(await (await fetch(base + '/head', { method: 'HEAD' })).text(), '');
      assert.equal((await fetch(base + '/empty')).status, 204);
    },
  );
  assert.deepEqual(hits, [
    { at: start, status: 201, bytes: 6, path: '/hello?q=private' },
    { at: start, status: 201, bytes: 0, path: '/head' },
    { at: start, status: 204, bytes: 0, path: '/empty' },
  ]);
});

test('native Node HTTP channel observes only the selected port and excludes readiness', async () => {
  const hits = [];
  await fixture(
    (_req, res) => res.end('node'),
    async (port, base) => {
      const unsubscribe = subscribeTrafficHttp(
        port,
        (row) => hits.push(row),
        () => start,
      );
      try {
        await (await fetch(base + '/__pockethost/ready')).text();
        await (await fetch(base + '/data')).text();
        await fixture(
          (_req, res) => res.end('foreign'),
          async (_other, url) => {
            await (await fetch(url)).text();
          },
        );
      } finally {
        unsubscribe();
      }
    },
  );
  assert.deepEqual(hits, [{ at: start, status: 200, bytes: 4, path: '/data' }]);
});
