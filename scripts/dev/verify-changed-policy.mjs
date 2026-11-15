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

export function prepareChangedVerification(plan) {
  if (
    !plan ||
    !Array.isArray(plan.changed) ||
    !Array.isArray(plan.commands) ||
    !Array.isArray(plan.review) ||
    typeof plan.head !== 'string'
  ) {
    throw new Error('Invalid changed-checks plan');
  }
  const reasons = [...plan.review];
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
  const sorted = checks
    .map((check, index) => ({ check, index }))
    .sort(
      (a, b) =>
        (a.check.label.startsWith('syntax:') ? -1 : priority.get(a.check.label)) -
          (b.check.label.startsWith('syntax:') ? -1 : priority.get(b.check.label)) ||
        a.index - b.index,
    )
    .map((item) => item.check);
  return { review: reasons, checks: reasons.length ? [] : sorted };
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
