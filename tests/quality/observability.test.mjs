import assert from 'node:assert/strict';
import test from 'node:test';
import {
  cpuPercentage,
  parseProcessStat,
  parseProcessRss,
  readBatteryPercent,
  parseTermuxBatteryPercent,
  readNetworkBytes,
  readProcessInventory,
  parseInstalledPackages,
  parseNpmGlobals,
  parsePipInstalled,
  readPackageInventory,
} from '../../src/modules/host/observability-probes.ts';
import {
  ObservabilityHistory,
  sameProcessIdentity,
  sanitizeEvents,
} from '../../src/modules/observability/overview.ts';

const time = '2026-11-07T03:00:00.000Z';
const stat = (pid, ppid, ticks = '420') =>
  `${pid} (safe (nested) name) S ${ppid} ${Array.from({ length: 18 }, (_, i) =>
    i === 9 ? '100' : i === 10 ? '50' : i === 17 ? ticks : '0',
  ).join(' ')} 0 0`;

test('CPU delta reports actual utilization and refuses non-monotonic data', () => {
  const a = [{ times: { user: 10, nice: 0, sys: 0, idle: 90, irq: 0 } }];
  const b = [{ times: { user: 50, nice: 0, sys: 0, idle: 150, irq: 0 } }];
  assert.equal(cpuPercentage(a, b), 40);
  assert.equal(cpuPercentage(b, a), null);
  assert.equal(cpuPercentage([], []), null);
});
test('Android battery and network restrictions are explicit, not zeros', () => {
  assert.deepEqual(
    readBatteryPercent(() => '65', time),
    { state: 'ok', value: 65, observedAt: time },
  );
  assert.equal(
    readBatteryPercent(() => {
      throw { code: 'EACCES' };
    }, time).state,
    'permission-denied',
  );
  assert.equal(readBatteryPercent(() => 'unknown', time).value, null);
  const raw = 'Inter-| Receive\n face |bytes\n wlan0: 123 0 0 0 0 0 0 0 456 0 0 0 0 0 0 0';
  assert.deepEqual(readNetworkBytes(() => raw, time).value, { rxBytes: 123, txBytes: 456 });
  assert.equal(
    readNetworkBytes(() => {
      throw { code: 'EPERM' };
    }, time).state,
    'permission-denied',
  );
});
test('Termux:API battery fallback accepts only a numeric 0–100 percentage', () => {
  assert.deepEqual(
    parseTermuxBatteryPercent('{"percentage":88,"status":"CHARGING"}', time),
    { state: 'ok', value: 88, observedAt: time },
  );
  for (const raw of ['not json', '{}', '{"percentage":"88"}',
    '{"percentage":-1}', '{"percentage":101}', '{"percentage":12.5}', '[]']) {
    assert.deepEqual(
      parseTermuxBatteryPercent(raw, time),
      { state: 'unavailable', value: null, observedAt: time },
    );
  }
});
test('process stat identity requires exact PID/start ticks and hides argv/comm', () => {
  const parsed = parseProcessStat(stat(41, 1), 41);
  assert.equal(parsed?.pid, 41);
  assert.equal(parsed?.ppid, 1);
  assert.equal(parsed?.startTicks, '420');
  assert.equal(parsed?.cpuTicks, 150);
  assert.equal(parseProcessStat(stat(41, 1), 42), null);
  assert.equal(parseProcessRss('Name: hidden\nVmRSS: 2048 kB\n'), 2);
  assert.equal(
    sameProcessIdentity({ pid: 41, startTicks: '420' }, { pid: 41, startTicks: '421' }),
    false,
  );
});
test('partial process view marks only own process as self, never grants foreign ownership', () => {
  const files = new Map([
    ['/proc/41/stat', stat(41, 1)],
    ['/proc/42/stat', stat(42, 41)],
    ['/proc/41/status', 'VmRSS: 2048 kB'],
    ['/proc/42/status', 'VmRSS: 1024 kB'],
  ]);
  const read = (p) => {
    if (!files.has(p)) throw { code: 'EACCES' };
    return files.get(p);
  };
  const result = readProcessInventory(() => ['41', '42', 'not-a-pid'], read, time, 42);
  assert.equal(result.state, 'ok');
  assert.equal(result.partial, true);
  assert.deepEqual(
    result.processes.map((p) => p.ownership),
    ['unverified', 'self'],
  );
  assert.equal(JSON.stringify(result).includes('nested'), false);
  assert.equal(
    readProcessInventory(
      () => {
        throw { code: 'EPERM' };
      },
      read,
      time,
    ).state,
    'permission-denied',
  );
});
test('package inventory uses fixed commands, marks update cache as unverified', () => {
  assert.equal(parseInstalledPackages('safe\t1.2.3\n../evil\t1.0\n').length, 1);
  const calls = [];
  const data = readPackageInventory((binary, args) => {
    calls.push([binary, args]);
    if (binary.endsWith('dpkg-query')) return 'curl\t8.0\n';
    if (binary.endsWith('/apt')) return 'Listing...\ncurl/stable 8.1 arm64 [upgradable from: 8.0]';
    if (binary.endsWith('/npm')) return '10.9.0';
    if (binary.endsWith('/python3')) return 'Python 3.12.2';
    return null;
  }, time);
  assert.equal(
    data.installed.some((p) => p.name === 'curl'),
    true,
  );
  assert.equal(data.updates.state, 'cached-unverified');
  assert.deepEqual(data.updates.candidates, ['curl']);
  assert.ok(
    calls.every(
      ([bin, args]) =>
        bin.startsWith('/data/data/com.termux/files/usr/bin/') && !args.includes('upgrade'),
    ),
  );
});
test('aggregation retains only bounded history, synthetic values never replace unavailable', () => {
  const h = new ObservabilityHistory();
  const sample = {
    version: 1,
    mode: 'read-only',
    observedAt: time,
    host: { runtime: { totalMemoryMiB: 100, freeMemoryMiB: 40, storage: null }, services: [] },
    metrics: {
      cpuPercent: { state: 'unavailable', value: null, observedAt: time },
      batteryPercent: { state: 'unavailable', value: null, observedAt: time },
      network: { state: 'unavailable', value: null, observedAt: time },
    },
    processes: {
      state: 'unavailable',
      observedAt: time,
      partial: true,
      truncated: false,
      processes: [],
    },
    packages: {
      state: 'unavailable',
      observedAt: time,
      installed: [],
      truncated: false,
      updates: { state: 'unknown', candidates: [] },
    },
    diagnostics: { state: 'unavailable', events: [] },
  };
  for (let i = 0; i < 60; i++) h.append(sample);
  const value = h.append(sample);
  assert.equal(value.history.length, 36);
  assert.equal(value.history[0].cpuPercent, null);
  assert.equal(value.alerts.includes('CPU metric unavailable'), true);
  assert.deepEqual(
    sanitizeEvents([
      {
        timestamp: time,
        instanceId: 'owned-demo',
        code: 'manual-stop-completed',
        secret: 'DO_NOT_LEAK',
      },
    ]),
    [{ timestamp: time, instanceId: 'owned-demo', code: 'manual-stop-completed' }],
  );
});

test('Node global and Python pip inventories admit only structured safe metadata', () => {
  assert.deepEqual(
    parseNpmGlobals(
      JSON.stringify({
        dependencies: {
          typescript: { version: '5.9.3' },
          '@scope/tool': { version: '1.2.0' },
          '../../token': { version: 'bad' },
        },
      }),
    ).map((p) => p.name),
    ['typescript', '@scope/tool'],
  );
  assert.deepEqual(
    parsePipInstalled(
      JSON.stringify([
        { name: 'requests', version: '2.32.0' },
        { name: '../../../secret', version: '1.0' },
      ]),
    ).map((p) => p.name),
    ['requests'],
  );
  assert.deepEqual(parsePipInstalled('invalid json'), []);
  assert.deepEqual(parseNpmGlobals('invalid json'), []);
});
