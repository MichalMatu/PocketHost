import test from 'node:test';
import assert from 'node:assert/strict';
import { isRouteReady } from '../../scripts/test-lab/route-readiness.mjs';

function pageState(
  pathname,
  { loading = false, sidebar = true, root = true, title = 'Projects' } = {},
) {
  const doc = {
    querySelector(selector) {
      if (selector === '[role="progressbar"][aria-label="Loading page"]')
        return loading ? {} : null;
      if (selector === '[data-slot="sidebar-wrapper"]') return sidebar ? {} : null;
      if (selector === '#root')
        return root ? { textContent: 'PocketHost management content loaded' } : null;
      if (selector === 'h1') return title === null ? null : { textContent: title };
      return null;
    },
  };
  return { doc, win: { location: { pathname } } };
}

test('Test Lab only accepts the selected completed route, not stale SPA content', () => {
  const expected = { path: '/projects', title: 'Projects' };
  assert.equal(isRouteReady(expected, pageState('/sites')), false);
  assert.equal(isRouteReady(expected, pageState('/projects', { loading: true })), false);
  assert.equal(isRouteReady(expected, pageState('/projects', { title: 'Sites' })), false);
  assert.equal(isRouteReady(expected, pageState('/projects', { sidebar: false })), false);
  assert.equal(isRouteReady(expected, pageState('/projects', { root: false })), false);
  assert.equal(isRouteReady(expected, pageState('/projects')), true);
});

test('Test Lab handles basename paths for routes without hardcoded headings', () => {
  assert.equal(
    isRouteReady(
      { path: '/settings/appearance' },
      pageState('/pockethost/settings/appearance', { title: null }),
    ),
    true,
  );
  assert.equal(
    isRouteReady({ path: '/settings/appearance' }, pageState('/settings/network', { title: null })),
    false,
  );
  assert.equal(
    isRouteReady({ path: '/projects' }, pageState('/myprojects', { title: null })),
    false,
  );
  assert.equal(isRouteReady(null, pageState('/projects')), false);
});
