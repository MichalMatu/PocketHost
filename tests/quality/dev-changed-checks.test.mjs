import test from 'node:test';
import assert from 'node:assert/strict';
import { planChangedChecks } from '../../scripts/dev/changed-checks-policy.mjs';

const deps = {
  'tests/quality/hosting-registry-store.test.mjs': [
    'tests/quality/hosting-registry-store.test.mjs',
    'src/modules/host/hosting-registry-store.ts',
    'src/shared/hosting-registry.ts',
  ],
  'tests/quality/hosting-registry.test.mjs': [
    'tests/quality/hosting-registry.test.mjs',
    'src/shared/hosting-registry.ts',
  ],
  'apps/admin/tests/shizuku-page.interaction.test.tsx': [
    'apps/admin/tests/shizuku-page.interaction.test.tsx',
    'apps/admin/src/app/shizuku/page.tsx',
  ],
};

function command(plan, label) {
  return plan.commands.find((item) => item.label === label);
}

test('documentation-only delta runs no source tests, builds or typechecks', () => {
  const plan = planChangedChecks(['AGENTS.md', 'docs/DEV_ITERATION.md'], deps);
  assert.ok(command(plan, 'docs'));
  assert.ok(command(plan, 'changed markdown lint'));
  assert.ok(command(plan, 'changed-file format'));
  assert.equal(command(plan, 'node tests'), undefined);
  assert.equal(command(plan, 'ui tests'), undefined);
  assert.equal(command(plan, 'root incremental typecheck'), undefined);
  assert.equal(command(plan, 'admin incremental typecheck'), undefined);
  assert.deepEqual(plan.review, []);
});

test('backend delta selects only dependent Node tests with incremental typecheck', () => {
  const plan = planChangedChecks(['src/shared/hosting-registry.ts'], deps);
  const node = command(plan, 'node tests');
  assert.deepEqual(node.argv.slice(2), [
    'tests/quality/hosting-registry-store.test.mjs',
    'tests/quality/hosting-registry.test.mjs',
  ]);
  assert.ok(command(plan, 'boundaries'));
  assert.ok(command(plan, 'root incremental typecheck'));
  assert.equal(command(plan, 'ui tests'), undefined);
  assert.deepEqual(plan.review, []);
});

test('UI delta selects only dependent interaction test and incremental admin typecheck', () => {
  const plan = planChangedChecks(['apps/admin/src/app/shizuku/page.tsx'], deps);
  const ui = command(plan, 'ui tests');
  assert.deepEqual(ui.argv.slice(-1), ['tests/shizuku-page.interaction.test.tsx']);
  assert.ok(command(plan, 'admin incremental typecheck'));
  assert.equal(command(plan, 'node tests'), undefined);
  assert.deepEqual(plan.review, []);
});

test('admin ESLint is periodic and opt-in, not automatic for every UI change', () => {
  const changed = [
    'apps/admin/src/app/shizuku/page.tsx',
    'apps/admin/tests/shizuku-page.interaction.test.tsx',
  ];
  const normal = planChangedChecks(changed, deps);
  assert.equal(command(normal, 'admin changed-file lint'), undefined);
  assert.ok(command(normal, 'ui tests'));
  assert.ok(command(normal, 'admin incremental typecheck'));

  const periodic = planChangedChecks(changed, deps, { includeAdminLint: true });
  assert.deepEqual(command(periodic, 'admin changed-file lint').argv.slice(-2), [
    'src/app/shizuku/page.tsx',
    'tests/shizuku-page.interaction.test.tsx',
  ]);
});

test('route preservation receives explicit test even if source is read as text', () => {
  const plan = planChangedChecks(['apps/admin/src/config/navigation.ts']);
  assert.ok(command(plan, 'node tests').argv.includes('tests/quality/admin-preservation.test.mjs'));
  assert.deepEqual(plan.review, []);
});

test('unmapped code and dependency manifests cannot silently report full coverage', () => {
  const plan = planChangedChecks(['src/modules/host/new-dangerous-command.ts', 'package.json']);
  assert.ok(plan.review.some((line) => line.includes('No known test dependency')));
  assert.ok(plan.review.some((line) => line.includes('Explicit impact review')));
  assert.equal(command(plan, 'node tests'), undefined);
});

test('changed test is run once and invalid paths are rejected', () => {
  const plan = planChangedChecks(
    [
      'tests/quality/hosting-registry.test.mjs',
      'tests/quality/hosting-registry.test.mjs',
      '../../dangerous',
    ],
    deps,
  );
  assert.deepEqual(command(plan, 'node tests').argv.slice(2), [
    'tests/quality/hosting-registry.test.mjs',
  ]);
  assert.equal(plan.review.length, 1);
});
