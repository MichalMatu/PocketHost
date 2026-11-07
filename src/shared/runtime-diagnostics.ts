/** Bounded structured diagnostics without host effects or sensitive arbitrary messages. */
export type RuntimeEventCode =
  | 'manual-start-requested'
  | 'manual-start-health-failed'
  | 'manual-stop-completed'
  | 'manual-stop-uncertain';

export interface RuntimeDiagnosticEvent {
  version: 1;
  timestamp: string;
  source: 'managed-runtime';
  instanceId: string;
  code: RuntimeEventCode;
}

const CODES = new Set<RuntimeEventCode>([
  'manual-start-requested',
  'manual-start-health-failed',
  'manual-stop-completed',
  'manual-stop-uncertain',
]);

export function formatRuntimeEvent(
  instanceId: string,
  code: RuntimeEventCode,
  at = new Date(),
): string {
  if (!/^[a-z][a-z0-9-]{1,63}$/.test(instanceId) || !CODES.has(code)) {
    throw new Error('Invalid managed runtime event');
  }
  return (
    JSON.stringify({
      version: 1,
      timestamp: at.toISOString(),
      source: 'managed-runtime',
      instanceId,
      code,
    } satisfies RuntimeDiagnosticEvent) + '\n'
  );
}

export function runtimeEventHistory(lines: ReadonlyArray<string>): RuntimeDiagnosticEvent[] {
  const events: RuntimeDiagnosticEvent[] = [];
  for (const line of lines.slice(-40)) {
    try {
      const value: unknown = JSON.parse(line);
      if (!value || Array.isArray(value) || typeof value !== 'object') continue;
      const data = value as Record<string, unknown>;
      if (
        data.version !== 1 ||
        data.source !== 'managed-runtime' ||
        typeof data.timestamp !== 'string' ||
        Number.isNaN(Date.parse(data.timestamp)) ||
        typeof data.instanceId !== 'string' ||
        !/^[a-z][a-z0-9-]{1,63}$/.test(data.instanceId) ||
        !CODES.has(data.code as RuntimeEventCode)
      ) {
        continue;
      }
      events.push({
        version: 1,
        timestamp: data.timestamp,
        source: 'managed-runtime',
        instanceId: data.instanceId,
        code: data.code as RuntimeEventCode,
      });
    } catch {
      // Legacy plaintext and malformed entries never become structured events.
    }
  }
  return events;
}

export type RecoveryPlan = 'no-action' | 'manual-evidence-review' | 'manual-marker-review';

/** Dry-run only: never signals processes, removes markers or performs automatic recovery. */
export function planRuntimeRecovery(snapshot: {
  ownership: 'pockethost' | 'external' | 'none';
  state: 'disabled' | 'stopped' | 'running' | 'unknown';
  markerPresent: boolean;
  descendantEvidenceComplete: boolean;
}): RecoveryPlan {
  if (snapshot.ownership !== 'pockethost') return 'manual-evidence-review';
  if (!snapshot.markerPresent && snapshot.state === 'stopped') return 'no-action';
  if (
    snapshot.markerPresent &&
    snapshot.state === 'stopped' &&
    snapshot.descendantEvidenceComplete
  ) {
    return 'manual-marker-review';
  }
  return 'manual-evidence-review';
}
