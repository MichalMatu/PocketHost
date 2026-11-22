import test from 'node:test';
import assert from 'node:assert/strict';
import { scrollCaptureTargets } from '../../scripts/test-lab/scroll-capture-targets.mjs';

test('long documents plan at most one middle and one bottom viewport', () => {
  assert.deepEqual(scrollCaptureTargets(900, 900), { middle: null, bottom: null });
  assert.deepEqual(scrollCaptureTargets(1020, 900), { middle: null, bottom: null });
  assert.deepEqual(scrollCaptureTargets(1021, 900), { middle: null, bottom: 121 });
  assert.deepEqual(scrollCaptureTargets(1920, 900), { middle: null, bottom: 1020 });
  assert.deepEqual(scrollCaptureTargets(1921, 900), { middle: 511, bottom: 1021 });
  assert.deepEqual(scrollCaptureTargets(2900, 900), { middle: 1000, bottom: 2000 });
});

test('missing, non-finite and invalid sizes never schedule scroll captures', () => {
  for (const [height, viewport] of [[null, 900], [NaN, 900], [Infinity, 900],
    [1000, 0], [0, 900], [-1, 900], [1000, NaN], [1000, -2]]) {
    assert.deepEqual(scrollCaptureTargets(height, viewport), { middle: null, bottom: null });
  }
});
