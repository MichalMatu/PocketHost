import test from 'node:test';
import assert from 'node:assert/strict';
import { captureMobileNavigation } from '../../scripts/test-lab/mobile-navigation-capture.mjs';

function fakePage(initial = false, fail = false) {
  let open = initial;
  const events = [];
  const panel = {
    isVisible: async () => open,
    waitFor: async ({ state }) => {
      events.push('wait:' + state);
      assert.equal(open, state === 'visible');
    },
  };
  const page = {
    locator: (selector) => {
      if (selector === '[data-slot="sidebar"][data-mobile="true"]') return panel;
      assert.equal(selector, '[data-slot="sidebar-trigger"]');
      return { first: () => ({
        click: async () => { events.push('open'); open = true; },
      }) };
    },
    screenshot: async ({ path, animations }) => {
      assert.equal(path, 'menu.png');
      assert.equal(animations, 'disabled');
      assert.equal(open, true);
      events.push('shot');
      if (fail) throw Error('fake capture failed');
    },
    keyboard: { press: async (key) => {
      assert.equal(key, 'Escape');
      events.push('close');
      open = false;
    } },
  };
  return { page, events, isOpen: () => open };
}

test('mobile menu is opened, captured and closed', async () => {
  const f = fakePage();
  await captureMobileNavigation(f.page, 'menu.png');
  assert.deepEqual(f.events, ['open', 'wait:visible', 'shot', 'close', 'wait:hidden']);
  assert.equal(f.isOpen(), false);
});
test('existing mobile menu open state is preserved', async () => {
  const f = fakePage(true);
  await captureMobileNavigation(f.page, 'menu.png');
  assert.deepEqual(f.events, ['wait:visible', 'shot']);
  assert.equal(f.isOpen(), true);
});
test('mobile menu is closed even when the screenshot fails', async () => {
  const f = fakePage(false, true);
  await assert.rejects(captureMobileNavigation(f.page, 'menu.png'), /fake capture failed/);
  assert.deepEqual(f.events, ['open', 'wait:visible', 'shot', 'close', 'wait:hidden']);
  assert.equal(f.isOpen(), false);
});
