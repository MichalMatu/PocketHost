import assert from 'node:assert/strict';
import test from 'node:test';
import {
  parseReadyLine,
  runTermuxLifecycleProbe,
} from '../../scripts/prototype/s1-termux-node-lifecycle.mjs';

test('S1 rejects malformed, mismatched and out-of-range worker readiness', () => {
  const expected = JSON.stringify({ id: 'one', pid: 2345, port: 8080 });
  assert.deepEqual(parseReadyLine(expected, 'one', 2345), {
    id: 'one',
    pid: 2345,
    port: 8080,
  });
  for (const input of [
    'not-json',
    '{}',
    JSON.stringify({ id: 'two', pid: 2345, port: 8080 }),
    JSON.stringify({ id: 'one', pid: 9999, port: 8080 }),
    JSON.stringify({ id: 'one', pid: 2345, port: 0 }),
    JSON.stringify({ id: 'one', pid: 2345, port: 65536 }),
    JSON.stringify({ id: 'one', pid: 2345, port: '8080' }),
  ]) {
    assert.throws(() => parseReadyLine(input, 'one', 2345));
  }
});

test('S1 starts two owned Node children with isolated loopback sockets and recovers one', async () => {
  const result = await runTermuxLifecycleProbe();
  assert.equal(result.status, 'PASS');
  assert.equal(result.scope, 'CURRENT_TERMUX_SAME_UID_ONLY');
  assert.equal(result.androidApkIndependent, false);
  assert.equal(result.simultaneousNodeProcesses, 2);
  assert.equal(result.processesStarted, 3);
});
