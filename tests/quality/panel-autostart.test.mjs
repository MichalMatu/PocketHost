import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const service = readFileSync(new URL('../../ops/termux/panel-service.sh', import.meta.url), 'utf8');
const installer = readFileSync(
  new URL('../../ops/termux/install-panel-services.sh', import.meta.url),
  'utf8',
);

test('panel runit service owns the loopback DEV panel without a second Node launcher', () => {
  assert.match(service, /exec "\$PREFIX\/bin\/node"/);
  assert.match(service, /--host 127\.0\.0\.1 --port 8787 --strictPort/);
  assert.match(service, /POCKETHOST_LAN_AUTOSTART=1/);
  assert.doesNotMatch(service, /--host 0\.0\.0\.0|--host ::/);
  assert.doesNotMatch(service, /pkill|killall|fuser/);
});

test('HTTP watchdog signals only the dedicated registered runit service', () => {
  assert.match(service, /PANEL="\$PREFIX\/var\/service\/pockethost-panel"/);
  assert.match(service, /--connect-timeout 2 --max-time 5/);
  assert.match(service, /http:\/\/127\.0\.0\.1:8787\/shizuku/);
  assert.match(service, /failures" -ge 3/);
  assert.match(service, /now - last_restart/);
  assert.match(service, /"\$SV" term "\$PANEL"/);
  assert.doesNotMatch(service, /kill\s|SIGKILL|sshd|cloudflared|mosquitto|wreckscanner/);
});

test('install is guarded, disabled before activation, and scoped to the two PocketHost services', () => {
  assert.match(installer, /stage\)/);
  assert.match(installer, /activate\)/);
  assert.match(installer, /: > "\$staging\/down"/);
  assert.match(installer, /already registered; refusing to replace a live service/);
  assert.match(installer, /ports_free \|\| fail/);
  assert.match(installer, /supervise\/ok/);
  assert.match(installer, /runit did not adopt/);
  assert.match(installer, /"\$PREFIX\/bin\/sv" status "\$dir"/);
  assert.match(installer, /SVDIR="\$SVDIR" "\$PREFIX\/bin\/sv-enable" pockethost-panel/);
  assert.match(installer, /SVDIR="\$SVDIR" "\$PREFIX\/bin\/sv-enable" pockethost-panel-watch/);
  assert.doesNotMatch(installer, /rm -rf|pkill|killall|0\.0\.0\.0/);
});


test('guarded runit deployment accepts only the exact supervised Node/Vite panel identity', async () => {
  const { assertPanelRunitIdentity } = await import('../../ops/termux/refresh-panel.mjs');
  const root = '/data/data/com.termux/files/home/Projects/PocketHost-MVP';
  const head = 'a'.repeat(40);
  const pid = 22800;
  const ticks = '12345678';
  const cwd = root + '/apps/admin';
  const manager = 'termux-runit/pockethost-panel';
  const owner = { pid, startTicks: ticks, cwd, sourceSha: head, managedBy: manager, port: 8787 };
  const gateway = {
    owner: 'PocketHost', pid, startTicks: ticks, cwd, sourceSha: head,
    managedBy: manager, adminPort: 18878, sitePort: 18879,
  };
  const argv = [
    '/data/data/com.termux/files/usr/bin/node',
    cwd + '/node_modules/vite/bin/vite.js',
    '--host', '127.0.0.1', '--port', '8787', '--strictPort',
  ];
  const e = { root, head, pid, ticks, cwd, owner, gateway, argv, servicePid: pid, processUid: 10520, expectedUid: 10520 };
  assert.equal(assertPanelRunitIdentity(e), true);
  for (const changed of [
    { servicePid: 99 },
    { ticks: '999' },
    { cwd: '/tmp/foreign' },
    { processUid: 0 },
    { argv: ['/data/data/com.termux/files/usr/bin/npm', 'dev'] },
    { owner: { ...owner, sourceSha: 'b'.repeat(40) } },
    { gateway: { ...gateway, managedBy: 'manual' } },
  ]) {
    assert.throws(() => assertPanelRunitIdentity({ ...e, ...changed }));
  }
});

test('panel refresh only signals its owned runit service and refuses foreign process adoption', () => {
  const rollout = readFileSync(new URL('../../ops/termux/refresh-panel.mjs', import.meta.url), 'utf8');
  assert.match(rollout, /inspect\(root, oldSha\)/);
  assert.match(rollout, /supervise\/pid/);
  assert.ok(rollout.includes("['down', service]"));
  assert.ok(rollout.includes("['up', service]"));
  assert.match(rollout, /rollback = 'PASS'/);
  assert.match(rollout, /FETCH_HEAD/);
  assert.doesNotMatch(rollout, /killall|pkill|SIGKILL|--force|0\.0\.0\.0/);
});

test('HMR drift is accepted only for verified ancestor UI and docs files', async () => {
  const { assertHmrOnlySourceDrift } = await import('../../ops/termux/refresh-panel.mjs');
  const markerSha = 'a'.repeat(40);
  const gatewaySha = markerSha;
  const checkoutSha = 'b'.repeat(40);
  const valid = { markerSha, gatewaySha, checkoutSha, ancestor: true, changedFiles: [
    'apps/admin/src/app/termux/system-page.tsx',
    'apps/admin/tests/system-dashboard.interaction.test.tsx',
    'docs/ARCHITECTURE.md',
  ] };
  assert.equal(assertHmrOnlySourceDrift(valid), markerSha);
  assert.equal(assertHmrOnlySourceDrift({ ...valid, checkoutSha: markerSha, changedFiles: [] }), markerSha);
  for (const change of [
    { gatewaySha: checkoutSha }, { markerSha: 'bad' },
    { ancestor: false }, { changedFiles: [] },
    { changedFiles: ['apps/admin/vite.config.ts'] },
    { changedFiles: ['src/modules/host/internet-connectivity.ts'] },
    { changedFiles: ['apps/admin/src/../../secrets'] },
  ]) assert.throws(() => assertHmrOnlySourceDrift({ ...valid, ...change }));
});
