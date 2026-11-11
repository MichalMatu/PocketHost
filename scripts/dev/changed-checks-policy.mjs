/**
 * Dependency-aware, intentionally conservative PocketHost DEV gate planner.
 * Pure logic: no Git, filesystem or host operations.
 */
export function planChangedChecks(
  paths,
  dependencies = {},
  { includeAdminLint = false } = {},
) {
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
    const markdown = file.endsWith('.md');
    if (markdown && !file.startsWith('apps/admin/')) docs.push(file);
    if (
      /\.(?:md|mjs|js|ts|tsx|json|css)$/.test(file) &&
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
    if (file.startsWith('src/') && /\.(?:ts|tsx|mjs)$/.test(file)) {
      rootTypes ||= /\.(?:ts|tsx)$/.test(file);
      boundaries = true;
      structure = true;
      rootLint.push(file);
    } else if (file.startsWith('apps/admin/src/') && /\.(?:ts|tsx|js|jsx)$/.test(file)) {
      adminTypes = true;
      adminLint.push(file.slice('apps/admin/'.length));
    } else if (file.startsWith('scripts/') && file.endsWith('.mjs')) {
      rootLint.push(file);
      structure = true;
    } else if (
      !markdown &&
      !file.startsWith('apps/admin/src/') &&
      !file.startsWith('apps/admin/public/')
    ) {
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

    if (
      file.startsWith('src/') ||
      (file.startsWith('apps/admin/src/') && /\.(?:ts|tsx|js|jsx)$/.test(file))
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
  if (docs.length) add('docs', '.', ['node', 'scripts/quality/check-docs.mjs']);
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
