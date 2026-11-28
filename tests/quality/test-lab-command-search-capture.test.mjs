import test from 'node:test';
import assert from 'node:assert/strict';
import { captureCommandSearch } from '../../scripts/test-lab/command-search-capture.mjs';

function fakePage(initial = false, fail = false) {
  let open = initial;
  const events = [];
  const geometry = { width: 320, height: 400, inputHeight: 30, inViewport: true };
  const dialog = {
    filter: ({ has }) => {
      assert.equal(has, 'input');
      return dialog;
    },
    isVisible: async () => open,
    waitFor: async ({ state }) => {
      events.push(state);
      assert.equal(open, state === 'visible');
    },
    evaluate: async () => {
      assert.equal(open, true);
      return geometry;
    },
    screenshot: async ({ path, animations }) => {
      assert.equal(open, true);
      assert.equal(path, 'search.png');
      assert.equal(animations, 'disabled');
      events.push('shot');
      if (fail) throw Error('capture failed');
    },
  };
  return {
    events,
    geometry,
    page: {
      locator: (selector) => {
        if (selector === '[data-slot="command-input"]') return 'input';
        assert.equal(selector, '[data-slot="dialog-content"]');
        return dialog;
      },
      getByRole: (role, options) => {
        assert.equal(role, 'button');
        assert.deepEqual(options, { name: 'Search...', exact: true });
        return {
          click: async () => {
            open = true;
            events.push('open');
          },
        };
      },
      keyboard: {
        press: async (key) => {
          assert.equal(key, 'Escape');
          open = false;
          events.push('close');
        },
      },
    },
  };
}

test('command search capture opens and restores the dialog without selection', async () => {
  const f = fakePage();
  assert.deepEqual(await captureCommandSearch(f.page, 'search.png'), f.geometry);
  assert.deepEqual(f.events, ['open', 'visible', 'shot', 'close', 'hidden']);
});

test('command search preserves an existing open dialog', async () => {
  const f = fakePage(true);
  await captureCommandSearch(f.page, 'search.png');
  assert.deepEqual(f.events, ['visible', 'shot']);
});

test('command search restores the dialog after screenshot failure', async () => {
  const f = fakePage(false, true);
  await assert.rejects(captureCommandSearch(f.page, 'search.png'), /capture failed/);
  assert.deepEqual(f.events, ['open', 'visible', 'shot', 'close', 'hidden']);
});
