/**
 * Pure orchestration for the Samsung-only PocketHost changed-source checks.
 * The existing changed-checks-policy.mjs remains the single dependency mapper.
 */
const priority = new Map([
  ['root incremental typecheck', 0],
  ['admin incremental typecheck', 0],
  ['structure', 1],
  ['boundaries', 1],
  ['node tests', 2],
  ['ui tests', 2],
  ['root changed-file lint', 3],
  ['admin changed-file lint', 3],
  ['docs', 3],
  ['changed markdown lint', 3],
  ['changed-file format', 4],
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
  for (const check of checks) {
    const outcome = execute(check);
    const status = outcome?.ok === true ? 'PASS' : 'FAIL';
    results.push({
      label: check.label,
      status,
      code: outcome?.code ?? null,
      elapsedMs: outcome?.elapsedMs ?? null,
      ...(status === 'FAIL' ? { error: outcome?.error ?? 'Check failed' } : {}),
    });
    if (status === 'FAIL') return { status: 'FAIL', failedAt: check.label, checks: results };
  }
  return { status: 'PASS', checks: results };
}
