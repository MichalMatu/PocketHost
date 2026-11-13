import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertHmrOnlySourceDrift,
  summarizePreflight,
} from '../../ops/termux/refresh-panel.mjs';

const saved = 'a'.repeat(40);
const checkedOut = 'b'.repeat(40);

test('read-only preflight reports verified HMR-only SHA drift without deployment', () => {
  assert.equal(assertHmrOnlySourceDrift({
    markerSha: saved, gatewaySha: saved, checkoutSha: checkedOut,
    ancestor: true,
    changedFiles: ['apps/admin/src/app/termux/page.tsx',
      'apps/admin/tests/termux-center.interaction.test.tsx'],
  }), saved);
  assert.deepEqual(summarizePreflight({
    markerSha: saved, checkoutSha: checkedOut,
    panelHttpOk: true, protectedRunning: true,
  }), {
    status: 'READ_ONLY_READY', mode: 'read-only', ownedPanel: 'verified',
    markerSha: saved, checkoutSha: checkedOut,
    sourceDrift: 'verified-ui-hmr-only', panelHttp: 'reachable',
    protectedServices: 'running', deployment: 'not-performed',
    restart: 'not-performed', nextStep: 'operator-review-required',
  });
});

test('read-only preflight does not imply approval to deploy on missing HTTP or foreign services', () => {
  const summary = summarizePreflight({
    markerSha: saved, checkoutSha: saved,
    panelHttpOk: false, protectedRunning: true,
  });
  assert.equal(summary.status, 'HOLD');
  assert.equal(summary.sourceDrift, 'same');
  assert.equal(summary.restart, 'not-performed');
  assert.equal(summarizePreflight({
    markerSha: saved, checkoutSha: checkedOut,
    panelHttpOk: true, protectedRunning: false,
  }).status, 'HOLD');
});

test('invalid marker or non-UI drift cannot establish a valid preflight', () => {
  for (const data of [
    { markerSha: saved, gatewaySha: checkedOut, checkoutSha: checkedOut,
      ancestor: true, changedFiles: [] },
    { markerSha: saved, gatewaySha: saved, checkoutSha: checkedOut,
      ancestor: false, changedFiles: ['apps/admin/src/app/termux/page.tsx'] },
    { markerSha: saved, gatewaySha: saved, checkoutSha: checkedOut,
      ancestor: true, changedFiles: ['src/modules/host/control-plane-diagnostics.ts'] },
  ]) {
    assert.throws(() => assertHmrOnlySourceDrift(data));
  }
  assert.throws(() => summarizePreflight({
    markerSha: 'not a hash', checkoutSha: checkedOut,
    panelHttpOk: true, protectedRunning: true,
  }));
  assert.throws(() => summarizePreflight({
    markerSha: saved, checkoutSha: checkedOut,
    panelHttpOk: 'yes', protectedRunning: true,
  }));
});

test('owned panel evidence requires the canonical Vite argv, never substring matches', async () => {
  const { assertPanelRunitIdentity } =
    await import('../../ops/termux/refresh-panel.mjs');
  const root = '/data/data/com.termux/files/home/Projects/PocketHost-Preview';
  const cwd = root + '/apps/admin';
  const pid = 415;
  const ticks = '989898';
  const sha = 'c'.repeat(40);
  const expected = [
    '/data/data/com.termux/files/usr/bin/node',
    root + '/apps/admin/node_modules/vite/bin/vite.js',
    '--host', '127.0.0.1', '--port', '8787', '--strictPort',
  ];
  const evidence = {
    owner: { managedBy: 'termux-runit/pockethost-panel', pid, startTicks: ticks,
      cwd, sourceSha: sha, port: 8787 },
    gateway: { managedBy: 'termux-runit/pockethost-panel', owner: 'PocketHost',
      pid, startTicks: ticks, cwd, sourceSha: sha, adminPort: 18878, sitePort: 18879 },
    root, head: sha, pid, servicePid: pid, ticks, cwd,
    argv: expected, processUid: 1000, expectedUid: 1000,
  };
  assert.equal(assertPanelRunitIdentity(evidence), true);
  const variants = [
    [...expected, '--force'],
    [...expected.slice(0, 4), '--port', '9999', '--strictPort', '8787'],
    [expected[0], '/tmp/vite.js', ...expected.slice(2)],
    [expected[0], expected[1], '--host', '0.0.0.0', '--port', '8787', '--strictPort'],
    [expected[0], expected[1], '--port', '8787', '--host', '127.0.0.1', '--strictPort'],
  ];
  for (const argv of variants) {
    assert.throws(() => assertPanelRunitIdentity({ ...evidence, argv }),
      /Not the exact runit Node\/Vite command/);
  }
});
