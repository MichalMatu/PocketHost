import { safeStopEvidence } from './managed-process-guards.ts';

export interface StopObservations {
  leaderExited: boolean;
  portReleased: boolean;
  descendantsExited: boolean;
}

/**
 * App-neutral, fail-closed lifecycle supervision.
 * The caller must provide an already verified owned identity and exclusively
 * scoped host probes. This function never discovers or signals arbitrary PIDs.
 */
export async function stopOwnedProcessSafely(effects: {
  verifyOwnership: () => boolean;
  signalOwnedLeader: () => void;
  observe: () => Promise<StopObservations>;
  pause: () => Promise<void>;
  maxPolls?: number;
}): Promise<void> {
  if (!effects.verifyOwnership()) throw new Error('Unverified owned process: stop denied');
  const polls = effects.maxPolls ?? 40;
  if (!Number.isSafeInteger(polls) || polls < 1 || polls > 100) {
    throw new RangeError('Invalid bounded stop polls');
  }
  effects.signalOwnedLeader(); // Exactly once, after identity verification.
  for (let i = 0; i < polls; i++) {
    if (safeStopEvidence(await effects.observe())) return;
    if (i < polls - 1) await effects.pause();
  }
  throw new Error('Owned process stop uncertain: marker must be retained');
}

/** A launch can only begin with explicit ownership and an uncontended loopback port. */
export async function admitOwnedStart(effects: {
  approved: () => boolean;
  noUnresolvedMarker: () => boolean;
  portFree: () => Promise<boolean>;
}): Promise<void> {
  if (!effects.approved()) throw new Error('Runtime launch is not approved');
  if (!effects.noUnresolvedMarker()) throw new Error('Unresolved process marker: launch denied');
  if (!(await effects.portFree())) throw new Error('Owned port is already occupied');
}

/**
 * A failed health check cannot silently become successful just because the
 * leader launched. After deadline, leave cleanup decisions to the owned adapter.
 */
export async function awaitOwnedReadiness(effects: {
  identityMatches: () => boolean;
  health: () => Promise<boolean>;
  pause: () => Promise<void>;
  maxPolls?: number;
}): Promise<void> {
  const polls = effects.maxPolls ?? 45;
  if (!Number.isSafeInteger(polls) || polls < 1 || polls > 100) {
    throw new RangeError('Invalid bounded start polls');
  }
  for (let i = 0; i < polls; i++) {
    if (!effects.identityMatches()) throw new Error('Launched process identity mismatch');
    if (await effects.health()) return;
    if (i < polls - 1) await effects.pause();
  }
  throw new Error('Owned runtime health timeout');
}
