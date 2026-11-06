/** Fixed, privately imported Samsung PhotoMap instance. Never a discovery or shell API. */
export const OWNED_PHOTOMAP_ID = 'photomap-test' as const;
export const OWNED_PHOTOMAP_PORT = 8010 as const;

export type PhotoMapProcessState = 'disabled' | 'stopped' | 'running' | 'unknown';

export interface PhotoMapRuntimeSnapshot {
  version: 1;
  id: typeof OWNED_PHOTOMAP_ID;
  ownership: 'pockethost' | 'none';
  sourceRelease: string | null;
  runtimeVersion: string | null;
  state: PhotoMapProcessState;
  port: typeof OWNED_PHOTOMAP_PORT;
  autostart: false;
  manualStartAllowed: boolean;
  healthy: boolean | null;
}

export interface PhotoMapRuntimePort {
  inspect(): PhotoMapRuntimeSnapshot;
  start(): Promise<PhotoMapRuntimeSnapshot>;
  stop(): Promise<PhotoMapRuntimeSnapshot>;
  health(): Promise<boolean>;
  readLogs(): ReadonlyArray<string>;
}
