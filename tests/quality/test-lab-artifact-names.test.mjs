import test from 'node:test';
import assert from 'node:assert/strict';
import { screenshotName, isAllowedScreenshotName } from '../../scripts/test-lab/artifact-names.mjs';

test('Test Lab permits exact top/middle/bottom viewport screenshots for known routes only', () => {
  for (const route of [
    'dashboard',
    'hosting',
    'sites',
    'projects',
    'deployments',
    'logs',
    'services',
    'agent',
    'network',
  ]) {
    for (const viewport of ['mobile', 'tablet', 'desktop']) {
      const top = screenshotName(route, viewport);
      const middle = screenshotName(route, viewport, 'middle');
      const bottom = screenshotName(route, viewport, 'bottom');
      assert.equal(top, route + '-' + viewport + '.png');
      assert.equal(middle, route + '-' + viewport + '-middle.png');
      assert.equal(bottom, route + '-' + viewport + '-bottom.png');
      assert.equal(isAllowedScreenshotName(top), true);
      assert.equal(isAllowedScreenshotName(middle), true);
      assert.equal(isAllowedScreenshotName(bottom), true);
    }
  }
  for (const viewport of ['mobile', 'tablet', 'desktop']) {
    const create = screenshotName('projects', viewport, 'create-panel');
    assert.equal(create, 'projects-' + viewport + '-create-panel.png');
    assert.equal(isAllowedScreenshotName(create), true);
  }
});

test('Test Lab never accepts path escape or arbitrary screenshot selection', () => {
  for (const value of [
    '../network-mobile.png',
    'network-mobile.png/../../x',
    'network-mobile-bottom.jpg',
    'network-mobile-bottom-bottom.png',
    'network-mobile-middle-middle.png',
    'network-mobile-center.png',
    'network-mobile-create-panel.png',
    'projects-wide-create-panel.png',
    'projects-mobile-create-panel.jpg',
    'projects-mobile-create-panel.png/../x',
    'unknown-mobile.png',
    'dashboard-wide.png',
    '/dashboard-mobile.png',
    'dashboard-mobile.png?token=secret',
    '',
  ]) {
    assert.equal(isAllowedScreenshotName(value), false, value);
  }
  assert.equal(isAllowedScreenshotName(null), false);
  assert.throws(() => screenshotName('../dashboard', 'mobile'));
  assert.throws(() => screenshotName('dashboard', 'wide'));
  assert.throws(() => screenshotName('dashboard', 'mobile', 'full'));
  assert.throws(() => screenshotName('dashboard', 'mobile', 'center'));
  assert.throws(() => screenshotName('dashboard', 'mobile', 'create-panel'));
});
