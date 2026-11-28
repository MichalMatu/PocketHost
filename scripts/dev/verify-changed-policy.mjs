/**
 * Pure orchestration for the Samsung-only PocketHost changed-source checks.
 * The existing changed-checks-policy.mjs remains the single dependency mapper.
 */
const priority = new Map([
  // Cheap failures first; no multi-minute UI suite before formatting.
  ['changed-file format', 0],
  ['structure', 1],
  ['boundaries', 1],
  ['docs', 1],
  ['changed markdown lint', 1],
  ['root changed-file lint', 1],
  ['admin changed-file lint', 1],
  ['root incremental typecheck', 2],
  ['admin incremental typecheck', 2],
  ['node tests', 3],
  ['ui tests', 3],
]);

const reviewedCssPath = 'apps/admin/src/index.css';
const cssReviewReason = 'Stylesheet change needs browser layout impact review: ' + reviewedCssPath;
const cssUiTests = [
  'tests/appearance.interaction.test.tsx',
  'tests/compact-management-layout.interaction.test.tsx',
  'tests/tablet-sidebar-breakpoint.interaction.test.tsx',
];

const templateCssPath = 'apps/admin/src/App.css';
const templateDeletionReason = 'Deletion needs explicit impact review: ' + templateCssPath;
const transitionPaths = [
  'apps/admin/src/components/theme-customizer/circular-transition.css',
  'apps/admin/src/hooks/use-circular-transition.ts',
];
const transitionReasons = [
  'Deleted UI stylesheet needs bundle impact review: ' + transitionPaths[0],
  'Deletion needs explicit impact review: ' + transitionPaths[1],
];

function exactSet(actual, expected) {
  return (
    Array.isArray(actual) &&
    actual.length === expected.length &&
    expected.every((value) => actual.includes(value))
  );
}

export function prepareChangedVerification(
  plan,
  {
    reviewedCss = false,
    reviewedTemplateDeletion = false,
    reviewedTransitionDeletion = false,
  } = {},
) {
  if (
    !plan ||
    !Array.isArray(plan.changed) ||
    !Array.isArray(plan.commands) ||
    !Array.isArray(plan.review) ||
    typeof plan.head !== 'string'
  ) {
    throw new Error('Invalid changed-checks plan');
  }
  const cssEligible =
    reviewedCss === true &&
    plan.changed.includes(reviewedCssPath) &&
    plan.review.includes(cssReviewReason);
  const reasons = plan.review.filter((reason) => !(cssEligible && reason === cssReviewReason));
  if (reviewedCss && !cssEligible) reasons.push('CSS review does not match the changed stylesheet');
  // Explicit manual admission for exactly the reviewed unused Vite template.
  // This does not certify bundle equivalence or authorize any other deletion.
  const templateEligible =
    reviewedTemplateDeletion === true &&
    !reviewedCss &&
    !reviewedTransitionDeletion &&
    plan.changed.length === 1 &&
    plan.changed[0] === templateCssPath &&
    Array.isArray(plan.deletedPaths) &&
    plan.deletedPaths.length === 1 &&
    plan.deletedPaths[0] === templateCssPath &&
    reasons.length === 1 &&
    reasons[0] === templateDeletionReason;
  if (templateEligible) reasons.pop();
  else if (reviewedTemplateDeletion) reasons.push('Template deletion review scope mismatch');
  // The detached animation stylesheet and its hook must be removed together.
  // All other path combinations and additional review reasons remain blocked.
  const transitionEligible =
    reviewedTransitionDeletion === true &&
    !reviewedCss &&
    !reviewedTemplateDeletion &&
    exactSet(plan.changed, transitionPaths) &&
    exactSet(plan.deletedPaths, transitionPaths) &&
    exactSet(reasons, transitionReasons);
  if (transitionEligible) reasons.length = 0;
  else if (reviewedTransitionDeletion) reasons.push('Transition deletion review scope mismatch');
  const reviewedDeletion = templateEligible || transitionEligible;
  const checks = [];
  const names = new Set();
  for (const file of plan.changed) {
    if (typeof file !== 'string') throw new Error('Invalid path in changed-checks plan');
    if (/\.m?js$/.test(file) && /^(?:scripts\/|src\/|tests\/)/.test(file)) {
      checks.push({ label: 'syntax: ' + file, cwd: '.', argv: ['node', '--check', file] });
    }
  }
  for (const check of plan.commands) {
    if (
      !check ||
      !priority.has(check.label) ||
      !['.', 'apps/admin'].includes(check.cwd) ||
      !Array.isArray(check.argv) ||
      check.argv.length < 2 ||
      !check.argv.every((x) => typeof x === 'string' && x.length > 0 && !x.includes('\0')) ||
      !['node', 'npm'].includes(check.argv[0]) ||
      names.has(check.label)
    ) {
      reasons.push('Unrecognized or duplicate verification command');
      continue;
    }
    names.add(check.label);
    checks.push(check);
  }
  if (cssEligible && reasons.length === 0) {
    const ui = checks.find((check) => check.label === 'ui tests');
    if (ui) {
      ui.argv = [...ui.argv.slice(0, 4), ...new Set([...ui.argv.slice(4), ...cssUiTests])];
    } else {
      checks.push({
        label: 'ui tests',
        cwd: 'apps/admin',
        argv: ['npm', 'run', 'test:ui', '--', ...cssUiTests],
      });
    }
    if (!names.has('admin incremental typecheck')) {
      checks.push({
        label: 'admin incremental typecheck',
        cwd: 'apps/admin',
        argv: ['npm', 'exec', '--no', '--', 'tsc', '-b', '--pretty', 'false'],
      });
    }
    if (!names.has('changed-file format')) reasons.push('CSS formatting check missing');
  }
  if (reviewedDeletion && reasons.length === 0) {
    if (checks.length !== 0) reasons.push('Unexpected reviewed deletion check plan');
    else
      checks.push(
        {
          label: 'admin incremental typecheck',
          cwd: 'apps/admin',
          argv: ['npm', 'exec', '--no', '--', 'tsc', '-b', '--pretty', 'false'],
        },
        {
          label: 'node tests',
          cwd: '.',
          argv: ['node', '--test', 'tests/quality/admin-preservation.test.mjs'],
        },
        {
          label: 'ui tests',
          cwd: 'apps/admin',
          argv: ['npm', 'run', 'test:ui', '--', ...cssUiTests],
        },
      );
  }
  const sorted = checks
    .map((check, index) => ({ check, index }))
    .sort(
      (a, b) =>
        (a.check.label.startsWith('syntax:') ? -1 : priority.get(a.check.label)) -
          (b.check.label.startsWith('syntax:') ? -1 : priority.get(b.check.label)) ||
        a.index - b.index,
    )
    .map((item) => item.check);
  return {
    review: reasons,
    checks: reasons.length ? [] : sorted,
    ...(cssEligible || reviewedDeletion ? { visualReviewRequired: true } : {}),
    ...(reviewedDeletion ? { templateBundleReviewRequired: true } : {}),
  };
}

/**
 * One manual run executes ONLY explicitly approved check categories from the
 * prepared exact-SHA plan; no "all" or implicit suite expansion option.
 * Standing owner consent does not remove the exact-SHA and scope requirements.
 */
const approvalLabels = new Map([
  ['format', 'changed-file format'],
  ['structure', 'structure'],
  ['boundaries', 'boundaries'],
  ['docs', 'docs'],
  ['markdown', 'changed markdown lint'],
  ['root-lint', 'root changed-file lint'],
  ['admin-lint', 'admin changed-file lint'],
  ['root-types', 'root incremental typecheck'],
  ['admin-types', 'admin incremental typecheck'],
  ['node', 'node tests'],
  ['ui', 'ui tests'],
]);

export function selectApprovedVerification(
  checks,
  scope,
  { visualReviewRequired = false, templateBundleReviewRequired = false } = {},
) {
  if (
    !Array.isArray(checks) ||
    typeof scope !== 'string' ||
    !/^[a-z-]+(?:,[a-z-]+)*$/.test(scope) ||
    scope.length > 160
  )
    throw new Error('Invalid explicit QA scope');
  const ids = scope.split(',');
  if (
    templateBundleReviewRequired &&
    !['admin-types', 'node', 'ui'].every((id) => ids.includes(id))
  )
    throw new Error('Reviewed stylesheet deletion requires admin-types, node and ui QA');
  if (
    visualReviewRequired &&
    !templateBundleReviewRequired &&
    !['format', 'admin-types', 'ui'].every((id) => ids.includes(id))
  )
    throw new Error('Reviewed CSS requires format, admin-types and ui QA');
  if (
    new Set(ids).size !== ids.length ||
    ids.some((id) => id !== 'syntax' && !approvalLabels.has(id))
  )
    throw new Error('Duplicate or unknown approved QA scope');
  const matched = new Map(ids.map((id) => [id, 0]));
  const selected = checks.filter((check) => {
    const id = check.label.startsWith('syntax: ')
      ? 'syntax'
      : [...approvalLabels].find(([, label]) => label === check.label)?.[0];
    if (!id || !matched.has(id)) return false;
    matched.set(id, matched.get(id) + 1);
    return true;
  });
  if (selected.length === 0 || [...matched.values()].some((count) => count === 0))
    throw new Error('Approved QA scope is absent from this exact-source plan');
  return selected;
}

/** A terminal PASS is meaningful only for the same clean checkout throughout QA. */
export function isExactCleanCheckout(head, status, expectedSha) {
  return (
    /^[0-9a-f]{40}$/.test(expectedSha ?? '') &&
    head?.status === 0 &&
    typeof head.stdout === 'string' &&
    head.stdout.trim() === expectedSha &&
    status?.status === 0 &&
    typeof status.stdout === 'string' &&
    status.stdout.trim() === ''
  );
}

export function runChangedVerification(checks, execute) {
  const results = [];
  const failedChecks = [];
  // Even in a separately approved run, collect all inexpensive diagnostics.
  // If they fail, do not spend minutes on Node/UI regression.
  const expensive = new Set([
    'root incremental typecheck',
    'admin incremental typecheck',
    'node tests',
    'ui tests',
  ]);
  for (const check of checks) {
    if (failedChecks.length && expensive.has(check.label)) {
      results.push({ label: check.label, status: 'SKIPPED', reason: 'earlier-check-failed' });
      continue;
    }
    const outcome = execute(check);
    const status = outcome?.ok === true ? 'PASS' : 'FAIL';
    results.push({
      label: check.label,
      status,
      code: outcome?.code ?? null,
      elapsedMs: outcome?.elapsedMs ?? null,
      ...(status === 'FAIL' ? { error: outcome?.error ?? 'Check failed' } : {}),
    });
    if (status === 'FAIL') failedChecks.push(check.label);
  }
  return failedChecks.length
    ? { status: 'FAIL', failedAt: failedChecks[0], failedChecks, checks: results }
    : { status: 'PASS', checks: results };
}

/**
 * Keep the failing Vitest assertion and test name visible even when jsdom
 * appends a large DOM dump after the reporter summary.
 */
export function compactCheckFailure(stdout, stderr, failure) {
  const ansi = new RegExp(String.fromCharCode(27) + '\\[[0-9;]*m', 'g');
  const clean = (value) => String(value ?? '').replace(ansi, '');
  const all = [clean(stdout), clean(stderr), clean(failure)].filter(Boolean).join('\n');
  const lines = all
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const failedTests = lines.filter((line) => /^[×✗✖]\s/.test(line));
  const names = lines.filter((line) => /^(?:FAIL\b|❯\s)/.test(line));
  const locations = lines.filter((line) =>
    /(?:\.(?:mjs|js|ts|tsx)$|^\d+:\d+\s+error\b|\berror\s{2,})/.test(line),
  );
  const summary = lines.filter((line) =>
    /^(?:Test Files\b|Tests\b|AssertionError\b|TestingLibraryElementError\b|Error:)/.test(line),
  );
  const selected = [
    ...new Set([
      ...failedTests.slice(0, 24),
      ...names.slice(0, 10),
      ...locations.slice(0, 6),
      ...summary.slice(-8),
    ]),
  ].join('\n');
  return (selected || all.slice(-1800)).slice(0, 1800);
}
