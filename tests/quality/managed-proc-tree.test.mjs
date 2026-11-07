import assert from 'node:assert/strict';
import test from 'node:test';
import {
  captureManagedDescendants,
  observedDescendantsExited,
} from '../../src/modules/host/managed-proc-tree.ts';

test('walks only the explicit leader child graph and records per-child start ticks', () => {
  const children = new Map([
    [42, '55 56'],
    [55, '60'],
    [56, ''],
    [60, ''],
  ]);
  const ticks = new Map([
    [55, '101'],
    [56, '102'],
    [60, '103'],
  ]);
  const result = captureManagedDescendants(
    42,
    (pid) => children.get(pid) ?? null,
    (pid) => ticks.get(pid) ?? null,
  );
  assert.deepEqual(result, [
    { pid: 55, startTicks: '101' },
    { pid: 56, startTicks: '102' },
    { pid: 60, startTicks: '103' },
  ]);
  assert.equal(
    observedDescendantsExited(result, (pid) => ticks.get(pid) ?? null),
    false,
  );
  assert.equal(
    observedDescendantsExited(result, () => null),
    true,
  );
});

test('unknown or malformed proc child evidence fails closed', () => {
  for (const change of [
    { root: 1, value: '' },
    { root: 42, value: null },
    { root: 42, value: '../another' },
    { root: 42, value: '42' },
    { root: 42, value: '55 55' },
    { root: 42, value: '0' },
  ]) {
    const x = captureManagedDescendants(
      change.root,
      () => change.value,
      () => '100',
    );
    assert.equal(x, null);
  }
  assert.equal(
    captureManagedDescendants(
      42,
      () => '55',
      () => null,
    ),
    null,
  );
  assert.equal(
    captureManagedDescendants(
      42,
      () => '55',
      () => '1',
      0,
    ),
    null,
  );
});

test('bounded walk rejects suspiciously large or looping process trees', () => {
  const out = captureManagedDescendants(
    42,
    (pid) => (pid === 42 ? '55 56' : ''),
    () => '1',
    1,
  );
  assert.equal(out, null);
});

test('PID reuse does not imply the originally observed descendant is still running', () => {
  const previously = [{ pid: 55, startTicks: '100' }];
  assert.equal(
    observedDescendantsExited(previously, () => '101'),
    true,
  );
  assert.equal(
    observedDescendantsExited(previously, () => '100'),
    false,
  );
  assert.equal(
    observedDescendantsExited([], () => '100'),
    true,
  );
});
