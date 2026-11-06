/** Generic, read-only state contract: adapters supply app-specific identity and execution. */
export type ManagedProcessState = 'disabled' | 'stopped' | 'running' | 'unknown';

export interface ManagedRuntimeSnapshot {
  version: 1;
  id: string;
  ownership: 'pockethost' | 'none';
  sourceRelease: string | null;
  runtimeVersion: string | null;
  state: ManagedProcessState;
  port: number;
  autostart: false;
  manualStartAllowed: boolean;
  healthy: boolean | null;
}

export interface ManagedRuntimeIdentity {
  id: string;
  port: number;
  sourceRelease: string;
}

export interface ManagedRuntimePort<T extends ManagedRuntimeSnapshot = ManagedRuntimeSnapshot> {
  inspect(): T;
  start(): Promise<T>;
  stop(): Promise<T>;
  health(): Promise<boolean>;
  readLogs(): ReadonlyArray<string>;
}
