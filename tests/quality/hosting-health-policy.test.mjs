import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateHealthPolicy } from '../../src/shared/hosting-health-policy.ts';
const policy = { readinessTimeoutMs: 10000, cooldownMs: 30000, maxAttempts: 3 };
const state = { desired: 'running', observed: 'stopped', ready: null, requestedAtMs: null,
  lastAttemptAtMs: null, attempts: 0, nowMs: 50000, owned: true, manuallyDisabled: false };
test('M2 health policy gives start eligibility but no OS operation', () => {
  assert.deepEqual(evaluateHealthPolicy(policy, state), {
    action: 'start', reason: 'reviewed-start-eligible', nextEligibleAtMs: null,
  });
  assert.equal(evaluateHealthPolicy(policy, { ...state, observed: 'running', ready: true }).action, 'none');
  assert.equal(evaluateHealthPolicy(policy, { ...state, observed: 'running', ready: null }).action, 'probe');
});
test('M2 manual disable, unknown ownership and unknown process always fail closed', () => {
  assert.equal(evaluateHealthPolicy(policy, { ...state, manuallyDisabled: true }).reason, 'manual-stop-wins');
  assert.equal(evaluateHealthPolicy(policy, { ...state, desired: 'stopped' }).action, 'none');
  assert.equal(evaluateHealthPolicy(policy, { ...state, owned: false }).action, 'blocked');
  assert.equal(evaluateHealthPolicy(policy, { ...state, observed: 'unknown' }).action, 'blocked');
});
test('M2 retry budget and cooldown never trigger automatic unowned actions', () => {
  assert.equal(evaluateHealthPolicy(policy, { ...state, attempts: 3 }).reason, 'retry-budget-exhausted');
  assert.deepEqual(evaluateHealthPolicy(policy, { ...state, attempts: 1, lastAttemptAtMs: 30000 }), {
    action: 'none', reason: 'cooldown', nextEligibleAtMs: 60000,
  });
  assert.equal(evaluateHealthPolicy(policy, { ...state, observed: 'running', ready: false,
    requestedAtMs: 45000 }).action, 'probe');
  assert.equal(evaluateHealthPolicy(policy, { ...state, observed: 'running', ready: false,
    requestedAtMs: 30000 }).action, 'timeout');
});
test('M2 invalid policies and impossible observation times are rejected', () => {
  assert.throws(() => evaluateHealthPolicy({ ...policy, maxAttempts: 0 }, state), /Invalid/);
  assert.throws(() => evaluateHealthPolicy(policy, { ...state, lastAttemptAtMs: 60000 }), /Invalid/);
});
