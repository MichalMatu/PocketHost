import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyUiChanges, isSafeUiPath, isPocketHostOrigin, procStartTicks } from '../../scripts/dev/ui-sync-policy.mjs';

test('accept only UI assets, tests and documents for unattended HMR', () => {
  assert.equal(classifyUiChanges([
    'apps/admin/src/app/termux/system-page.tsx',
    'apps/admin/src/config/navigation.ts',
    'apps/admin/tests/system-dashboard.interaction.test.tsx',
    'docs/DEV_ITERATION.md',
  ]).allowed, true);
  for (const file of [
    'apps/admin/vite.config.ts', 'src/modules/host/lan-gateway.mjs',
    'package.json', 'scripts/dev/ui-sync.mjs', '.github/workflows/release.yml',
    'apps/admin/src/../vite.config.ts', '/etc/passwd', 'apps/admin/src\\bad.ts',
  ]) {
    assert.equal(isSafeUiPath(file), false, file);
  }
});

test('reject suspicious remote URLs and accept canonical GitHub remotes only', () => {
  assert.equal(isPocketHostOrigin('https://github.com/MichalMatu/PocketHost.git'), true);
  assert.equal(isPocketHostOrigin('git@github.com:MichalMatu/PocketHost.git'), true);
  assert.equal(isPocketHostOrigin('https://github.com/attacker/PocketHost'), false);
  assert.equal(isPocketHostOrigin('https://github.com/MichalMatu/PocketHost.evil'), false);
});

test('read PID start ticks without assuming the process comm lacks parentheses', () => {
  const before = ['S', ...Array.from({ length: 18 }, (_, i) => String(i + 1)), '123456'];
  const fake = '234 (node app) special) ' + before.join(' ');
  assert.equal(procStartTicks(fake), '123456');
  assert.equal(procStartTicks('bad'), null);
});
