import { execFileSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const appsDir = path.join(root, 'apps');
const destination = path.join(appsDir, 'admin');
const sourceRepository = 'https://github.com/shadcnstore/shadcn-dashboard-landing-template.git';
const sourceCommit = '866423741fa4b62d5e9427603cb2174aedf00f80';

if (existsSync(destination)) {
  throw new Error('apps/admin already exists; import is intentionally non-overwriting');
}

const temp = mkdtempSync(path.join(tmpdir(), 'pockethost-admin-'));
const clone = path.join(temp, 'upstream');
const staging = path.join(appsDir, '.admin-import-stage');
if (existsSync(staging)) {
  throw new Error('Found incomplete staging directory; inspect manually before retrying');
}

try {
  execFileSync('git', ['clone', '--depth', '1', '--single-branch', sourceRepository, clone], {
    stdio: ['ignore', 'ignore', 'pipe'],
    timeout: 180_000,
  });
  const actual = execFileSync('git', ['-C', clone, 'rev-parse', 'HEAD'], {
    encoding: 'utf8',
    timeout: 15_000,
  }).trim();
  if (actual !== sourceCommit) {
    throw new Error(`Upstream HEAD drifted (expected ${sourceCommit}, got ${actual}); review and update pin`);
  }

  const upstream = path.join(clone, 'vite-version');
  if (!existsSync(path.join(upstream, 'src/config/routes.tsx'))) {
    throw new Error('Missing expected Vite app routes');
  }

  mkdirSync(appsDir, { recursive: true });
  cpSync(upstream, staging, { recursive: true, force: false, errorOnExist: true });
  cpSync(path.join(clone, 'License.md'), path.join(staging, 'LICENSE.upstream.md'), {
    force: false,
    errorOnExist: true,
  });
  const routes = readFileSync(path.join(staging, 'src/config/routes.tsx'), 'utf8');
  const paths = [...routes.matchAll(/path:\s*["']([^"']+)["']/g)].map((m) => m[1]);
  if (paths.length < 30 || !paths.includes('/dashboard') || !paths.includes('/settings/appearance')) {
    throw new Error('Incomplete upstream route inventory; refusing partial import');
  }
  writeFileSync(
    path.join(staging, 'POCKETHOST_UPSTREAM.md'),
    [
      '# PocketHost admin template import',
      '',
      'Original project: shadcnstore/shadcn-dashboard-landing-template',
      `Pinned upstream commit: \`${sourceCommit}\``,
      'Imported directory: vite-version/',
      'License: MIT; see LICENSE.upstream.md',
      `Imported route entries: ${paths.length}`,
      '',
      'All demo screens, assets, routes, and components have been retained.',
      'Run only on Termux through the verified Local Agent; Vite is loopback-only in DEV.',
      '',
    ].join('\\n'),
    'utf8',
  );
  renameSync(staging, destination);
  console.log(`Imported full upstream dashboard at ${sourceCommit}; ${paths.length} route entries retained.`);
} finally {
  rmSync(temp, { recursive: true, force: true });
}
