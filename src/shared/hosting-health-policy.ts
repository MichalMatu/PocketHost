/** Pure M2 health decision. Execution belongs exclusively to the verified host adapter. */
export interface HealthPolicy {
  readinessTimeoutMs: number;
  cooldownMs: number;
  maxAttempts: number;
}
export interface HealthObservation {
  desired: 'running' | 'stopped';
  observed: 'running' | 'stopped' | 'unknown';
  ready: boolean | null;
  requestedAtMs: number | null;
  lastAttemptAtMs: number | null;
  attempts: number;
  nowMs: number;
  owned: boolean;
  manuallyDisabled: boolean;
}
export interface HealthDecision {
  action: 'none' | 'probe' | 'start' | 'timeout' | 'blocked';
  reason: string;
  nextEligibleAtMs: number | null;
}
export function evaluateHealthPolicy(
  policy: HealthPolicy,
  state: HealthObservation,
): HealthDecision {
  const times = [state.nowMs, state.requestedAtMs, state.lastAttemptAtMs];
  if (
    !Number.isSafeInteger(policy.readinessTimeoutMs) ||
    policy.readinessTimeoutMs < 100 ||
    policy.readinessTimeoutMs > 300000 ||
    !Number.isSafeInteger(policy.cooldownMs) ||
    policy.cooldownMs < 1000 ||
    policy.cooldownMs > 3600000 ||
    !Number.isSafeInteger(policy.maxAttempts) ||
    policy.maxAttempts < 1 ||
    policy.maxAttempts > 10 ||
    !Number.isSafeInteger(state.attempts) ||
    state.attempts < 0 ||
    times.some((value) => value !== null && (!Number.isSafeInteger(value) || value < 0)) ||
    (state.requestedAtMs !== null && state.requestedAtMs > state.nowMs) ||
    (state.lastAttemptAtMs !== null && state.lastAttemptAtMs > state.nowMs)
  ) {
    throw new RangeError('Invalid health policy or time observation');
  }
  const decide = (
    action: HealthDecision['action'],
    reason: string,
    nextEligibleAtMs: number | null = null,
  ): HealthDecision => ({ action, reason, nextEligibleAtMs });
  if (!state.owned) return decide('blocked', 'ownership-unverified');
  if (state.manuallyDisabled || state.desired === 'stopped')
    return decide('none', 'manual-stop-wins');
  if (state.observed === 'unknown') return decide('blocked', 'observed-state-unknown');
  if (state.observed === 'running' && state.ready === true) return decide('none', 'ready');
  if (state.observed === 'running' && state.ready === null)
    return decide('probe', 'readiness-check-required');
  if (
    state.observed === 'running' &&
    state.ready === false &&
    state.requestedAtMs !== null &&
    state.nowMs - state.requestedAtMs < policy.readinessTimeoutMs
  ) {
    return decide('probe', 'readiness-pending');
  }
  if (state.observed === 'running' && state.ready === false)
    return decide('timeout', 'readiness-expired');
  if (state.attempts >= policy.maxAttempts) return decide('blocked', 'retry-budget-exhausted');
  const next = state.lastAttemptAtMs === null ? 0 : state.lastAttemptAtMs + policy.cooldownMs;
  if (state.nowMs < next) return decide('none', 'cooldown', next);
  return decide('start', 'reviewed-start-eligible');
}
