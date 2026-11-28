#!/usr/bin/env node
// One-shot read-only geometry measurement. Existing screenshots remain local and are reused.
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { routePaths } from './artifact-names.mjs';
import { isRouteReady, routeTitles } from './route-readiness.mjs';
import { inspectCompositionGeometry } from './composition-geometry.mjs';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const screens = [
  ['mobile', 390, 844],
  ['tablet', 768, 1024],
  ['desktop', 1440, 900],
];

function options(argv) {
  const args = Object.create(null);
  for (const input of argv) {
    const match = /^--(base|sha|routes)=(.+)$/.exec(input);
    if (!match || Object.hasOwn(args, match[1])) throw Error('Invalid argument');
    args[match[1]] = match[2];
  }
  if (!/^[0-9a-f]{40}$/.test(args.sha || '')) throw Error('Exact source SHA required');
  const base = new URL(args.base);
  const octets = base.hostname.split('.').map(Number);
  const privateHost =
    base.hostname === 'localhost' ||
    (octets.length === 4 &&
      octets.every((n) => Number.isInteger(n) && n >= 0 && n <= 255) &&
      (octets[0] === 127 ||
        octets[0] === 10 ||
        (octets[0] === 192 && octets[1] === 168) ||
        (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31)));
  if (
    !privateHost ||
    base.protocol !== 'http:' ||
    base.username ||
    base.password ||
    base.pathname !== '/' ||
    base.search ||
    base.hash
  )
    throw Error('Private LAN origin required');
  const routes = (args.routes || '').split(',');
  if (
    routes.length > 12 ||
    new Set(routes).size !== routes.length ||
    routes.some((name) => !Object.hasOwn(routePaths, name))
  )
    throw Error('Route not allowlisted');
  return { origin: base.origin, sha: args.sha, routes };
}

async function main() {
  const config = options(process.argv.slice(2));
  const { chromium } = await import('playwright-core');
  const browser = await chromium.launch({
    executablePath:
      process.env.POCKETHOST_LAB_CHROME ||
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
  });
  const views = [];
  try {
    const context = await browser.newContext({
      deviceScaleFactor: 1,
      serviceWorkers: 'block',
      acceptDownloads: false,
    });
    await context.route('**/*', (route) => {
      const request = route.request();
      if (!['GET', 'HEAD'].includes(request.method())) return route.abort();
      const address = request.url();
      if (address.startsWith('data:') || address.startsWith('blob:')) return route.continue();
      try {
        return new URL(address).origin === config.origin ? route.continue() : route.abort();
      } catch {
        return route.abort();
      }
    });
    const page = await context.newPage();
    let first = true;
    for (const name of config.routes) {
      const destination = config.origin + routePaths[name];
      const expected = { path: routePaths[name], title: routeTitles[name] ?? null };
      await page.setViewportSize({ width: 1440, height: 900 });
      let available = false;
      try {
        if (first) {
          await page.goto(destination, { waitUntil: 'commit', timeout: 18000 });
        } else {
          try {
            await page
              .locator('a[href="' + routePaths[name] + '"]')
              .first()
              .click({ timeout: 5000 });
            await page.waitForURL(destination, { timeout: 12000 });
          } catch {
            await page.goto(destination, { waitUntil: 'commit', timeout: 18000 });
          }
        }
        await page.waitForFunction(isRouteReady, expected, { timeout: 15000 });
        await page.waitForTimeout(1200);
        available = true;
      } catch {
        // Mark the route unavailable; never publish raw browser errors.
      }
      for (const [viewport, width, height] of screens) {
        let geometry = null;
        if (available) {
          try {
            await page.setViewportSize({ width, height });
            await page.waitForTimeout(450);
            await page.evaluate(() => globalThis.window.scrollTo(0, 0));
            if (await page.evaluate(isRouteReady, expected))
              geometry = await page.evaluate(inspectCompositionGeometry);
          } catch {
            // A missing observation is not a successful measurement.
          }
        }
        views.push({ route: name, viewport, geometry });
      }
      first = false;
    }
    await context.close();
  } finally {
    await browser.close();
  }
  const folder = join(repo, '.test-lab', Date.now() + '-composition-' + config.sha.slice(0, 8));
  await mkdir(folder, { recursive: true, mode: 0o700 });
  await writeFile(
    join(folder, 'composition.json'),
    JSON.stringify({ sourceSha: config.sha, views }, null, 2),
    { mode: 0o600 },
  );
  process.stdout.write(
    JSON.stringify({
      kind: 'PocketHostCompositionGeometry',
      sourceSha: config.sha,
      readOnly: true,
      observed: views.filter((v) => v.geometry !== null).length,
      expected: config.routes.length * screens.length,
      localFolder: folder,
    }) + '\n',
  );
}
main().catch(() => {
  process.stderr.write('PocketHost composition measurement unavailable\n');
  process.exitCode = 1;
});
