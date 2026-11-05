import {
  OWNED_DEMO_ID,
  type OwnedSitePort,
  type OwnedSiteSnapshot,
} from "../../shared/owned-site.ts";

export class SiteOwnershipError extends Error {
  constructor() {
    super("Only explicitly created PocketHost-owned sites can be managed");
    this.name = "SiteOwnershipError";
  }
}

function requireOwned(snapshot: OwnedSiteSnapshot): OwnedSiteSnapshot {
  if (
    snapshot.id !== OWNED_DEMO_ID ||
    snapshot.ownership !== "pockethost" ||
    snapshot.state === "absent"
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
      if (current.state !== "absent") return requireOwned(current);
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
    publish: () => {
      requireOwned(port.inspect());
      return requireOwned(port.publish());
    },
    rollback: () => {
      const current = requireOwned(port.inspect());
      if (!current.canRollback) throw new RangeError("No owned version available for rollback");
      return requireOwned(port.rollback());
    },
    logs: () => {
      requireOwned(port.inspect());
      return port.readLogs();
    },
  };
}
