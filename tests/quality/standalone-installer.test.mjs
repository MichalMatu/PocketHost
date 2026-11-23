import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const installer = readFileSync(new URL('../../install.sh', import.meta.url), 'utf8');
const bootstrap = readFileSync(
  new URL('../../ops/termux/cold-bootstrap-standalone.mjs', import.meta.url),
  'utf8',
);
const owner = readFileSync(new URL('../../ops/termux/panel-owner.mjs', import.meta.url), 'utf8');
const readme = readFileSync(new URL('../../README.md', import.meta.url), 'utf8');

test('clean install checks Termux identity and existing ownership before modifying packages', () => {
  assert.match(installer, /EXPECTED_PREFIX='\/data\/data\/com\.termux\/files\/usr'/);
  assert.match(installer, /EXPECTED_HOME='\/data\/data\/com\.termux\/files\/home'/);
  assert.match(installer, /do not install as root/);
  for (const item of [
    'pockethost-panel',
    'pockethost-panel-watch',
    'panel-owner.json',
    'lan-gateway.json',
  ]) {
    assert.ok(
      installer.indexOf(item) > 0 && installer.indexOf(item) < installer.indexOf('pkg install -y'),
    );
  }
  assert.match(installer, /checkout exists; refusing to overwrite or upgrade/);
  assert.doesNotMatch(installer, /rm -rf|killall|pkill|sudo |0\.0\.0\.0:/);
});

test('clean install pins repo origin, npm lockfiles and only PocketHost runit services', () => {
  assert.match(installer, /github\.com\/MichalMatu\/PocketHost\.git/);
  assert.match(installer, /pkg install -y git curl nodejs python termux-services/);
  assert.equal((installer.match(/npm ci --ignore-scripts/g) || []).length, 2);
  assert.match(installer, /cold-bootstrap-standalone\.mjs/);
  assert.match(installer, /existing enabled\/unknown services/);
  assert.match(bootstrap, /PocketHost-Standalone/);
  assert.match(bootstrap, /standalone-cold-staged/);
  assert.match(bootstrap, /protected-services-changed/);
  assert.match(owner, /standalone-cold-staged/);
  assert.match(owner, /a8-cold-staged/);
});

test('README starts with a real one-line installer and states scope clearly', () => {
  assert.ok(readme.indexOf('## Install on a fresh Termux device') < readme.indexOf('## Features'));
  assert.match(readme, /raw\.githubusercontent\.com\/MichalMatu\/PocketHost\/main\/install\.sh/);
  assert.match(readme, /Fresh-install only/);
  assert.match(readme, /docs\/INSTALLATION\.md/);
});
