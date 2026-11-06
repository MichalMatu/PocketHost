/** Fixed, private P4 managed project catalog contract. No runtime command input. */
export const MANAGED_PHOTOMAP_ID = 'photomap-test' as const;

export interface ManagedProjectSnapshot {
  version: 1;
  id: typeof MANAGED_PHOTOMAP_ID;
  label: 'PhotoMap TEST';
  ownership: 'none' | 'pockethost';
  importState: 'absent' | 'verified-copy';
  runtimeState: 'disabled' | 'unknown';
  release: string | null;
  port: 8010;
  tools: ReadonlyArray<{
    name: 'node' | 'npm' | 'git' | 'python3' | 'proot' | 'proot-distro';
    state: 'available' | 'unavailable';
    version: string | null;
  }>;
  lockfiles: ReadonlyArray<{ path: string; sha256: string }>;
  data: {
    databaseBytes: number;
    privateMediaFiles: number;
    publicMediaFiles: number;
  } | null;
  dependencies: {
    prootEnvironment: 'external-unfrozen';
    isolatedRollback: false;
  } | null;
  capabilities: {
    startStop: false;
    packages: false;
    rollback: false;
  };
}

/** Future managed runtime implementations must implement this explicit port. */
export interface ManagedProjectPort {
  inspect(): ManagedProjectSnapshot;
}
