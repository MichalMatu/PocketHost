import test from 'node:test';
import assert from 'node:assert/strict';
import { planChangedChecks } from '../../scripts/dev/changed-checks-policy.mjs';
import { resolveTermuxCheckCommand } from '../../scripts/dev/termux-check-command.mjs';
import {
  prepareChangedVerification,
  runChangedVerification,
  selectApprovedVerification,
  compactCheckFailure,
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

test('manual QA requires exact explicit scope, never expands to every planned check', () => {
  const planned = prepareChangedVerification(
    makePlan(['apps/admin/src/app/screen/page.tsx']),
  ).checks;
  assert.deepEqual(
    selectApprovedVerification(planned, 'ui').map((item) => item.label),
    ['ui tests'],
  );
  assert.deepEqual(
    selectApprovedVerification(planned, 'format,ui').map((item) => item.label),
    ['changed-file format', 'ui tests'],
  );
  for (const bad of ['', 'all', 'ui,ui', 'ui,node', 'syntax', 'admin-lint']) {
    assert.throws(() => selectApprovedVerification(planned, bad));
  }
});

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
  assert.deepEqual(
    result.checks.map((x) => x.status),
    ['FAIL', 'FAIL', 'SKIPPED', 'SKIPPED'],
  );
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

test('UI QA receipt preserves failing test identity instead of trailing HTML dump', () => {
  const stdout =
    ' FAIL  tests/site-fleet.interaction.test.tsx > editor > saves revisions\n' +
    ' Test Files 1 failed | 8 passed (9)\n Tests 1 failed | 58 passed (59)\n';
  const stderr =
    'TestingLibraryElementError: Unable to find the Save button\n' +
    '<div class="page">' +
    '<svg></svg>'.repeat(2500) +
    '</div>';
  const message = compactCheckFailure(stdout, stderr, '');
  assert.match(message, /FAIL\s{2}tests\/site-fleet\.interaction\.test\.tsx/);
  assert.match(message, /Test Files 1 failed/);
  assert.match(message, /TestingLibraryElementError/);
  assert.ok(message.length <= 1800);
  assert.ok(!message.includes('<svg>'));
});

test('QA receipts retain generic compiler failures without Vitest markers', () => {
  const message = compactCheckFailure('', 'src/file.ts(4,2): error TS1294: unsupported syntax', '');
  assert.match(message, /TS1294/);
});

test('QA diagnostic includes ESLint file and location before the total', () => {
  const stderr =
    '/repo/scripts/dev/verify-changed-policy.mjs\n' +
    '  164:8  error  Unexpected variable  no-unused-vars\n' +
    '✖ 1 problem (1 error, 0 warnings)';
  const message = compactCheckFailure('', stderr, '');
  assert.match(message, /verify-changed-policy\.mjs/);
  assert.match(message, /164:8\s+error/);
  assert.ok(message.length <= 1800);
});
