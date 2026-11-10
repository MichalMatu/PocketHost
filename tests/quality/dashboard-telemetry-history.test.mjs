import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  DASHBOARD_MAX_POINTS, DashboardHistoryStore, validateDashboardPoint, observeDashboardTelemetry,
} from '../../src/modules/host/dashboard-telemetry-history.ts';

const initial = Date.parse('2026-11-10T12:00:00.000Z');
const point = (timestamp = initial, changes = {}) => ({
  observedAt: new Date(timestamp).toISOString(),
  cpu: 24, ram: 55.2, internetMs: 25.6, internetFailed: false,
  bridgeMs: 19, bridgeOnline: true, servicesRunning: 6, servicesTotal: 6,
  storageAvailableMiB: 1000, systemUptimeSeconds: 1200, ...changes,
});

test('validated points preserve missing measurements and reject fabricated, future, or unknown fields', () => {
  assert.equal(validateDashboardPoint(point(), initial), true);
  assert.equal(validateDashboardPoint(point(initial, { cpu: null, ram: null, bridgeMs: null }), initial), true);
  for (const changed of [
    { internetFailed: true, internetMs: 2 }, { cpu: 101 }, { ram: -1 },
    { observedAt: 'not-a-time' }, { observedAt: new Date(initial + 120000).toISOString() },
    { servicesRunning: 9, servicesTotal: 6 }, { secret: 'do-not-persist' },
  ]) assert.equal(validateDashboardPoint(point(initial, changed), initial), false);
});

test('durable owned buffer survives recreation, serves 1h / 24h and refuses stale samples', () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'pockethost-history-'));
  try {
    const file = path.join(dir, 'history.json');
    let now = initial;
    const s = new DashboardHistoryStore(file, () => now);
    assert.equal(s.append(point(now - 2 * 60 * 60 * 1000)), true);
    now += 1000;
    assert.equal(s.append(point(now)), true);
    s.flush();
    const second = new DashboardHistoryStore(file, () => now);
    assert.equal(second.history('24h').samples.length, 2);
    assert.equal(second.history('1h').samples.length, 1);
    assert.equal(second.history().source, 'pockethost-collector');
    assert.equal(second.append(point(now - 60000)), false);
    now += 25 * 60 * 60 * 1000;
    assert.equal(second.history('24h').samples.length, 0);
    assert.equal(second.append(point(now)), true);
    assert.equal(second.history('24h').samples.length, 1);
    assert.equal(readFileSync(file, 'utf8').includes('secret'), false);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('history is bounded to 1440 points and rejects duplicate/reordered sampling', () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'pockethost-history-'));
  try {
    const file = path.join(dir, 'history.json');
    const end = initial + 25 * 60 * 60 * 1000;
    const store = new DashboardHistoryStore(file, () => end);
    for (let i = 0; i < DASHBOARD_MAX_POINTS + 10; i++) {
      const when = end - (DASHBOARD_MAX_POINTS + 10 - i - 1) * 60000;
      store.append(point(when));
    }
    assert.equal(store.history('24h').samples.length, DASHBOARD_MAX_POINTS);
    assert.equal(store.append(point(end)), false);
    store.flush();
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('symlinks and corrupt or oversized state fail closed and never overwrite owned data', () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'pockethost-history-'));
  try {
    const target = path.join(dir, 'target.json');
    writeFileSync(target, '{"sensitive":"untouched"}');
    const link = path.join(dir, 'symlink.json');
    symlinkSync(target, link);
    for (const filename of [link, target]) {
      const s = new DashboardHistoryStore(filename, () => initial);
      assert.equal(s.history().state, 'unavailable');
      assert.equal(s.append(point()), false);
    }
    assert.equal(readFileSync(target, 'utf8'), '{"sensitive":"untouched"}');
    const oversized = path.join(dir, 'oversized.json');
    writeFileSync(oversized, 'x'.repeat(1024 * 1024 + 1));
    assert.equal(new DashboardHistoryStore(oversized, () => initial).history().state, 'unavailable');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('native failures remain null; no autonomous privilege or foreign-service actions', async () => {
  const fakeHost = () => ({
    runtime: { totalMemoryMiB: 1000, freeMemoryMiB: 200,
      storage: { totalMiB: 5000, availableMiB: 900 }, systemUptimeSeconds: 80 },
    services: [
      { id: 'ilestoi', ownership: 'external', state: 'running' },
      { id: 'ssh', ownership: 'external', state: 'unknown' },
    ],
  });
  const result = await observeDashboardTelemetry(
    fakeHost, async () => { throw Error('denied'); },
    async () => ({ state: 'unreachable', latencyMs: null }),
    () => initial,
  );
  assert.equal(result.cpu, null);
  assert.equal(result.ram, 80);
  assert.equal(result.internetMs, null);
  assert.equal(result.internetFailed, true);
  assert.equal(result.bridgeOnline, null);
  assert.equal(result.servicesRunning, 1);
  assert.equal(result.servicesTotal, 2);
  assert.equal(validateDashboardPoint(result, initial), true);
});
