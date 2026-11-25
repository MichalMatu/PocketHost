import assert from 'node:assert/strict';
import test from 'node:test';
import {
  TrafficHistory,
  TRAFFIC_HOURS,
  TRAFFIC_PATH_LIMIT,
  trafficPath,
} from '../../src/modules/host/traffic-history.mjs';

const start = Date.parse('2026-11-25T01:00:00Z');
const hour = 3600000;
const hit = (at = start, changes = {}) => ({
  at,
  status: 200,
  bytes: 12,
  path: '/index',
  ...changes,
});

test('HTTP totals, exact status codes, payload bytes and project-local RPS', () => {
  const a = new TrafficHistory(start);
  const b = new TrafficHistory(start);
  a.record(hit());
  a.record(hit(start + 1000, { status: 404, bytes: 0, path: '/missing?token=private' }));
  b.record(hit(start, { status: 201, bytes: 7 }));
  const result = a.summary(start + 1000);
  assert.equal(result.requests, 2);
  assert.equal(result.bytes, 12);
  assert.equal(result.rps, 2 / 60);
  assert.deepEqual(result.statuses, [
    [200, 1],
    [404, 1],
  ]);
  assert.deepEqual(result.topPaths, [
    ['/index', 1],
    ['/missing', 1],
  ]);
  assert.equal(b.summary(start + 1000).requests, 1);
  assert.equal(b.summary(start + 1000).rps, 1 / 60);
  assert.equal(a.summary(start + 61000).rps, 0);
});

test('bounded cardinality, no query or fragment, explicit omitted path count', () => {
  const history = new TrafficHistory(start);
  for (let i = 0; i < TRAFFIC_PATH_LIMIT + 12; i++)
    history.record(hit(start, { path: '/route/' + i + '?secret=1' }));
  history.record(hit(start, { path: '/' + 'a'.repeat(500) }));
  history.record(hit(start, { path: '/route/0#ignored' }));
  const result = history.summary(start);
  assert.equal(result.requests, TRAFFIC_PATH_LIMIT + 14);
  assert.equal(result.otherPaths, TRAFFIC_PATH_LIMIT + 2);
  assert.equal(history.snapshot(start).hours[0].paths.length, 12);
  assert.equal(JSON.stringify(history.snapshot(start)).includes('secret'), false);
  assert.equal(trafficPath('//example'), null);
  assert.equal(trafficPath('/a b'), null);
});

test('late frequent paths remain visible despite a high-cardinality prefix', () => {
  const history = new TrafficHistory(start);
  for (let i = 0; i < 128; i++) history.record(hit(start, { path: '/unique/' + i }));
  for (let i = 0; i < 150; i++) history.record(hit(start, { path: '/popular' }));
  const result = history.summary(start);
  assert.equal(result.requests, 278);
  assert.ok(result.topPaths[0][0] === '/popular' && result.topPaths[0][1] >= 146);
  assert.ok(history.snapshot(start).hours[0].paths.length <= TRAFFIC_PATH_LIMIT);
  assert.doesNotThrow(() => new TrafficHistory(start, history.snapshot(start)));
});

test('hourly retention is bounded and summaries use their declared UTC window', () => {
  const history = new TrafficHistory(start);
  for (let i = 0; i < TRAFFIC_HOURS + 12; i++) history.record(hit(start + i * hour));
  const now = start + (TRAFFIC_HOURS + 11) * hour;
  assert.equal(history.summary(now, '7d').requests, TRAFFIC_HOURS);
  assert.equal(history.summary(now, '24h').requests, 24);
  assert.equal(history.snapshot(now).hours.length, TRAFFIC_HOURS);
  assert.equal(history.summary(now + TRAFFIC_HOURS * hour, '7d').requests, 0);
});

test('validated restoration and independent snapshots', () => {
  const history = new TrafficHistory(start);
  history.record(hit());
  const snapshot = history.snapshot(start);
  const restored = new TrafficHistory(start + 1000, snapshot);
  snapshot.hours[0].paths[0][1] = 99;
  assert.equal(restored.summary(start + 1000).requests, 1);
  assert.equal(restored.summary(start + 1000).topPaths[0][1], 1);
  assert.equal(restored.summary(start + 1000).rps, 1 / 60);
  assert.throws(() => new TrafficHistory(start, snapshot), /Invalid traffic history/);
  assert.throws(() => new TrafficHistory(start, { schema: 1 }), /Invalid traffic history/);
});

test('invalid observations never generate fake traffic', () => {
  const history = new TrafficHistory(start);
  for (const input of [
    hit(start - 1),
    hit(start, { status: 999 }),
    hit(start, { bytes: -1 }),
    hit(start, { bytes: NaN }),
    hit(NaN),
  ])
    assert.equal(history.record(input), false);
  assert.equal(history.summary(start).requests, 0);
  assert.throws(() => history.summary(start, '30d'), /Unsupported traffic range/);
});
