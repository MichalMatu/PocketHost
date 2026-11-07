import type {
  ManagedRuntimeIdentity,
  ManagedRuntimePort,
  ManagedRuntimeSnapshot,
} from '../../shared/managed-runtime.ts';
import { createManagedRuntime } from './managed-runtime.ts';

export interface ManagedRuntimeRegistration {
  identity: Readonly<ManagedRuntimeIdentity>;
  port: ManagedRuntimePort<ManagedRuntimeSnapshot>;
}

/**
 * No PhotoMap constants, process discovery, or shell. Only explicitly registered
 * PocketHost-owned adapters are available; ports and IDs must be unique.
 */
export function createManagedRuntimeRegistry(
  registrations: ReadonlyArray<ManagedRuntimeRegistration>,
) {
  const registry = new Map<string, ManagedRuntimeRegistration>();
  const usedPorts = new Set<number>();
  for (const entry of registrations) {
    const { id, port, sourceRelease } = entry.identity;
    if (
      !/^[a-z][a-z0-9-]{1,63}$/.test(id) ||
      !/^[a-z0-9][a-z0-9-]{1,63}$/.test(sourceRelease) ||
      !Number.isSafeInteger(port) ||
      port < 1024 ||
      port > 65535 ||
      registry.has(id) ||
      usedPorts.has(port)
    ) {
      throw new Error('Invalid or conflicting managed runtime registration');
    }
    registry.set(id, entry);
    usedPorts.add(port);
  }
  return {
    list: (): string[] => [...registry.keys()],
    resolve(id: string) {
      const item = registry.get(id);
      if (!item) throw new Error('Unregistered runtime: no control authority');
      return createManagedRuntime(item.port, item.identity);
    },
  };
}
