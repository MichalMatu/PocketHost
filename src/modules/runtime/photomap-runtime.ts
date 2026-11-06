import {
  OWNED_PHOTOMAP_ID,
  OWNED_PHOTOMAP_PORT,
  type PhotoMapRuntimePort,
  type PhotoMapRuntimeSnapshot,
} from '../../shared/photomap-runtime.ts';

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

function requireOwned(snapshot: PhotoMapRuntimeSnapshot): PhotoMapRuntimeSnapshot {
  if (
    snapshot.version !== 1 ||
    snapshot.id !== OWNED_PHOTOMAP_ID ||
    snapshot.port !== OWNED_PHOTOMAP_PORT ||
    snapshot.autostart !== false ||
    snapshot.ownership !== 'pockethost' ||
    snapshot.sourceRelease !== 'import-20261106' ||
    !['disabled', 'stopped', 'running', 'unknown'].includes(snapshot.state)
  ) {
    throw new PhotoMapOwnershipError();
  }
  return snapshot;
}

/** Pure policy layer: all filesystem, PRoot, process and network effects belong to host. */
export function createPhotoMapRuntime(port: PhotoMapRuntimePort) {
  return {
    inspect: () => requireOwned(port.inspect()),
    start: async () => {
      const current = requireOwned(port.inspect());
      if (
        !current.manualStartAllowed ||
        !current.runtimeVersion ||
        !/^[a-z0-9][a-z0-9-]{1,63}$/.test(current.runtimeVersion) ||
        current.state === 'disabled' ||
        current.state === 'unknown'
      ) {
        throw new PhotoMapRuntimeBlockedError();
      }
      if (current.state === 'running') return current;
      const next = requireOwned(await port.start());
      if (next.state !== 'running' || next.runtimeVersion !== current.runtimeVersion) {
        throw new PhotoMapRuntimeBlockedError();
      }
      return next;
    },
    stop: async () => {
      const current = requireOwned(port.inspect());
      if (current.state === 'unknown' || current.state === 'disabled') {
        throw new PhotoMapRuntimeBlockedError();
      }
      if (current.state === 'stopped') return current;
      const next = requireOwned(await port.stop());
      if (next.state !== 'stopped' || next.runtimeVersion !== current.runtimeVersion) {
        throw new PhotoMapRuntimeBlockedError();
      }
      return next;
    },
    health: async () => {
      const current = requireOwned(port.inspect());
      if (current.state !== 'running') return false;
      return port.health();
    },
    logs: () => {
      requireOwned(port.inspect());
      return port
        .readLogs()
        .slice(-40)
        .map((line) =>
          line
            .replace(/(bearer\\s+)\\S+/gi, '$1[redacted]')
            .replace(/(token|password|secret)\\s*[:=]\\s*\\S+/gi, '$1=[redacted]')
            .slice(0, 240),
        );
    },
  };
}
