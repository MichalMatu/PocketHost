import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCompanionStatus } from '../../src/modules/host/shizuku-companion.mjs';

const sample = () => ({
  version: 1,
  source: 'android-companion',
  connected: true,
  authorized: true,
  mode: 'adb',
  observedAt: new Date().toISOString(),
  cpuPercent: 31.7,
  visibleProcesses: 120,
  capabilities: [{ id: 'cpu', title: 'CPU', available: true, description: 'Shizuku sampling' }],
});
test('read-only native companion status preserves actual CPU observations', () => {
  assert.deepEqual(parseCompanionStatus(JSON.stringify(sample())), sample());
});
test('bridge rejects forged, stale and unprivileged measurements', () => {
  for (const item of [
    { ...sample(), observedAt: '2025-01-01T00:00:00Z' },
    { ...sample(), cpuPercent: 101 },
    { ...sample(), connected: true, authorized: false, cpuPercent: 50 },
    { ...sample(), mode: 'none' },
    { ...sample(), capabilities: 'yes' },
  ]) assert.throws(() => parseCompanionStatus(JSON.stringify(item)));
});
