import type { ManagedRuntimePort, ManagedRuntimeSnapshot } from './managed-runtime.ts';

/** Application-specific PhotoMap binding; the core runtime has no PhotoMap dependency. */
export const OWNED_PHOTOMAP_ID = 'photomap-test' as const;
export const OWNED_PHOTOMAP_PORT = 8010 as const;

export interface PhotoMapRuntimeSnapshot extends ManagedRuntimeSnapshot {
  id: typeof OWNED_PHOTOMAP_ID;
  port: typeof OWNED_PHOTOMAP_PORT;
}

export type PhotoMapRuntimePort = ManagedRuntimePort<PhotoMapRuntimeSnapshot>;
