import assert from 'node:assert/strict';
import test from 'node:test';
import { planNodeDependencies } from '../../src/modules/packages/node-dependency-plan.ts';

function fixture() {
  return {
    pkg: {
      name: 'owned-node-demo',
      version: '1.0.0',
      scripts: { start: 'node server.mjs', build: 'node scripts/build.mjs' },
      dependencies: { express: '^5.0.0' },
    },
    lock: {
      name: 'owned-node-demo',
      version: '1.0.0',
      lockfileVersion: 3,
      packages: {
        '': {
          name: 'owned-node-demo',
          version: '1.0.0',
          dependencies: { express: '^5.0.0' },
        },
      },
    },
  };
}

test('M2 node npm plan is review-only with fixed argv and zero host execution', () => {
  const { pkg, lock } = fixture();
  const plan = planNodeDependencies(pkg, lock);
  assert.equal(plan.status, 'review-required');
  assert.equal(plan.dependencyCount, 1);
  assert.deepEqual(plan.commands.install, ['npm', 'ci']);
  assert.deepEqual(plan.commands.build, ['npm', 'run', 'build']);
  assert.deepEqual(plan.commands.start, ['npm', 'start']);
  assert.equal(JSON.stringify(plan).includes('server.mjs'), false);
});

test('M2 refuses missing lockfile, stale lock identity and mismatched dependency roots', () => {
  const { pkg, lock } = fixture();
  assert.throws(() => planNodeDependencies(pkg, {}), /lockfile/);
  assert.throws(() => planNodeDependencies(pkg, { ...lock, version: '2.0.0' }), /identity/);
  assert.throws(
    () =>
      planNodeDependencies(pkg, {
        ...lock,
        packages: { '': { ...lock.packages[''], dependencies: { express: '^4.0.0' } } },
      }),
    /disagrees/,
  );
});

test('M2 refuses missing start, unsupported manager, invalid dependency declarations', () => {
  const { pkg, lock } = fixture();
  assert.throws(() => planNodeDependencies({ ...pkg, scripts: {} }, lock), /start script/);
  assert.throws(() => planNodeDependencies({ ...pkg, packageManager: 'pnpm@10.0.0' }, lock), /npm/);
  assert.throws(
    () =>
      planNodeDependencies(
        {
          ...pkg,
          dependencies: { 'bad/name!': 'latest' },
        },
        lock,
      ),
    /Invalid dependency/,
  );
});

test('M2 supports no-build one-package Node apps without inferring live ownership', () => {
  const { pkg, lock } = fixture();
  const plan = planNodeDependencies({ ...pkg, scripts: { start: 'node server.mjs' } }, lock);
  assert.equal(plan.commands.build, null);
  assert.equal(plan.packageName, 'owned-node-demo');
  assert.equal(Object.hasOwn(plan, 'service'), false);
});
