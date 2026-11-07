import {
  OWNED_DEMO_ID,
  type DemoVersion,
  type OwnedSitePort,
  type OwnedSiteSnapshot,
} from '../../shared/owned-site.ts';

export class SiteOwnershipError extends Error {
  constructor() {
    super('Only explicitly created PocketHost-owned sites can be managed');
    this.name = 'SiteOwnershipError';
  }
}

function requireOwned(snapshot: OwnedSiteSnapshot): OwnedSiteSnapshot {
  if (
    snapshot.id !== OWNED_DEMO_ID ||
    snapshot.ownership !== 'pockethost' ||
    snapshot.state === 'absent'
  ) {
    throw new SiteOwnershipError();
  }
  return snapshot;
}

/**
 * Typed P3 application port. Discovery NEVER implies lifecycle permission.
 * All read/write/launch side effects are delegated to the host adapter.
 */
export function createOwnedSiteRuntime(port: OwnedSitePort) {
  return {
    inspect: () => port.inspect(),
    create: () => {
      const current = port.inspect();
      if (current.state !== 'absent') return requireOwned(current);
      return requireOwned(port.create());
    },
    start: async () => {
      requireOwned(port.inspect());
      return requireOwned(await port.start());
    },
    stop: async () => {
      requireOwned(port.inspect());
      return requireOwned(await port.stop());
    },
    restart: async () => {
      const current = requireOwned(port.inspect());
      if (current.state !== 'running')
        throw new RangeError('Cannot restart an owned service that is not running');
      requireOwned(await port.stop());
      return requireOwned(await port.start());
    },
    publish: (version: DemoVersion) => {
      requireOwned(port.inspect());
      if (version !== 1 && version !== 2) throw new RangeError('Unsupported demo version');
      return requireOwned(port.publish(version));
    },
    rollback: () => {
      const current = requireOwned(port.inspect());
      if (!current.canRollback) throw new RangeError('No owned version available for rollback');
      return requireOwned(port.rollback());
    },
    logs: () => {
      requireOwned(port.inspect());
      return port.readLogs();
    },
  };
}
