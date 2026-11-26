import test from 'node:test';
import assert from 'node:assert/strict';
import { planChangedChecks } from '../../scripts/dev/changed-checks-policy.mjs';
import { resolveTermuxCheckCommand } from '../../scripts/dev/termux-check-command.mjs';
import {
  prepareChangedVerification,
  runChangedVerification,
  selectApprovedVerification,
  compactCheckFailure,
  isExactCleanCheckout,
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

test('admin asset review blocks execution even alongside a mapped UI test', () => {
  const plan = makePlan([
    'apps/admin/public/site-logo.svg',
    'apps/admin/tests/screen.interaction.test.tsx',
  ]);
  const prepared = prepareChangedVerification(plan);
  assert.ok(prepared.review.some((reason) => reason.includes('browser impact review')));
  assert.deepEqual(prepared.checks, []);
});

test('reviewed index CSS requires regressions and keeps separate visual acceptance', () => {
  const css = 'apps/admin/src/index.css';
  const plan = makePlan([css]);
  assert.ok(prepareChangedVerification(plan).review.length);
  const prepared = prepareChangedVerification(plan, { reviewedCss: true });
  assert.deepEqual(prepared.review, []);
  assert.equal(prepared.visualReviewRequired, true);
  assert.ok(prepared.checks.some((check) => check.argv.includes('tests/appearance.interaction.test.tsx')));
  assert.ok(prepared.checks.some((check) => check.argv.includes('tests/tablet-sidebar-breakpoint.interaction.test.tsx')));
  assert.throws(() => selectApprovedVerification(prepared.checks, 'format', prepared));
  assert.equal(
    selectApprovedVerification(prepared.checks, 'format,admin-types,ui', prepared).length,
    3,
  );
  const mixed = prepareChangedVerification(makePlan([css, 'package.json']), { reviewedCss: true });
  assert.ok(mixed.review.some((reason) => reason.includes('package.json')));
  assert.deepEqual(mixed.checks, []);
  const other = prepareChangedVerification(makePlan(['apps/admin/src/App.css']), {
    reviewedCss: true,
  });
  assert.ok(other.review.length);
  assert.deepEqual(other.checks, []);
  const deleted = planChangedChecks([css], {}, { deletedPaths: [css] });
  assert.ok(prepareChangedVerification({ ...deleted, head: 'a'.repeat(40) }, { reviewedCss: true }).review.length);
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

test('exact-source QA requires the same clean Git HEAD before and after checks', () => {
  const sha = 'a'.repeat(40);
  const head = { status: 0, stdout: sha + '\n' };
  const clean = { status: 0, stdout: '' };
  assert.equal(isExactCleanCheckout(head, clean, sha), true);
  assert.equal(isExactCleanCheckout({ ...head, stdout: 'b'.repeat(40) }, clean, sha), false);
  assert.equal(isExactCleanCheckout(head, { status: 0, stdout: ' M src/file.ts\n' }, sha), false);
  assert.equal(isExactCleanCheckout({ status: 1, stdout: sha }, clean, sha), false);
  assert.equal(isExactCleanCheckout(head, { status: 1, stdout: '' }, sha), false);
  assert.equal(isExactCleanCheckout(head, clean, 'not-a-full-sha'), false);
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

test('UI failure diagnostics retain all failed cases after many suite headings', () => {
  const stdout = [
    ...Array.from({ length: 9 }, (_, index) => '❯ tests/suite-' + index + '.interaction.test.tsx'),
    ...Array.from({ length: 6 }, (_, index) => '× failed case ' + index),
    'Tests 6 failed | 59 passed (65)',
  ].join('\n');
  const message = compactCheckFailure(stdout, 'AssertionError: expected call count', '');
  assert.match(message, /failed case 5/);
  assert.match(message, /Tests 6 failed/);
  assert.ok(message.length <= 1800);
});
