import test from 'node:test';
import assert from 'node:assert/strict';
import { planChangedChecks } from '../../scripts/dev/changed-checks-policy.mjs';
import { resolveTermuxCheckCommand } from '../../scripts/dev/termux-check-command.mjs';
import {
  prepareChangedVerification,
  runChangedVerification,
} from '../../scripts/dev/verify-changed-policy.mjs';

const deps = {
  'apps/admin/tests/screen.interaction.test.tsx': [
    'apps/admin/tests/screen.interaction.test.tsx',
    'apps/admin/src/app/screen/page.tsx',
  ],
};

function makePlan(changed, review = null) {
  const plan = planChangedChecks(changed, deps);
  return { ...plan, head: 'a'.repeat(40), review: review ?? plan.review };
}

test('cheap format runs before expensive TypeScript and UI checks', () => {
  const check = prepareChangedVerification(makePlan(['apps/admin/src/app/screen/page.tsx']));
  assert.deepEqual(check.review, []);
  assert.deepEqual(
    check.checks.map((x) => x.label),
    ['changed-file format', 'admin incremental typecheck', 'ui tests'],
  );
});

test('new JavaScript scripts are syntax-checked before other gates', () => {
  const check = prepareChangedVerification(makePlan(['scripts/dev/verify-changed.mjs']));
  assert.equal(check.checks[0].label, 'syntax: scripts/dev/verify-changed.mjs');
  assert.ok(check.checks.some((x) => x.argv.includes('tests/quality/dev-verify-changed.test.mjs')));
});

test('a changed interaction test runs itself but does not trigger a full UI suite', () => {
  const check = prepareChangedVerification(
    makePlan(['apps/admin/tests/screen.interaction.test.tsx']),
  );
  assert.deepEqual(
    check.checks.map((x) => x.label),
    ['changed-file format', 'ui tests'],
  );
  assert.deepEqual(check.checks[1].argv.slice(-1), ['tests/screen.interaction.test.tsx']);
});

test('unknown package/config changes fail closed, before running commands', () => {
  const plan = makePlan(['apps/admin/src/app/screen/page.tsx', 'package.json']);
  const prepared = prepareChangedVerification(plan);
  assert.ok(prepared.review.some((x) => x.includes('package.json')));
  assert.deepEqual(prepared.checks, []);
});

test('invalid or unrecognized check specifications cannot execute', () => {
  const plan = makePlan([]);
  plan.commands = [{ label: 'deploy', cwd: '.', argv: ['node', '-e', 'foo'] }];
  const prepared = prepareChangedVerification(plan);
  assert.ok(prepared.review.length);
  assert.deepEqual(prepared.checks, []);
});

test('manual QA gathers cheap errors without running expensive suites', () => {
  const invoked = [];
  const steps = [
    { label: 'changed-file format' },
    { label: 'docs' },
    { label: 'admin incremental typecheck' },
    { label: 'ui tests' },
  ];
  const result = runChangedVerification(steps, (step) => {
    invoked.push(step.label);
    return { ok: false, code: 2, elapsedMs: 7, error: 'format or docs error' };
  });
  assert.equal(result.status, 'FAIL');
  assert.deepEqual(result.failedChecks, ['changed-file format', 'docs']);
  assert.deepEqual(invoked, ['changed-file format', 'docs']);
  assert.deepEqual(result.checks.map((x) => x.status), ['FAIL', 'FAIL', 'SKIPPED', 'SKIPPED']);
});

test('successful focused checks produce one readable PASS receipt', () => {
  const plan = prepareChangedVerification(
    makePlan(['apps/admin/tests/screen.interaction.test.tsx']),
  );
  const result = runChangedVerification(plan.checks, () => ({ ok: true, code: 0, elapsedMs: 5 }));
  assert.equal(result.status, 'PASS');
  assert.equal(result.checks.length, 2);
  assert.ok(result.checks.every((x) => x.status === 'PASS'));
});

test('empty diff never introduces a full-suite fallback', () => {
  const prepared = prepareChangedVerification(makePlan([]));
  assert.deepEqual(prepared.checks, []);
  assert.deepEqual(prepared.review, []);
});

test('Termux QA maps pinned check commands to node instead of absent /usr/bin/env', () => {
  const root = '/tmp/fake-checkout';
  const checks = prepareChangedVerification(
    makePlan(['apps/admin/src/app/screen/page.tsx']),
  ).checks;
  // Use the pure negative path without needing a dependency install here.
  assert.throws(
    () =>
      resolveTermuxCheckCommand(
        { label: 'unknown command', cwd: '.', argv: ['npm', 'exec', '--no', '--', 'unknown'] },
        root,
        '/data/data/com.termux/files/usr/bin/node',
        'android',
      ),
    /Unsupported npm QA command/,
  );
  assert.deepEqual(
    resolveTermuxCheckCommand(
      { label: 'structure', cwd: '.', argv: ['node', 'scripts/quality/check-structure.mjs'] },
      root,
      '/data/data/com.termux/files/usr/bin/node',
      'android',
    ),
    {
      file: '/data/data/com.termux/files/usr/bin/node',
      args: ['scripts/quality/check-structure.mjs'],
    },
  );
  assert.ok(checks.some((item) => item.label === 'admin incremental typecheck'));
});
