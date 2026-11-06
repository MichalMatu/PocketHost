import type {
  ManagedRuntimeIdentity,
  ManagedRuntimePort,
  ManagedRuntimeSnapshot,
} from '../../shared/managed-runtime.ts';

const VERSION = /^[a-z0-9][a-z0-9-]{1,63}$/;
const STATES = new Set(['disabled', 'stopped', 'running', 'unknown']);

export class ManagedRuntimeOwnershipError extends Error {
  constructor() {
    super('Runtime operation requires a verified PocketHost-owned instance');
    this.name = 'ManagedRuntimeOwnershipError';
  }
}

export class ManagedRuntimeBlockedError extends Error {
  constructor() {
    super('Runtime is not approved for this manual operation');
    this.name = 'ManagedRuntimeBlockedError';
  }
}

export interface ManagedRuntimeErrors {
  ownership: new () => Error;
  blocked: new () => Error;
}

/** Application-neutral state machine. Host effects live exclusively behind the port. */
export function createManagedRuntime<T extends ManagedRuntimeSnapshot>(
  port: ManagedRuntimePort<T>,
  expected: Readonly<ManagedRuntimeIdentity>,
  errors: ManagedRuntimeErrors = {
    ownership: ManagedRuntimeOwnershipError,
    blocked: ManagedRuntimeBlockedError,
  },
) {
  function owned(snapshot: T): T {
    if (
      !snapshot ||
      snapshot.version !== 1 ||
      snapshot.id !== expected.id ||
      snapshot.port !== expected.port ||
      snapshot.sourceRelease !== expected.sourceRelease ||
      snapshot.autostart !== false ||
      snapshot.ownership !== 'pockethost' ||
      !STATES.has(snapshot.state) ||
      typeof snapshot.manualStartAllowed !== 'boolean'
    ) {
      throw new errors.ownership();
    }
    return snapshot;
  }

  return {
    inspect: () => owned(port.inspect()),
    start: async (): Promise<T> => {
      const current = owned(port.inspect());
      if (
        !current.manualStartAllowed ||
        typeof current.runtimeVersion !== 'string' ||
        !VERSION.test(current.runtimeVersion) ||
        current.state === 'disabled' ||
        current.state === 'unknown'
      ) {
        throw new errors.blocked();
      }
      if (current.state === 'running') return current;
      const next = owned(await port.start());
      if (next.state !== 'running' || next.runtimeVersion !== current.runtimeVersion) {
        throw new errors.blocked();
      }
      return next;
    },
    stop: async (): Promise<T> => {
      const current = owned(port.inspect());
      if (current.state === 'unknown' || current.state === 'disabled') {
        throw new errors.blocked();
      }
      if (current.state === 'stopped') return current;
      const next = owned(await port.stop());
      if (next.state !== 'stopped' || next.runtimeVersion !== current.runtimeVersion) {
        throw new errors.blocked();
      }
      return next;
    },
    health: async (): Promise<boolean> => {
      const current = owned(port.inspect());
      if (current.state !== 'running') return false;
      return port.health();
    },
    logs: (): string[] => {
      owned(port.inspect());
      return port
        .readLogs()
        .slice(-40)
        .map((line) =>
          line
            .replace(/(bearer\s+)\S+/gi, '$1[redacted]')
            .replace(/(token|password|secret)\s*[:=]\s*\S+/gi, '$1=[redacted]')
            .slice(0, 240),
        );
    },
  };
}
