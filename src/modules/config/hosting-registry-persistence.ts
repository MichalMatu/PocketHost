import type { HostingDeclarations } from '../../shared/hosting-platform.ts';
import type { HostingRegistryStorage } from '../../shared/hosting-registry-storage.ts';
import { createHostingRegistries } from './hosting-registry.ts';

const EMPTY: HostingDeclarations = { schemaVersion: 1, modules: [], services: [], projects: [] };
const MAX_BYTES = 256 * 1024;

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Invalid persisted hosting registry');
  }
  return value as Record<string, unknown>;
}

function validated(value: unknown, reserved: ReadonlyArray<number>): HostingDeclarations {
  const registry = createHostingRegistries(value, reserved);
  return {
    schemaVersion: 1,
    modules: registry.modules(),
    services: registry.services(),
    projects: registry.projects(),
  };
}

/**
 * Opens a declarative snapshot, never an executable runtime. An old
 * bare schemaVersion=1 declaration is migrated only by explicit commit.
 * Compare-and-swap prevents stale writers from overwriting new state.
 */
export function openHostingRegistry(
  storage: HostingRegistryStorage,
  reservedPorts: ReadonlyArray<number> = [],
): {
  revision: number;
  declarations: HostingDeclarations;
  commit(next: unknown): { revision: number; declarations: HostingDeclarations };
} {
  const reserved = [...reservedPorts];
  const raw = storage.read();
  if (raw !== null && Buffer.byteLength(raw, 'utf8') > MAX_BYTES) {
    throw new Error('Persisted registry exceeds size limit');
  }
  let revision = 0;
  let candidate: unknown = EMPTY;
  if (raw !== null) {
    const parsed = object(JSON.parse(raw) as unknown);
    if (Object.hasOwn(parsed, 'storageVersion')) {
      if (
        Object.keys(parsed).length !== 3 ||
        !['storageVersion', 'revision', 'declarations'].every((key) => Object.hasOwn(parsed, key))
      ) {
        throw new Error('Unexpected persisted registry fields');
      }
      if (parsed.storageVersion !== 1) throw new Error('Unsupported registry storage version');
      if (
        !Number.isSafeInteger(parsed.revision) ||
        (parsed.revision as number) < 1 ||
        (parsed.revision as number) >= Number.MAX_SAFE_INTEGER
      ) {
        throw new Error('Invalid registry revision');
      }
      revision = parsed.revision as number;
      candidate = parsed.declarations;
    } else {
      candidate = parsed;
    }
  }
  const declarations = validated(candidate, reserved);
  return {
    revision,
    declarations: structuredClone(declarations),
    commit(next: unknown) {
      const checked = validated(next, reserved);
      const serialized =
        JSON.stringify({ storageVersion: 1, revision: revision + 1, declarations: checked }) + '\n';
      if (Buffer.byteLength(serialized, 'utf8') > MAX_BYTES) {
        throw new Error('Persisted registry exceeds size limit');
      }
      storage.compareAndSwap(raw, serialized);
      return { revision: revision + 1, declarations: structuredClone(checked) };
    },
  };
}
