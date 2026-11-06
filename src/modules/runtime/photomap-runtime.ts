import {
  OWNED_PHOTOMAP_ID,
  OWNED_PHOTOMAP_PORT,
  type PhotoMapRuntimePort,
} from '../../shared/photomap-runtime.ts';
import { createManagedRuntime } from './managed-runtime.ts';

export class PhotoMapOwnershipError extends Error {
  constructor() {
    super('PhotoMap runtime operation requires verified PocketHost ownership');
    this.name = 'PhotoMapOwnershipError';
  }
}

export class PhotoMapRuntimeBlockedError extends Error {
  constructor() {
    super('PhotoMap runtime is not approved for manual lifecycle control');
    this.name = 'PhotoMapRuntimeBlockedError';
  }
}

/** PhotoMap supplies an identity and error vocabulary, never the lifecycle engine. */
export function createPhotoMapRuntime(port: PhotoMapRuntimePort) {
  return createManagedRuntime(
    port,
    { id: OWNED_PHOTOMAP_ID, port: OWNED_PHOTOMAP_PORT, sourceRelease: 'import-20261106' },
    { ownership: PhotoMapOwnershipError, blocked: PhotoMapRuntimeBlockedError },
  );
}
