import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const BASE_BYTES = 24 * 1024;
const TEST_BYTES = 32 * 1024;
const BASE_LINES = 700;
const TEST_LINES = 1200;

// Pinned oversized legacy source: it may shrink or disappear, never grow.
const legacyBytes = new Map([
  ['apps/admin/src/app/dashboard/components/data-table.tsx', 38492],
  ['apps/admin/src/app/projects/page.tsx', 69621],
  ['apps/admin/src/app/settings/notifications/page.tsx', 36311],
  ['apps/admin/src/app/shizuku/page.tsx', 33172],
  ['apps/admin/src/app/sites/page.tsx', 28679],
  // Runit control flow moved unchanged out of the old 97 KB admin-actions legacy file.
  // Keep only this relocated debt pinned: it must shrink, never grow.
  ['apps/admin/src/app/termux/runit-service-actions.tsx', 61859],
  ['apps/admin/src/app/termux/runit-health.tsx', 33480],
  ['apps/admin/src/app/termux/system-page.tsx', 37824],
  ['apps/admin/src/utils/shadcn-ui-theme-presets.ts', 30629],
  ['apps/admin/src/utils/tweakcn-theme-presets.ts', 109279],
  ['apps/admin/tests/node-projects.interaction.test.tsx', 70274],
  ['apps/admin/vite.config.ts', 92033],
  ['src/modules/host/dashboard-telemetry-history.ts', 28055],
  ['src/modules/host/node-project-host.ts', 31554],
  ['src/modules/host/node-runit-host.ts', 48579],
  ['src/modules/host/site-fleet-host.ts', 27959],
  ['src/modules/host/termux-service-admin.ts', 123965],
]);

export function validateCodeBudgets(root = repositoryRoot) {
  const errors = [];
  const checked = new Set();
  function inspect(file, relative) {
    if (checked.has(relative)) return;
    checked.add(relative);
    const testFile = relative.startsWith('tests/') || relative.startsWith('apps/admin/tests/');
    const maximum = legacyBytes.get(relative) ?? (testFile ? TEST_BYTES : BASE_BYTES);
    const bytes = statSync(file).size;
    if (bytes > maximum) errors.push('Oversized code file: ' + relative + ' (' + bytes + ' > ' + maximum + ')');
    const source = readFileSync(file, 'utf8');
    const lines = source.split('\n').length;
    if (!legacyBytes.has(relative) && lines > (testFile ? TEST_LINES : (relative === 'apps/admin/src/components/ui/sidebar.tsx' ? 727 : BASE_LINES)))
      errors.push('Too many lines: ' + relative + ' (' + lines + ')');
    if (relative.startsWith('apps/admin/src/') &&
        /^\s*(?:import|export)\s+(?:[^'"\n]*?\s+from\s+)?['"](?:node:(?:fs|child_process|os|net|http|https)|[^'"]*src\/modules\/host\/)/m.test(source))
      errors.push('Host-only import in browser UI: ' + relative);
  }
  function walk(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const full = path.join(directory, entry.name);
      const relative = path.relative(root, full).split(path.sep).join('/');
      if (entry.isSymbolicLink()) { errors.push('Symlink in source: ' + relative); continue; }
      if (entry.isDirectory()) {
        if (!['node_modules', 'dist', 'coverage', '.tmp'].includes(entry.name)) walk(full);
      } else if (entry.isFile() && /\.(?:ts|tsx|mjs)$/.test(entry.name)) inspect(full, relative);
    }
  }
  for (const relative of ['src', 'apps/admin/src', 'apps/admin/plugins', 'apps/admin/tests', 'tests', 'ops', 'scripts']) {
    try {
      const directory = path.join(root, relative);
      if (statSync(directory).isDirectory()) walk(directory);
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  const vite = path.join(root, 'apps/admin/vite.config.ts');
  try { if (statSync(vite).isFile()) inspect(vite, 'apps/admin/vite.config.ts'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  return errors.sort();
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const errors = validateCodeBudgets();
  if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
  else console.log('Code budgets and browser/module boundary: PASS');
}
