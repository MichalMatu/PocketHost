import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const routes = readFileSync(path.join(root, 'apps/admin/src/config/routes.tsx'), 'utf8');
const html = readFileSync(path.join(root, 'apps/admin/index.html'), 'utf8');
const navigation = readFileSync(path.join(root, 'apps/admin/src/config/navigation.ts'), 'utf8');

const originalPaths = [
  '/',
  '/landing',
  '/dashboard',
  '/dashboard-2',
  '/mail',
  '/tasks',
  '/chat',
  '/calendar',
  '/users',
  '/faqs',
  '/pricing',
  '/auth/sign-in',
  '/auth/sign-in-2',
  '/auth/sign-in-3',
  '/auth/sign-up',
  '/auth/sign-up-2',
  '/auth/sign-up-3',
  '/auth/forgot-password',
  '/auth/forgot-password-2',
  '/auth/forgot-password-3',
  '/errors/unauthorized',
  '/errors/forbidden',
  '/errors/not-found',
  '/errors/internal-server-error',
  '/errors/under-maintenance',
  '/settings/user',
  '/settings/account',
  '/settings/billing',
  '/settings/appearance',
  '/settings/notifications',
  '/settings/connections',
  '*',
];

test('full 32-route upstream admin shell remains available beside seventeen PocketHost routes', () => {
  const allPaths = [...routes.matchAll(/\bpath:\s*"([^"]+)"/g)].map((m) => m[1]);
  assert.equal(allPaths.length, originalPaths.length + 18);
  assert.equal(new Set(allPaths).size, allPaths.length);
  for (const original of originalPaths) {
    assert.ok(allPaths.includes(original), 'missing upstream path: ' + original);
  }
  assert.ok(allPaths.includes('/examples/dashboard'));
  assert.ok(allPaths.includes('/host'));
  assert.ok(allPaths.includes('/observability'));
  assert.ok(allPaths.includes('/shizuku'));
  assert.ok(allPaths.includes('/termux'));
  for (const route of [
    '/system',
    '/packages',
    '/files',
    '/services',
    '/backups',
    '/terminal',
    '/agents',
  ]) {
    assert.ok(allPaths.includes(route), 'missing first-class Termux module: ' + route);
  }
  assert.ok(allPaths.includes('/settings/network'));
  assert.ok(allPaths.includes('/owned-site'));
  assert.ok(allPaths.includes('/sites'));
  assert.ok(allPaths.includes('/managed-projects'));
  assert.ok(allPaths.includes('/deployments'));
  assert.ok(allPaths.includes('/runtime-logs'));
  const chunks = [...routes.matchAll(/import\("@\/app\/([^"]+)"\)/g)].map((m) => m[1]);
  assert.equal(chunks.length, originalPaths.length + 15);
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

test('M0 keeps observed external services in System, not the Hosting project catalog', () => {
  const systemGroup = navigation.split('label: "System",')[1]?.split('label: "Hosting",')[0] ?? '';
  const hostingGroup =
    navigation.split('label: "Hosting",')[1]?.split('label: "Automation",')[0] ?? '';
  assert.match(systemGroup, /url: "\/host"/);
  assert.doesNotMatch(hostingGroup, /url: "\/host"/);
  assert.match(hostingGroup, /url: "\/sites"/);
  assert.match(hostingGroup, /url: "\/deployments"/);
  assert.doesNotMatch(hostingGroup, /url: "\/owned-site"|url: "\/managed-projects"/);
  assert.doesNotMatch(hostingGroup, /url: "\/settings\/network"/);
  const platformGroup =
    navigation.split('label: "Platform",')[1]?.split('label: "Examples",')[0] ?? '';
  assert.match(platformGroup, /url: "\/settings\/network"/);
  assert.match(routes, /path: "\/host"/);
});

test('PocketHost dashboard is home and upstream charts stay available under examples', () => {
  assert.match(routes, /path: "\/", element: <Navigate to="\/dashboard" replace \/>/);
  assert.match(routes, /path: "\/system", element: <Navigate to="\/dashboard" replace \/>/);
  assert.match(routes, /path: "\/dashboard", lazy: page\(\(\) => import\("@\/app\/termux\/system-page"\)\)/);
  assert.match(routes, /path: "\/examples\/dashboard", lazy: page\(\(\) => import\("@\/app\/dashboard\/page"\)\)/);
  assert.match(navigation, /title: "Dashboard", url: "\/dashboard"/);
  assert.match(navigation, /title: "Framework dashboard", url: "\/examples\/dashboard"/);
});
