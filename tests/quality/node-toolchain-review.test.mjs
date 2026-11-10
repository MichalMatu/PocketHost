import assert from 'node:assert/strict';
import test from 'node:test';
import {
  planNodeDependencies,
  reviewNodeToolchain,
} from '../../src/modules/packages/node-dependency-plan.ts';
const pkg = {
  name: 'new-node-project',
  version: '1.0.0',
  engines: { node: '>=22' },
  scripts: { start: 'node server.mjs' },
  dependencies: { express: '^5.0.0' },
};
const lock = {
  name: 'new-node-project',
  version: '1.0.0',
  lockfileVersion: 3,
  packages: {
    '': { name: 'new-node-project', version: '1.0.0', dependencies: { express: '^5.0.0' } },
  },
};
test('M2 toolchain preview identifies missing tools, enforces reviewed plan', () => {
  const plan = planNodeDependencies(pkg, lock);
  assert.deepEqual(reviewNodeToolchain(plan, { node: null, npm: '12.2.2' }), {
    status: 'blocked',
    missingTools: ['node'],
    conflicts: [],
    approved: false,
  });
  assert.deepEqual(reviewNodeToolchain(plan, { node: 'v26.13.0', npm: '12.2.2' }), {
    status: 'review-required',
    missingTools: [],
    conflicts: [],
    approved: false,
  });
});
test('M2 toolchain preview refuses unsupported or impossible installed versions', () => {
  const plan = planNodeDependencies(pkg, lock);
  assert.deepEqual(reviewNodeToolchain(plan, { node: 'v20.0.0', npm: '10.0.0' }).conflicts, [
    'node-requires-22-or-newer',
  ]);
  assert.throws(() => reviewNodeToolchain(plan, { node: 'evil', npm: '10.0.0' }), /version/);
});

test('M2 declared Node engine constraint is checked against installed major', () => {
  const plan = planNodeDependencies({ ...pkg, engines: { node: '>=24' } }, lock);
  assert.equal(plan.requiredNodeMajor, 24);
  assert.deepEqual(reviewNodeToolchain(plan, { node: 'v22.1.0', npm: '10.0.0' }).conflicts,
    ['node-requires-24-or-newer']);
});
