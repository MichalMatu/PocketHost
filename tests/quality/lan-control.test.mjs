import assert from 'node:assert/strict';
import test from 'node:test';
import {
  availableLanInterfaces,
  createLanControl,
  createLanRecovery,
} from '../../src/modules/host/lan-control.mjs';

test('LAN interface selector excludes public, loopback, IPv6 and orders eligible addresses', () => {
  assert.deepEqual(
    availableLanInterfaces({
      wlan0: [{ family: 'IPv4', internal: false, address: '192.168.0.100' }],
      rmnet: [{ family: 'IPv4', internal: false, address: '8.8.8.8' }],
      lo: [{ family: 'IPv4', internal: true, address: '127.0.0.1' }],
      test: [{ family: 'IPv6', internal: false, address: 'fe80::1' }],
      vpn: [{ family: 'IPv4', internal: false, address: '10.0.0.2' }],
    }),
    [
      { name: 'vpn', address: '10.0.0.2' },
      { name: 'wlan0', address: '192.168.0.100' },
    ],
  );
});

test('LAN controller opts in only to exact own private address and manages own gateway', async () => {
  const calls = [];
  const control = createLanControl({
    interfaces: () => [{ name: 'wlan0', address: '192.168.0.100' }],
    start: async (bind) => {
      calls.push('start:' + bind);
      return {
        close: async () => {
          calls.push('close');
        },
      };
    },
  });
  assert.equal(control.status().enabled, false);
  assert.equal(control.status().mode, 'manual');
  await assert.rejects(control.enable('0.0.0.0'), /invalid-lan-interface/);
  await assert.rejects(control.enable('192.168.0.2'), /invalid-lan-interface/);
  assert.equal(control.status().enabled, false);
  const running = await control.enable('192.168.0.100');
  assert.equal(running.enabled, true);
  assert.equal(running.adminUrl, 'http://192.168.0.100:18878/');
  assert.equal(running.siteUrl, 'http://192.168.0.100:18879/');
  await control.enable('192.168.0.100');
  assert.deepEqual(calls, ['start:192.168.0.100']);
  await assert.rejects(control.enable('10.0.0.1'), /invalid-lan-interface/);
  assert.equal((await control.disable()).enabled, false);
  assert.deepEqual(calls, ['start:192.168.0.100', 'close']);
  await control.disable();
  assert.deepEqual(calls, ['start:192.168.0.100', 'close']);
});

test('LAN controller does not take over ports from a preexisting gateway', async () => {
  const control = createLanControl({
    interfaces: () => [{ name: 'wlan0', address: '192.168.0.100' }],
    start: async () => {
      throw Object.assign(new Error('used'), { code: 'EADDRINUSE' });
    },
  });
  await assert.rejects(control.enable('192.168.0.100'), /used/);
  assert.equal(control.status().enabled, false);
  assert.equal(control.status().bind, null);
  assert.equal((await control.disable()).enabled, false);
});

test('LAN controller rejects overlapping starts without signal or process discovery', async () => {
  let proceed;
  const control = createLanControl({
    interfaces: () => [{ name: 'wlan0', address: '192.168.0.100' }],
    start: () =>
      new Promise((resolve) => {
        proceed = resolve;
      }),
  });
  const started = control.enable('192.168.0.100');
  await assert.rejects(control.enable('192.168.0.100'), /busy/);
  await assert.rejects(control.disable(), /busy/);
  proceed({ close: async () => undefined });
  await started;
  await control.disable();
});

test('owner-selected auto mode is reported while preserving exact interface ownership', async () => {
  const control = createLanControl({
    mode: 'auto',
    interfaces: () => [{ name: 'wlan0', address: '192.168.0.100' }],
    start: async (bind) => ({ bind, close: async () => undefined }),
  });
  assert.equal(control.status().mode, 'auto');
  await control.enable('192.168.0.100');
  assert.equal(control.status().enabled, true);
  assert.equal((await control.disable()).enabled, false);
});

test('auto LAN recovers an owned stale listener after two failures only', async () => {
  const calls = [];
  const interfaces = () => [{ name: 'wlan0', address: '192.168.0.100' }];
  const control = createLanControl({
    mode: 'auto',
    interfaces,
    start: async (bind) => {
      calls.push('start:' + bind);
      return {
        close: async () => {
          calls.push('close');
        },
      };
    },
  });
  await control.enable('192.168.0.100');
  let healthy = false;
  const recover = createLanRecovery({
    controller: control,
    interfaces,
    check: async (bind) => {
      assert.equal(bind, '192.168.0.100');
      return healthy;
    },
  });
  await recover();
  assert.deepEqual(calls, ['start:192.168.0.100']);
  await recover();
  assert.deepEqual(calls, ['start:192.168.0.100', 'close', 'start:192.168.0.100']);
  healthy = true;
  await recover();
  await recover();
  assert.equal(calls.filter((x) => x === 'close').length, 1);
  assert.equal(control.status().enabled, true);
});

test('auto LAN recovery respects manual disable and a lost private interface', async () => {
  const calls = [];
  let present = true;
  const interfaces = () => (present ? [{ name: 'wlan0', address: '192.168.0.100' }] : []);
  const control = createLanControl({
    mode: 'auto',
    interfaces,
    start: async (bind) => {
      calls.push('start:' + bind);
      return {
        close: async () => {
          calls.push('close');
        },
      };
    },
  });
  const recover = createLanRecovery({ controller: control, interfaces, check: async () => false });
  await control.enable('192.168.0.100');
  present = false;
  await recover();
  await recover();
  // The old address is released after two checks, ready to rebind if Wi-Fi IP changes.
  assert.deepEqual(calls, ['start:192.168.0.100', 'close']);
  present = true;
  await control.disable();
  await recover();
  await recover();
  assert.deepEqual(calls, ['start:192.168.0.100', 'close']);
});

test('LAN recovery rate-limits repeated outages and reports degraded health', async () => {
  const calls = [];
  let time = 100000;
  let healthy = false;
  const interfaces = () => [{ name: 'wlan0', address: '192.168.0.100' }];
  const controller = createLanControl({
    interfaces,
    start: async (bind) => {
      calls.push('start:' + bind);
      return {
        close: async () => {
          calls.push('close');
        },
      };
    },
  });
  await controller.enable('192.168.0.100');
  const recover = createLanRecovery({
    controller,
    interfaces,
    check: async () => healthy,
    now: () => time,
    cooldownMs: 30000,
    maxCooldownMs: 120000,
  });
  await recover();
  assert.equal(recover.health().state, 'unhealthy');
  await recover();
  assert.equal(recover.health().state, 'recovering');
  assert.equal(recover.health().recoveryCount, 1);
  await recover();
  await recover();
  assert.equal(calls.filter((item) => item === 'close').length, 1);
  time += 30001;
  await recover();
  assert.equal(recover.health().recoveryCount, 2);
  assert.equal(calls.filter((item) => item === 'close').length, 2);
  healthy = true;
  await recover();
  assert.equal(recover.health().state, 'healthy');
  assert.equal(recover.health().nextRecoveryAt, null);
  assert.equal(recover.health().lastError, null);
});

test('LAN recovery releases only stale owned bind after two missing-interface checks', async () => {
  const calls = [];
  let available = [{ name: 'wlan0', address: '192.168.0.100' }];
  let ownerDisabled = false;
  const interfaces = () => available;
  const controller = createLanControl({
    interfaces,
    start: async (bind) => {
      calls.push('start:' + bind);
      return {
        close: async () => {
          calls.push('close');
        },
      };
    },
  });
  await controller.enable('192.168.0.100');
  const recover = createLanRecovery({
    controller,
    interfaces,
    check: async () => true,
    canRecover: () => !ownerDisabled,
  });
  available = [{ name: 'wlan0', address: '192.168.0.101' }];
  await recover();
  assert.equal(recover.health().state, 'interface-missing');
  assert.equal(controller.status().enabled, true);
  await recover();
  assert.deepEqual(calls, ['start:192.168.0.100', 'close']);
  assert.equal(controller.status().enabled, false);
  await controller.enable('192.168.0.101');
  ownerDisabled = true;
  await recover();
  assert.equal(recover.health().state, 'paused');
  assert.deepEqual(calls, ['start:192.168.0.100', 'close', 'start:192.168.0.101']);
});
