import type { HeartbeatReadback } from './worker-heartbeat-policy.ts';

/** Runit registry, health and lifecycle contracts; no runtime operations. */
export type WorkerTemplate =
  'heartbeat-worker-v1' | 'python-heartbeat-v1' | 'python-source-v1' | 'node-source-v1';
export type StagedWorkerTemplate = 'python-source-v1' | 'node-source-v1';
export type FixedWorkerTemplate = Exclude<WorkerTemplate, StagedWorkerTemplate>;

export interface Registration {
  name: string;
  target: string;
  addedAt: string;
  /** Missing only for pre-S1 legacy entries: these are read-only. */
  runSha256?: string;
}
export interface ArchivedWorker {
  name: string;
  target: string;
  template: WorkerTemplate;
  instanceId: string;
  runSha256: string;
  sourceSha256?: string;
  archivedAt: string;
}
export interface ArchivedWorkerSummary {
  name: string;
  template: WorkerTemplate;
  identity: 'restorable' | 'changed' | 'conflict';
}
export type ServiceIdentity =
  'verified' | 'unregistered' | 'legacy' | 'changed' | 'archive-conflict' | 'reserved';
export type ServiceIdentityReason =
  | 'run-sha-attested'
  | 'no-enrollment'
  | 'legacy-without-sha'
  | 'service-target-changed'
  | 'service-not-published'
  | 'worker-provenance-changed'
  | 'run-script-changed'
  | 'archive-live-conflict'
  | 'reserved-system-service';
export type ServiceOperation =
  'register' | 'unregister' | 'start' | 'stop' | 'restart' | 'once' | 'enable' | 'disable';
export interface RecoveryAttemptRecord {
  name: string;
  instanceId: string;
  /** Sorted timestamps; enforce a true rolling-hour budget. */
  attemptedAtMs: number[];
}
export interface RunitRecoveryReview {
  name: string;
  template: WorkerTemplate;
  observed: 'running' | 'stopped' | 'unknown';
  readiness: 'not-verified';
  action: 'start' | 'none' | 'blocked';
  reason: string;
  attempts: number;
  maxAttempts: number;
  nextEligibleAt: string | null;
  windowEndsAt: string | null;
  checkedAt: string;
}
export interface RunitProcessObservation {
  /** PID and start ticks are evidence only, not source or app readiness. */
  status: 'observed' | 'stopped' | 'unverified';
  pid: number | null;
  uptimeSeconds: number | null;
  startTicks: string | null;
}
export interface RunitHealthReadback {
  name: string;
  identity: 'verified';
  observed: 'running' | 'stopped' | 'unknown';
  /** Runit process liveness does not confer application readiness. */
  readiness: 'not-verified';
  process: RunitProcessObservation;
  heartbeat: HeartbeatReadback;
  autostart: boolean | null;
  logEvidence: 'log-write' | 'no-log' | 'untrusted';
  lastLogWriteAt: string | null;
  checkedAt: string;
}
export interface WorkerHealthOverview {
  checkedAt: string;
  blockedRegistrations: number;
  truncated: boolean;
  rows: Array<
    | { name: string; template: WorkerTemplate; status: 'observed'; health: RunitHealthReadback }
    | { name: string; template: WorkerTemplate; status: 'unavailable' }
  >;
}
export interface TermuxService {
  name: string;
  registered: boolean;
  protected: boolean;
  identity: ServiceIdentity;
  /** Diagnostic only; never grants lifecycle authority. */
  identityReason: ServiceIdentityReason;
  /** Only the fully attested built-in template grants archive capability. */
  template?: WorkerTemplate;
  /** Generic H3 controls never mutate units owned by a separate provisioner. */
  control: 'standalone' | 'delegated' | 'read-only';
  state: 'running' | 'stopped' | 'unknown';
  enabled?: boolean | null;
}

