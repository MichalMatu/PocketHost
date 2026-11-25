/**
 * Dependency-aware, intentionally conservative PocketHost DEV gate planner.
 * Pure logic: no Git, filesystem or host operations.
 */
// Reviewed server-side Vite adapters and their isolated HTTP regression suites.
const reviewedAdapters = new Map([
  ['dashboard-telemetry-api.ts', 'monitoring-api.test.mjs'],
  ['internet-connectivity-api.ts', 'monitoring-api.test.mjs'],
  ['site-fleet-api.ts', 'hosting-network-api.test.mjs'],
  ['node-project-api.ts', 'traffic-hosting-api.test.mjs'],
  ['termux-admin-action.ts', 'termux-admin-api.test.mjs'],
  ['termux-admin-api.ts', 'termux-admin-api.test.mjs'],
]);

/** Dependency imports are relevant only to changed source modules.
 * A docs/test/script-only diff has direct conservative check mappings.
 */
export function needsChangedTestDependencies(paths, deletedPaths = []) {
  const deleted = new Set(deletedPaths);
  return paths.some(
    (file) =>
      !deleted.has(file) &&
      ((file.startsWith('src/') && /\.(?:ts|tsx|mjs)$/.test(file)) ||
        (file.startsWith('apps/admin/src/') && /\.(?:ts|tsx|js|jsx)$/.test(file))),
  );
}

export function planChangedChecks(
  paths,
  dependencies = {},
  { includeAdminLint = false, deletedPaths = [] } = {},
) {
  const deleted = new Set(deletedPaths);
  const changes = [...new Set(paths)].sort();
  const node = new Set();
  const ui = new Set();
  const review = [];
  const docs = [];
  const format = [];
  const rootLint = [];
  const adminLint = [];
  let rootTypes = false;
  let adminTypes = false;
  let boundaries = false;
  let structure = false;

  for (const file of changes) {
    if (
      typeof file !== 'string' ||
      !file ||
      file.startsWith('/') ||
      file.includes('\\') ||
      file.includes('\0') ||
      file.split('/').some((part) => !part || part === '.' || part === '..')
    ) {
      review.push('Invalid change path: ' + String(file));
      continue;
    }
    if (deleted.has(file)) {
      const browserSource =
        file.startsWith('apps/admin/src/app/') || file.startsWith('apps/admin/src/components/');
      const browserAsset =
        file.startsWith('apps/admin/public/') || file.startsWith('apps/admin/src/assets/');
      if (!browserSource && !browserAsset) {
        review.push('Deletion needs explicit impact review: ' + file);
      } else if (browserSource) {
        // Route removal needs navigation regression. Shared component and JSON
        // fixture removal needs type closure and the cheap route-preservation
        // contract, but must not trigger a broad navigation UI test by default.
        if (/\.(?:tsx?|jsx?|json)$/.test(file)) {
          adminTypes = true;
          node.add('tests/quality/admin-preservation.test.mjs');
          if (
            file.startsWith('apps/admin/src/app/') &&
            /\/(?:page|layout|route|index)\.(?:tsx?|jsx?)$/.test(file)
          ) {
            ui.add('tests/management-navigation.interaction.test.tsx');
          }
        } else if (/\.(?:css|scss)$/.test(file)) {
          // TypeScript does not prove stylesheet imports still resolve.
          review.push('Deleted UI stylesheet needs bundle impact review: ' + file);
        } else {
          // A deleted non-code route asset can be referenced from JSX/CSS
          // without a TypeScript import. Do not silently certify its removal.
          review.push('Deleted UI asset needs browser usage review: ' + file);
        }
      } else if (browserAsset) {
        review.push('Deleted UI asset needs browser usage review: ' + file);
      }
      continue;
    }
    const markdown = file.endsWith('.md');
    if (markdown && !file.startsWith('apps/admin/')) docs.push(file);
    if (
      /\.(?:md|mjs|js|ts|tsx|mts|json|css)$/.test(file) &&
      !file.endsWith('package-lock.json') &&
      !file.endsWith('pnpm-lock.yaml')
    ) {
      format.push(file);
    }

    if (file.startsWith('tests/quality/') && file.endsWith('.test.mjs')) {
      node.add(file);
      rootLint.push(file);
      // A test-only edit must not need a repo-wide structure gate.
      continue;
    }
    if (file.startsWith('apps/admin/tests/') && /\.test\.(tsx|ts)$/.test(file)) {
      ui.add(file.slice('apps/admin/'.length));
      adminLint.push(file.slice('apps/admin/'.length));
      continue;
    }
    if (file === 'src/modules/host/traffic-store.d.mts') {
      rootTypes = true;
      adminTypes = true;
      boundaries = true;
      structure = true;
      node.add('tests/quality/traffic-collector.test.mjs');
      continue;
    }
    if (file.startsWith('src/') && /\.(?:ts|tsx|mjs)$/.test(file)) {
      rootTypes ||= /\.(?:ts|tsx)$/.test(file);
      boundaries = true;
      structure = true;
      rootLint.push(file);
    } else if (file.startsWith('apps/admin/src/') && /\.(?:ts|tsx|js|jsx)$/.test(file)) {
      adminTypes = true;
      adminLint.push(file.slice('apps/admin/'.length));
    } else if (file.startsWith('apps/admin/src/') && /\.(?:css|scss)$/.test(file)) {
      // A formatter alone cannot establish that an edited stylesheet still
      // renders correctly. The static import graph does not validate CSS rules,
      // selectors, or responsive geometry; require an explicit visual scope.
      review.push('Stylesheet change needs browser layout impact review: ' + file);
    } else if (
      file.startsWith('apps/admin/plugins/') &&
      reviewedAdapters.has(file.slice('apps/admin/plugins/'.length))
    ) {
      // Server adapters are imported by root HTTP tests and by the Vite config.
      rootTypes = true;
      adminTypes = true;
      boundaries = true;
      structure = true;
      adminLint.push(file.slice('apps/admin/'.length));
      node.add('tests/quality/' + reviewedAdapters.get(file.slice('apps/admin/plugins/'.length)));
      if (file === 'apps/admin/plugins/site-fleet-api.ts') node.add('tests/quality/traffic-hosting-api.test.mjs');
    } else if (file === 'apps/admin/vite.config.ts') {
      // This is the exact DEV API registration boundary. Changes require
      // typechecking, route-preservation and targeted service UI regression.
      // Other config or dependency changes remain MANUAL_REVIEW.
      adminTypes = true;
      adminLint.push('vite.config.ts');
      node.add('tests/quality/admin-preservation.test.mjs');
      ui.add('tests/termux-admin.interaction.test.tsx');
      ui.add('tests/protected-services-panel.interaction.test.tsx');
      ui.add('tests/system-dashboard.interaction.test.tsx');
    } else if (file.startsWith('scripts/') && file.endsWith('.mjs')) {
      rootLint.push(file);
      structure = true;
    } else if (file === 'ops/termux/fast-flow.mjs') {
      // The only reviewed DEV orchestration script. Other ops remain manual-review only.
      node.add('tests/quality/dev-fast-flow.test.mjs');
      rootLint.push(file);
      structure = true;
    } else if (file.startsWith('apps/admin/src/') || file.startsWith('apps/admin/public/')) {
      // Media and non-code content can change UI behavior with no import or
      // typecheck evidence. Demand a browser usage review, not a false PASS.
      review.push('UI asset/content change needs browser impact review: ' + file);
    } else if (!markdown) {
      review.push('Explicit impact review required: ' + file);
    }

    // Routes are also inspected as file contents by a Node contract test.
    if (
      [
        'apps/admin/src/config/routes.tsx',
        'apps/admin/src/config/navigation.ts',
        'apps/admin/index.html',
      ].includes(file)
    )
      node.add('tests/quality/admin-preservation.test.mjs');
    if (file.startsWith('scripts/dev/ui-sync')) node.add('tests/quality/dev-ui-sync.test.mjs');
    if (file.startsWith('scripts/dev/changed-checks'))
      node.add('tests/quality/dev-changed-checks.test.mjs');
    if (file === 'scripts/quality/check-docs.mjs')
      node.add('tests/quality/dev-docs-changed.test.mjs');
    if (file.startsWith('scripts/dev/verify-changed'))
      node.add('tests/quality/dev-verify-changed.test.mjs');

    if (
      !markdown &&
      (file.startsWith('src/') ||
        (file.startsWith('apps/admin/src/') && /\.(?:ts|tsx|js|jsx)$/.test(file)))
    ) {
      const matching = Object.entries(dependencies).filter(([, targets]) => targets.includes(file));
      for (const [test] of matching) {
        if (test.startsWith('tests/quality/')) node.add(test);
        else if (test.startsWith('apps/admin/tests/')) ui.add(test.slice('apps/admin/'.length));
      }
      if (
        !matching.length &&
        !node.has('tests/quality/admin-preservation.test.mjs') &&
        !file.endsWith('.css')
      )
        review.push('No known test dependency: ' + file);
    }
  }

  const commands = [];
  function add(label, cwd, argv) {
    commands.push({ label, cwd, argv });
  }
  if (structure) add('structure', '.', ['node', 'scripts/quality/check-structure.mjs']);
  if (docs.length)
    add('docs', '.', ['node', 'scripts/quality/check-docs.mjs', '--changed', ...docs]);
  if (boundaries) add('boundaries', '.', ['node', 'scripts/quality/check-boundaries.mjs']);
  if (node.size) add('node tests', '.', ['node', '--test', ...[...node].sort()]);
  if (ui.size) add('ui tests', 'apps/admin', ['npm', 'run', 'test:ui', '--', ...[...ui].sort()]);
  if (rootTypes)
    add('root incremental typecheck', '.', [
      'npm',
      'run',
      'typecheck',
      '--',
      '--incremental',
      '--tsBuildInfoFile',
      '.tmp/root-typecheck.tsbuildinfo',
    ]);
  if (adminTypes)
    add('admin incremental typecheck', 'apps/admin', [
      'npm',
      'exec',
      '--no',
      '--',
      'tsc',
      '-b',
      '--pretty',
      'false',
    ]);
  if (rootLint.length)
    add('root changed-file lint', '.', [
      'npm',
      'exec',
      '--no',
      '--',
      'eslint',
      ...[...new Set(rootLint)].sort(),
    ]);
  if (includeAdminLint && adminLint.length)
    add('admin changed-file lint', 'apps/admin', [
      'npm',
      'exec',
      '--no',
      '--',
      'eslint',
      ...[...new Set(adminLint)].sort(),
    ]);
  if (docs.length)
    add('changed markdown lint', '.', ['npm', 'exec', '--no', '--', 'markdownlint-cli2', ...docs]);
  if (format.length)
    add('changed-file format', '.', [
      'npm',
      'exec',
      '--no',
      '--',
      'prettier',
      '--check',
      ...format,
    ]);
  return { changed: changes, commands, review };
}
