#!/usr/bin/env node
// Read-only PocketHost Test Lab: private Chrome captures and allowlisted GET status probes.
import { mkdir, writeFile, chmod } from 'node:fs/promises';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { screenshotName, routePaths } from './artifact-names.mjs';
import { scrollCaptureTargets } from './scroll-capture-targets.mjs';
import { inspectPageGeometry } from './layout-geometry.mjs';
import { captureWarnings, summarizeCaptureWarnings } from './capture-warnings.mjs';
import { isRouteReady } from './route-readiness.mjs';
import { captureMobileNavigation } from './mobile-navigation-capture.mjs';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const routes = routePaths;
const apis = {
  host: '/api/v1/host/snapshot',
  network: '/api/v1/network-access',
  sites: '/api/v1/sites',
  projects: '/api/v1/node-projects',
};
const screens = [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1440, height: 900 },
];

function options(argv) {
  const args = Object.create(null);
  for (const input of argv) {
    const match = /^--(base|sha|routes|api|mobile-menu)=(.+)$/.exec(input);
    if (!match || Object.hasOwn(args, match[1])) throw Error('Invalid argument');
    args[match[1]] = match[2];
  }
  if (!/^[0-9a-f]{40}$/.test(args.sha || '')) throw Error('Exact approved SHA required');
  if (args['mobile-menu'] && args['mobile-menu'] !== 'true')
    throw Error('Mobile menu option must be true');
  let base;
  try {
    base = new URL(args.base);
  } catch {
    throw Error('Invalid base URL');
  }
  if (
    base.protocol !== 'http:' ||
    base.username ||
    base.password ||
    base.pathname !== '/' ||
    base.hash ||
    base.search
  )
    throw Error('Only bare HTTP LAN origin allowed');
  const host = base.hostname,
    numbers = host.split('.');
  const ipv4 =
    numbers.length === 4 && numbers.every((n) => /^\d{1,3}$/.test(n) && Number(n) <= 255);
  const n = numbers.map(Number);
  const privateHost =
    host === 'localhost' ||
    (ipv4 &&
      (n[0] === 127 ||
        n[0] === 10 ||
        (n[0] === 192 && n[1] === 168) ||
        (n[0] === 172 && n[1] >= 16 && n[1] <= 31)));
  if (!privateHost) throw Error('Public origin denied');
  const select = (raw, allowed) => {
    const list = raw.split(',');
    if (
      list.length > 12 ||
      new Set(list).size !== list.length ||
      list.some((name) => !Object.hasOwn(allowed, name))
    )
      throw Error('Selection not allowlisted');
    return list;
  };
  return {
    origin: base.origin,
    sha: args.sha,
    pages: select(args.routes || 'dashboard,hosting,projects', routes),
    probes: args.api ? select(args.api, apis) : [],
    mobileMenu: args['mobile-menu'] === 'true',
  };
}

const escapeHtml = (text) =>
  String(text).replace(
    /[&<>"']/g,
    (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch],
  );

async function geometry(page) {
  return page.evaluate(inspectPageGeometry);
}

async function probe(request, origin, name) {
  const start = Date.now();
  try {
    const response = await request.get(origin + apis[name], {
      timeout: 8000,
      maxRedirects: 0,
      headers: { Accept: 'application/json' },
    });
    const mime = String(response.headers()['content-type'] ?? '')
      .split(';')[0]
      .slice(0, 60);
    let jsonValid = false,
      shapeOK = false;
    try {
      const bytes = await response.body();
      if (bytes.length <= 128 * 1024 && mime === 'application/json') {
        const data = JSON.parse(bytes.toString('utf8'));
        jsonValid = data !== null && typeof data === 'object' && !Array.isArray(data);
        if (jsonValid) {
          if (name === 'host')
            shapeOK =
              data.version === 1 &&
              data.mode === 'read-only' &&
              data.platform === 'termux' &&
              !!data.runtime &&
              typeof data.runtime === 'object' &&
              Array.isArray(data.services);
          else if (name === 'network')
            shapeOK =
              data.version === 1 &&
              typeof data.enabled === 'boolean' &&
              Array.isArray(data.interfaces);
          else shapeOK = true;
        }
      }
    } catch {
      /* Invalid JSON never leaks body text or raw parse errors. */
    }
    return { name, status: response.status(), ms: Date.now() - start, mime, jsonValid, shapeOK };
  } catch {
    return { name, status: null, ms: Date.now() - start, error: 'GET unavailable' };
  }
}

function gallery(report) {
  const cards = report.captures
    .map((c) => {
      const label = c.route + ' · ' + c.viewport;
      const warnings = captureWarnings(c);
      const stats =
        (c.navigationMode === 'spa' ? 'SPA route' : 'HTTP ' + c.status) +
        ', overflow ' +
        (c.geometry?.horizontalOverflow ?? '?') +
        'px, unlabeled controls ' +
        (c.geometry?.unlabeledControls ?? '?') +
        ', JS errors ' +
        c.jsErrors;
      return (
        '<article><h2>' +
        escapeHtml(label) +
        '</h2><p>' +
        escapeHtml(stats) +
        '</p>' +
        (warnings.length
          ? '<p>Capture incomplete: ' + escapeHtml(warnings.join('; ')) + '</p>'
          : '') +
        (c.file
          ? '<a href="' +
            escapeHtml(c.file) +
            '"><img src="' +
            escapeHtml(c.file) +
            '" loading="lazy"/></a>'
          : '') +
        (c.middleFile
          ? '<p>Middle viewport · same route</p><a href="' +
            escapeHtml(c.middleFile) +
            '"><img src="' +
            escapeHtml(c.middleFile) +
            '" loading="lazy"/></a>'
          : '') +
        (c.bottomFile
          ? '<p>Bottom viewport · same route</p><a href="' +
            escapeHtml(c.bottomFile) +
            '"><img src="' +
            escapeHtml(c.bottomFile) +
            '" loading="lazy"/></a>'
          : '') +
        (c.mobileMenuFile
          ? '<p>Mobile navigation · UI only</p><a href="' +
            escapeHtml(c.mobileMenuFile) +
            '"><img src="' +
            escapeHtml(c.mobileMenuFile) +
            '" loading="lazy"/></a>'
          : '') +
        (c.createPanelFile
          ? '<p>Node create panel · UI only, no submission</p><a href="' +
            escapeHtml(c.createPanelFile) +
            '"><img src="' +
            escapeHtml(c.createPanelFile) +
            '" loading="lazy"/></a>'
          : '') +
        '</article>'
      );
    })
    .join('\n');
  return (
    '<!doctype html><html lang="en"><meta charset="utf-8"><title>PocketHost Test Lab</title>' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<style>body{font:15px system-ui;background:#101827;color:#f1f5f9;margin:24px}' +
    'main{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:20px}' +
    'article{padding:16px;background:#263344;border-radius:12px;min-width:0}' +
    'img{max-width:100%;border:1px solid #789}p{color:#cbd5e1}</style>' +
    '<h1>PocketHost Test Lab — local only</h1><main>' +
    cards +
    '</main></html>'
  );
}

async function main() {
  const config = options(process.argv.slice(2));
  let chromium;
  try {
    ({ chromium } = await import('playwright-core'));
  } catch {
    throw Error('Browser dependency not installed');
  }
  const chrome =
    process.env.POCKETHOST_LAB_CHROME ||
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  const folder = join(repo, '.test-lab', Date.now().toString() + '-' + config.sha.slice(0, 8));
  await mkdir(folder, { recursive: true, mode: 0o700 });
  await chmod(folder, 0o700);
  const browser = await chromium.launch({ executablePath: chrome, headless: true });
  const captures = [],
    api = [];
  try {
    // Keep one isolated browser context and load each page once. Vite's DEV
    // module graph is expensive on an A8; repeated reloads can overwhelm it.
    const ctx = await browser.newContext({
      viewport: { width: screens[0].width, height: screens[0].height },
      deviceScaleFactor: 1,
      serviceWorkers: 'block',
      acceptDownloads: false,
    });
    await ctx.route('**/*', (route) => {
      const request = route.request();
      // Abort all browser-originated mutations, including initialization.
      if (!['GET', 'HEAD'].includes(request.method())) return route.abort();
      const address = request.url();
      if (address.startsWith('data:') || address.startsWith('blob:')) return route.continue();
      let target;
      try {
        target = new URL(address);
      } catch {
        return route.abort();
      }
      return target.origin === config.origin ? route.continue() : route.abort();
    });
    const page = await ctx.newPage();
    let jsErrors = 0,
      consoleErrors = 0,
      failedRequests = 0,
      blockedRequests = 0;
    let canceledRequests = 0;
    page.on('pageerror', () => {
      jsErrors++;
    });
    page.on('console', (e) => {
      if (e.type() === 'error') consoleErrors++;
    });
    page.on('requestfailed', (request) => {
      // Cross-origin and mutating traffic is intentionally denied by this Lab.
      let external = true;
      try {
        external = new URL(request.url()).origin !== config.origin;
      } catch {
        /* unknown URI */
      }
      if (external || !['GET', 'HEAD'].includes(request.method())) blockedRequests++;
      else if (/ABORTED|CANCELLED|CANCELED/i.test(String(request.failure()?.errorText ?? ''))) {
        canceledRequests++;
      } else failedRequests++;
    });
    const titles = { dashboard: 'Dashboard', hosting: 'Hosting', projects: 'Projects' };

    let first = true;
    for (const route of config.pages) {
      const destination = config.origin + routes[route];
      const expectedRoute = { path: routes[route], title: titles[route] ?? null };
      await page.setViewportSize({ width: 1440, height: 900 });
      let status = null,
        navigationError = null;
      let navigationMode = first ? 'document' : 'spa';
      let previousJs = jsErrors,
        previousConsole = consoleErrors;
      let previousFailed = failedRequests,
        previousBlocked = blockedRequests;
      let previousCanceled = canceledRequests;
      try {
        if (first) {
          const response = await page.goto(destination, {
            waitUntil: 'commit',
            timeout: 18000,
          });
          status = response?.status() ?? null;
        } else {
          try {
            await page
              .locator('a[href="' + routes[route] + '"]')
              .first()
              .click({ timeout: 5000 });
            await page.waitForURL(destination, { timeout: 12000 });
          } catch {
            navigationMode = 'document-fallback';
            const response = await page.goto(destination, {
              waitUntil: 'commit',
              timeout: 18000,
            });
            status = response?.status() ?? null;
          }
        }
        try {
          await page.waitForFunction(isRouteReady, expectedRoute, { timeout: 15000 });
          await page.waitForTimeout(1200);
        } catch {
          navigationError = 'React route not confirmed';
        }
      } catch {
        navigationError = 'Navigation unavailable';
      }
      for (const vp of screens) {
        const cap = {
          route,
          viewport: vp.name,
          status,
          navigationMode,
          geometry: null,
          jsErrors: 0,
          consoleErrors: 0,
          failedRequests: 0,
          blockedRequests: 0,
          canceledRequests: 0,
          file: null,
          rendered: false,
          stage: 'viewport',
        };
        try {
          await page.setViewportSize({ width: vp.width, height: vp.height });
          await page.waitForTimeout(450);
          cap.rendered = await page.evaluate(isRouteReady, expectedRoute);
          // Always start each viewport at the top, including after SPA navigation.
          await page.evaluate(() => globalThis.window.scrollTo({ top: 0, behavior: 'instant' }));
          if (cap.rendered) cap.geometry = await geometry(page);
          const scrollTargets = scrollCaptureTargets(cap.geometry?.documentHeight, vp.height);
          cap.stage = 'screenshot';
          const filename = screenshotName(route, vp.name);
          const absolute = join(folder, filename);
          await page.screenshot({ path: absolute, animations: 'disabled', timeout: 12000 });
          await chmod(absolute, 0o600);
          cap.file = filename;
          // Cap tall pages to three local viewport screenshots; never full-page
          // capture. This adds a mid-page observation without clicking or writes.
          if (cap.rendered && scrollTargets.middle !== null) {
            try {
              await page.evaluate(
                (top) => globalThis.window.scrollTo({ top, behavior: 'instant' }),
                scrollTargets.middle,
              );
              await page.waitForTimeout(250);
              const at = await page.evaluate(() => globalThis.window.scrollY);
              if (at < Math.max(1, scrollTargets.middle * 0.7))
                throw Error('Middle scroll did not advance');
              cap.middleScrollY = Math.round(at);
              const middle = screenshotName(route, vp.name, 'middle');
              const middlePath = join(folder, middle);
              await page.screenshot({ path: middlePath, animations: 'disabled', timeout: 12000 });
              await chmod(middlePath, 0o600);
              cap.middleFile = middle;
            } catch {
              cap.middleError = 'Middle viewport screenshot unavailable';
            } finally {
              await page
                .evaluate(() => globalThis.window.scrollTo({ top: 0, behavior: 'instant' }))
                .catch(() => {});
            }
          }
          // A second viewport covers content below the fold without changing
          // the read-only route scope or capturing an unbounded full-page image.
          if (cap.rendered && scrollTargets.bottom !== null) {
            try {
              await page.evaluate(
                (top) => globalThis.window.scrollTo({ top, behavior: 'instant' }),
                scrollTargets.bottom,
              );
              await page.waitForTimeout(250);
              const at = await page.evaluate(() => globalThis.window.scrollY);
              if (at < Math.max(1, scrollTargets.bottom * 0.7))
                throw Error('Bottom scroll did not advance');
              cap.bottomScrollY = Math.round(at);
              const bottom = screenshotName(route, vp.name, 'bottom');
              const bottomPath = join(folder, bottom);
              await page.screenshot({ path: bottomPath, animations: 'disabled', timeout: 12000 });
              await chmod(bottomPath, 0o600);
              cap.bottomFile = bottom;
            } catch {
              cap.bottomError = 'Bottom viewport screenshot unavailable';
            } finally {
              await page
                .evaluate(() => globalThis.window.scrollTo({ top: 0, behavior: 'instant' }))
                .catch(() => {});
            }
          }
          // Opt-in: capture the mobile drawer; no POST, screenshot stays local.
          if (config.mobileMenu && vp.name === 'mobile' && cap.rendered) {
            try {
              const menuFile = screenshotName(route, vp.name, 'menu');
              const menuPath = join(folder, menuFile);
              await captureMobileNavigation(page, menuPath);
              await chmod(menuPath, 0o600);
              cap.mobileMenuFile = menuFile;
            } catch {
              cap.mobileMenuError = 'Mobile navigation screenshot unavailable';
            } finally {
              await page
                .evaluate(() => globalThis.window.scrollTo({ top: 0, behavior: 'instant' }))
                .catch(() => {});
            }
          }
          // Whitelisted click-only UI inspection: expand one local details
          // element and screenshot that element. Network mutations remain blocked.
          if (route === 'projects' && cap.rendered) {
            const panel = page.locator('details[data-testid="node-create-panel"]');
            let originallyOpen = false;
            let panelFound = false;
            try {
              if ((await panel.count()) !== 1) throw Error('Missing Node create panel');
              panelFound = true;
              originallyOpen = await panel.evaluate((element) => element.open);
              if (!originallyOpen) await panel.locator('summary').click({ timeout: 5000 });
              if (!(await panel.evaluate((element) => element.open)))
                throw Error('Node create panel did not expand');
              const createFile = screenshotName(route, vp.name, 'create-panel');
              const createPath = join(folder, createFile);
              // Keep the additional capture bounded to the viewport, not the
              // potentially unbounded height of the details element itself.
              await panel.scrollIntoViewIfNeeded({ timeout: 5000 });
              await page.screenshot({ path: createPath, animations: 'disabled', timeout: 12000 });
              await chmod(createPath, 0o600);
              cap.createPanelFile = createFile;
            } catch {
              cap.createPanelError = 'Node create panel capture unavailable';
            } finally {
              if (panelFound && !originallyOpen)
                await panel
                  .evaluate((element) => {
                    element.open = false;
                  })
                  .catch(() => {});
              await page
                .evaluate(() => globalThis.window.scrollTo({ top: 0, behavior: 'instant' }))
                .catch(() => {});
            }
          }
          cap.stage = 'complete';
          if (!cap.rendered) cap.error = navigationError ?? 'React content not confirmed';
        } catch {
          cap.error =
            cap.stage === 'viewport'
              ? 'Viewport or layout inspection unavailable'
              : 'Screenshot unavailable';
        }
        cap.jsErrors = jsErrors - previousJs;
        cap.consoleErrors = consoleErrors - previousConsole;
        cap.failedRequests = failedRequests - previousFailed;
        cap.blockedRequests = blockedRequests - previousBlocked;
        cap.canceledRequests = canceledRequests - previousCanceled;
        previousJs = jsErrors;
        previousConsole = consoleErrors;
        previousFailed = failedRequests;
        previousBlocked = blockedRequests;
        previousCanceled = canceledRequests;
        captures.push(cap);
      }
      first = false;
    }
    await page.close();
    for (const name of config.probes) api.push(await probe(ctx.request, config.origin, name));
    await ctx.close();
  } finally {
    await browser.close();
  }
  const captureSummary = summarizeCaptureWarnings(captures);
  const report = {
    kind: 'PocketHostTestLab',
    sourceSha: config.sha,
    origin: config.origin,
    mode: 'read-only',
    at: new Date().toISOString(),
    captures,
    captureSummary,
    api,
  };
  const reportName = join(folder, 'report.json'),
    galleryName = join(folder, 'index.html');
  await writeFile(reportName, JSON.stringify(report, null, 2), { mode: 0o600 });
  await writeFile(galleryName, gallery(report), { mode: 0o600 });
  await chmod(reportName, 0o600);
  await chmod(galleryName, 0o600);
  process.stdout.write(
    JSON.stringify({
      kind: report.kind,
      status: 'OBSERVED',
      sourceSha: config.sha,
      readOnly: true,
      screenshots: captures.reduce(
        (sum, c) =>
          sum +
          Number(Boolean(c.file)) +
          Number(Boolean(c.middleFile)) +
          Number(Boolean(c.bottomFile)) +
          Number(Boolean(c.createPanelFile)) +
          Number(Boolean(c.mobileMenuFile)),
        0,
      ),
      middleScreenshots: captures.filter((c) => c.middleFile).length,
      bottomScreenshots: captures.filter((c) => c.bottomFile).length,
      createPanelScreenshots: captures.filter((c) => c.createPanelFile).length,
      mobileMenuScreenshots: captures.filter((c) => c.mobileMenuFile).length,
      failures: captures.filter((c) => c.error).length,
      ...captureSummary,
      notRendered: captures.filter((c) => !c.rendered).length,
      overflowing: captures.filter((c) => c.rendered && (c.geometry?.horizontalOverflow || 0) > 0)
        .length,
      overflowCases: captures.filter((c) => (c.geometry?.horizontalOverflow || 0) > 0).length,
      unlabeledCases: captures.filter((c) => c.rendered && (c.geometry?.unlabeledControls || 0) > 0)
        .length,
      jsErrors: captures.reduce((sum, c) => sum + c.jsErrors, 0),
      failedRequests: captures.reduce((sum, c) => sum + c.failedRequests, 0),
      blockedRequests: captures.reduce((sum, c) => sum + c.blockedRequests, 0),
      canceledRequests: captures.reduce((sum, c) => sum + c.canceledRequests, 0),
      api,
      localFolder: folder,
    }) + '\n',
  );
}
main().catch(() => {
  // Never publish browser console, response body, credentials or raw error stack to Git.
  process.stderr.write('PocketHost Test Lab: configuration, Chrome or filesystem unavailable\n');
  process.exitCode = 1;
});
