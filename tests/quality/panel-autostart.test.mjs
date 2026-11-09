import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const service = readFileSync(new URL('../../ops/termux/panel-service.sh', import.meta.url), 'utf8');
const installer = readFileSync(new URL('../../ops/termux/install-panel-services.sh', import.meta.url), 'utf8');

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
  assert.match(installer, /SVDIR="\$SVDIR" "\$PREFIX\/bin\/sv-enable" pockethost-panel/);
  assert.match(installer, /SVDIR="\$SVDIR" "\$PREFIX\/bin\/sv-enable" pockethost-panel-watch/);
  assert.doesNotMatch(installer, /rm -rf|pkill|killall|0\.0\.0\.0/);
});
