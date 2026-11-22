import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const routes = readFileSync(path.join(root, 'apps/admin/src/config/routes.tsx'), 'utf8');
const html = readFileSync(path.join(root, 'apps/admin/index.html'), 'utf8');
const navigation = readFileSync(path.join(root, 'apps/admin/src/config/navigation.ts'), 'utf8');
const viteConfig = readFileSync(path.join(root, 'apps/admin/vite.config.ts'), 'utf8');
const terminalPanel = readFileSync(
  path.join(root, 'apps/admin/src/app/termux/terminal-panel.tsx'),
  'utf8',
);

const productPaths = [
  '/', '/dashboard', '/host', '/observability', '/shizuku', '/phone-settings',
  '/termux', '/system', '/packages', '/files', '/services', '/services/runit',
  '/services/autostart', '/services/hosting', '/services/health',
  '/services/cloudflare', '/services/ssh', '/services/mqtt', '/services/:serviceId',
  '/local-agent', '/backups', '/terminal', '/agents', '/owned-site',
  '/hosting', '/sites', '/deployments', '/projects', '/runtime-logs',
  '/settings/network', '/settings/platform', '/settings/appearance', '*',
];

const retiredPaths = [
  '/landing', '/examples/dashboard', '/dashboard-2', '/mail', '/tasks',
  '/chat', '/calendar', '/users', '/faqs', '/pricing',
  '/auth/sign-in', '/auth/sign-in-2', '/auth/sign-in-3',
  '/auth/sign-up', '/auth/sign-up-2', '/auth/sign-up-3',
  '/auth/forgot-password', '/auth/forgot-password-2', '/auth/forgot-password-3',
  '/errors/unauthorized', '/errors/forbidden', '/errors/not-found',
  '/errors/internal-server-error', '/errors/under-maintenance',
  '/settings/user', '/settings/account', '/settings/billing',
  '/settings/notifications', '/settings/connections',
];

test('PocketHost routes remain complete after removing upstream examples', () => {
  const allPaths = [...routes.matchAll(/\\bpath:\\s*"([^"]+)"/g)].map((m) => m[1]);
  assert.equal(new Set(allPaths).size, allPaths.length);
  for (const required of productPaths) {
    assert.ok(allPaths.includes(required), 'missing PocketHost path: ' + required);
  }
  for (const retired of retiredPaths) {
    assert.ok(!allPaths.includes(retired), 'upstream example still registered: ' + retired);
  }
  const chunks = [...routes.matchAll(/import\\("@\\/app\\/([^"]+)"\\)/g)].map((m) => m[1]);
  for (const page of chunks) {
    assert.ok(
      existsSync(path.join(root, 'apps/admin/src/app', page + '.tsx')),
      'missing lazy page: ' + page,
    );
  }
  assert.ok(existsSync(path.join(root, 'apps/admin/LICENSE.upstream.md')));
});


test('desktop-first index preserves native pinch zoom on Android Chrome', () => {
  const match = html.match(/<meta\s+name="viewport"\s+content="([^"]+)"/);
  assert.ok(match, 'viewport tag absent');
  assert.match(match[1], /width=device-width/);
  assert.doesNotMatch(match[1], /user-scalable\s*=\s*no/i);
  assert.doesNotMatch(match[1], /maximum-scale\s*=\s*1(?:\.0)?(?:,|$)/i);
});

test('Services menu uses one generic registry without duplicated hosted-app navigation', () => {
  const labels = [...navigation.matchAll(/label: "([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(labels, [
    'Overview', 'Hosting', 'Services', 'Local Agent',
    'System & Tools', 'Automation', 'Settings',
  ]);
  assert.equal(labels.filter((name) => name === 'Services').length, 1);
  const services =
    navigation.split('label: "Services",')[1]?.split('label: "System & Tools",')[0] ?? '';
  for (const dest of [
    '/services',
    '/services/runit',
    '/services/autostart',
    '/services/hosting',
    '/services/health',
  ]) {
    assert.equal(services.split('url: "' + dest + '"').length - 1, 1, dest);
    assert.ok(routes.includes('path: "' + dest + '"'), 'missing route: ' + dest);
  }
  assert.match(services, /serviceWorkspaces\.filter/);
  const catalog = readFileSync(
    path.join(root, 'apps/admin/src/config/service-workspaces.ts'),
    'utf8',
  );
  for (const dest of ['/local-agent', '/services/cloudflare', '/services/ssh', '/services/mqtt']) {
    assert.equal(catalog.split('url: "' + dest + '"').length - 1, 1, dest);
  }
  assert.match(routes, /path: "\/services\/:serviceId"/);
  for (const id of ['cloudflare', 'ssh', 'mqtt']) {
    assert.ok(routes.includes('path: "/services/' + id + '"'));
  }
  assert.match(navigation, /url: "\/settings\/network"/);
});

test('PocketHost dashboard is home without any sample dashboard route', () => {
  assert.match(routes, /path: "\\/", element: <Navigate to="\\/dashboard" replace \\/>/);
  assert.match(routes, /path: "\\/system", element: <Navigate to="\\/dashboard" replace \\/>/);
  assert.match(
    routes,
    /path: "\\/dashboard", lazy: page\\(\\(\\) => import\\("@\\/app\\/termux\\/system-page"\\)\\)/,
  );
  assert.match(navigation, /title: "Dashboard", url: "\\/dashboard"/);
  assert.doesNotMatch(routes, /examples\\/dashboard/);
  assert.doesNotMatch(navigation, /Framework \\/ CMS examples/);
});

test('terminal React route does not get shadowed by ttyd reverse proxy', () => {
  assert.match(routes, /path: "\/terminal", lazy:/);
  assert.match(viteConfig, /"\/terminal\/"\s*:\s*\{\s*target: "http:\/\/127\.0\.0\.1:18798"/);
  assert.doesNotMatch(viteConfig, /"\/terminal"\s*:/);
  assert.match(terminalPanel, /src="\/terminal\/" /);
});
