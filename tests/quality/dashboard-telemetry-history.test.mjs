import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  DASHBOARD_MAX_POINTS, DashboardHistoryStore, validateDashboardPoint, observeDashboardTelemetry,
  parseDashboardHistoryRoute, parseDashboardBattery, probeDashboardDns,
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
    async () => ({ batteryPercent: null, batteryCharging: null, batteryTempC: null }),
    async () => ({ dnsMs: null, dnsFailed: null }),
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

test('bounded history endpoint route has no arbitrary targets, methods, or extra parameters', () => {
  assert.equal(parseDashboardHistoryRoute('/'), '1h');
  assert.equal(parseDashboardHistoryRoute('/?range=1h'), '1h');
  assert.equal(parseDashboardHistoryRoute('/?range=24h'), '24h');
  assert.equal(parseDashboardHistoryRoute('/?range=7d'), '7d');
  for (const target of ['/other', '/?range=8d', '/?range=1h&range=24h',
    '/?path=/etc/passwd', '/?range=24h&host=evil', '%%wrong']) {
    assert.equal(parseDashboardHistoryRoute(target), null);
  }
});

test('valid expired file can be discarded on startup without losing future collections', () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'pockethost-history-'));
  try {
    const file = path.join(dir, 'history.json');
    writeFileSync(file, JSON.stringify({ version: 1, points: [point(initial)] }));
    const today = initial + 3 * 86400000;
    const store = new DashboardHistoryStore(file, () => today);
    assert.equal(store.history().state, 'ok');
    assert.equal(store.history('24h').samples.length, 0);
    assert.equal(store.append(point(today)), true);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});


test('Termux battery parser admits only bounded real percent, charge status and temperature', () => {
  assert.deepEqual(parseDashboardBattery('{"percentage":82,"status":"CHARGING","temperature":32.4}'),
    { batteryPercent: 82, batteryCharging: true, batteryTempC: 32.4 });
  assert.deepEqual(parseDashboardBattery('{"percentage":45,"status":"DISCHARGING","temperature":180}'),
    { batteryPercent: 45, batteryCharging: false, batteryTempC: null });
  for (const raw of ['{}', 'not-json', '[]', '{"percentage":-3}', '{"percentage":"88"}']) {
    assert.equal(parseDashboardBattery(raw).batteryPercent, null);
  }
});

test('DNS measures valid response and reports failures without retaining an IP', async () => {
  let t = 100;
  assert.deepEqual(await probeDashboardDns(async () => '192.0.2.1', () => (t += 10)),
    { dnsMs: 10, dnsFailed: false });
  assert.deepEqual(await probeDashboardDns(async () => { throw Error('lookup refused'); }),
    { dnsMs: null, dnsFailed: true });
});

test('external service, TCP and DNS events persist across restarts, without granting ownership', () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'pockethost-history-'));
  try {
    const file = path.join(dir, 'history.json');
    writeFileSync(file, JSON.stringify({ version: 1, points: [point(initial - 60000, {
      serviceStates: { ssh: 'running' }, dnsMs: 20, dnsFailed: false,
    })] }));
    const store = new DashboardHistoryStore(file, () => initial);
    assert.equal(store.append(point(initial, {
      serviceStates: { ssh: 'stopped' }, dnsMs: null, dnsFailed: true,
      internetMs: null, internetFailed: true,
    })), true);
    store.flush();
    const loaded = new DashboardHistoryStore(file, () => initial);
    assert.deepEqual(loaded.history('24h').events.map(e => e.code).sort(),
      ['dns-down', 'internet-down', 'service-unavailable']);
    assert.equal(loaded.history('24h').events.find(e =>
      e.code === 'service-unavailable')?.service, 'ssh');
    assert.equal(loaded.append(point(initial + 60000, {
      serviceStates: { ssh: 'running' },
    })), true);
    assert.equal(loaded.history('24h').events.some(e => e.code === 'service-restored'), true);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('expired state-change events age out safely on restart', () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'pockethost-history-'));
  try {
    const file = path.join(dir, 'history.json');
    writeFileSync(file, JSON.stringify({
      version: 1, points: [point(initial)],
      events: [{ observedAt: new Date(initial).toISOString(), code: 'bridge-down', service: null }],
    }));
    const next = initial + 8 * 86400000;
    const store = new DashboardHistoryStore(file, () => next);
    assert.equal(store.history().state, 'ok');
    assert.equal(store.history().events.length, 0);
    assert.equal(store.append(point(next)), true);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('Android TrafficStats history keeps genuine zero, rejects invented/old counters and loads older files', () => {
  const time = initial;
  const at = new Date(time).toISOString();
  const network = { networkRxBytes: 0, networkTxBytes: 123, networkObservedAt: at };
  assert.equal(validateDashboardPoint(point(time, network), time), true);
  assert.equal(validateDashboardPoint(point(time), time), true, 'old files omit native network counters');
  for (const bad of [
    { ...network, networkRxBytes: -1 },
    { ...network, networkTxBytes: Number.MAX_SAFE_INTEGER + 1 },
    { ...network, networkObservedAt: '2020-01-01T00:00:00Z' },
    { ...network, networkObservedAt: null },
    { networkRxBytes: 1 },
  ]) assert.equal(validateDashboardPoint(point(time, bad), time), false);
});

test('7-day checkpoints and health thresholds persist without filling phone sleep gaps', () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'pockethost-history-'));
  try {
    let now = initial;
    const file = path.join(dir, 'history.json');
    const store = new DashboardHistoryStore(file, () => now);
    assert.equal(store.append(point(now, {
      batteryPercent: 50, batteryCharging: false, storageAvailableMiB: 900,
    })), true);
    now += 60000;
    assert.equal(store.append(point(now, {
      batteryPercent: 19, batteryCharging: false, storageAvailableMiB: 500,
    })), true);
    assert.deepEqual(store.history().events.map(e => e.code).sort(), ['battery-low','storage-low']);
    now += 60000;
    assert.equal(store.append(point(now, {
      batteryPercent: 27, batteryCharging: true, storageAvailableMiB: 850,
    })), true);
    for (let i = 1; i <= 72; i++) {
      now = initial + i * 3600000;
      assert.equal(store.append(point(now)), true);
    }
    assert.equal(store.history('24h').samples.every(p =>
      Date.parse(p.observedAt) >= now - 86400000), true);
    assert.equal(store.history('7d').samples.some(p =>
      Date.parse(p.observedAt) < now - 86400000), true);
    assert.equal(store.history('7d').events.some(e => e.code === 'battery-low'), true);
    store.flush();
    const restored = new DashboardHistoryStore(file, () => now);
    assert.deepEqual(restored.history('7d').samples, store.history('7d').samples);
    assert.deepEqual(restored.history('7d').events, store.history('7d').events);
    assert.equal(restored.history('7d').retentionHours, 168);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('collector and successful owned events are durable, bounded and never change services', () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'pockethost-history-'));
  try {
    const file = path.join(dir, 'history.json');
    const store = new DashboardHistoryStore(file, () => initial);
    assert.equal(store.recordEvent('collector-started'), true);
    assert.equal(store.recordEvent('owned-backup-created'), true);
    assert.equal(store.recordEvent('owned-release-published'), true);
    assert.equal(store.recordEvent('service-restored'), false);
    const loaded = new DashboardHistoryStore(file, () => initial);
    assert.deepEqual(loaded.history('24h').events.map(e => e.code),
      ['collector-started', 'owned-backup-created', 'owned-release-published']);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
