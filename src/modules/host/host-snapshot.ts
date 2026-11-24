import { spawnSync } from 'node:child_process';
import { statfsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { TermuxServiceAdmin, type TermuxService } from './termux-service-admin.ts';
import { readRunitStates } from './termux-runit-process.ts';

// Host service inventory is discovered on this device, never configured with
// product-specific unit names, project names or customer domains.

export type ServiceState = 'running' | 'stopped' | 'unknown';

export interface StorageSnapshot {
  totalMiB: number;
  availableMiB: number;
}

export interface HostSnapshot {
  version: 1;
  mode: 'read-only';
  platform: 'termux';
  observedAt: string;
  runtime: {
    nodeVersion: string;
    architecture: string;
    systemUptimeSeconds: number;
    totalMemoryMiB: number;
    freeMemoryMiB: number;
    storage: StorageSnapshot | null;
  };
  services: Array<{
    id: string;
    label: string;
    ownership: 'external';
    state: ServiceState;
  }>;
}

const TERMUX_PREFIX = '/data/data/com.termux/files/usr';
const MAX_STATUS_OUTPUT = 2048;
const MIB = 1048576n;

export function parseRunitStatus(output: string | null | undefined): ServiceState {
  if (typeof output !== 'string') return 'unknown';
  if (output.startsWith('run: ')) return 'running';
  if (output.startsWith('down: ')) return 'stopped';
  return 'unknown';
}

/** A read-only, bounded status probe cannot accept paths or shell expressions.
 * Use the dynamic registry for discovery and only this fixed Termux runit root.
 */
export function probeServiceState(
  id: string,
  readStatus: (serviceName: string) => string | null = (name) => {
    try {
      const result = spawnSync(
        path.join(TERMUX_PREFIX, 'bin', 'sv'),
        ['status', path.join(TERMUX_PREFIX, 'var', 'service', name)],
        {
          encoding: 'utf8',
          shell: false,
          timeout: 1200,
          maxBuffer: MAX_STATUS_OUTPUT,
          stdio: ['ignore', 'pipe', 'ignore'],
        },
      );
      return typeof result.stdout === 'string' ? result.stdout.slice(0, MAX_STATUS_OUTPUT) : null;
    } catch {
      return null;
    }
  },
): ServiceState {
  if (!/^[a-z][a-z0-9-]{1,63}$/.test(id)) throw new RangeError('Invalid service identifier');
  return parseRunitStatus(readStatus(id));
}

/** Only the filesystem containing Termux home is inspected; no filenames or paths are emitted. */
export function readStorageSnapshot(
  readStats: () => { bsize: bigint; blocks: bigint; bavail: bigint } = () =>
    statfsSync(os.homedir(), { bigint: true }),
): StorageSnapshot | null {
  try {
    const { bsize, blocks, bavail } = readStats();
    if (bsize <= 0n || blocks < 0n || bavail < 0n || bavail > blocks) return null;
    const totalMiB = Number((bsize * blocks) / MIB);
    const availableMiB = Number((bsize * bavail) / MIB);
    if (!Number.isSafeInteger(totalMiB) || !Number.isSafeInteger(availableMiB)) return null;
    return { totalMiB, availableMiB };
  } catch {
    return null;
  }
}

/** Project read-only states in one batch; leave lifecycle inventory and probes unchanged. */
export function readSnapshotServices(
  readInventory: (probe: (name: string) => ServiceState) => TermuxService[] = (probe) =>
    new TermuxServiceAdmin().list(probe),
  readStates: (names: string[]) => Map<string, ServiceState> = (names) =>
    readRunitStates(path.join(TERMUX_PREFIX, 'var', 'service'), names),
): TermuxService[] {
  const observed = new Set<string>();
  const inventory = readInventory((name) => {
    observed.add(name);
    return 'unknown';
  });
  const states = readStates([...observed]);
  return inventory.map((service) => ({
    ...service,
    state: observed.has(service.name) ? (states.get(service.name) ?? 'unknown') : 'unknown',
  }));
}

/** Fixed read-only probes; no request data, shell fragments or secret values in output. */
export function readHostSnapshot(
  readServices: () => TermuxService[] = readSnapshotServices,
  observedAt: () => string = () => new Date().toISOString(),
  readStorage: () => StorageSnapshot | null = readStorageSnapshot,
): HostSnapshot {
  return {
    version: 1,
    mode: 'read-only',
    platform: 'termux',
    observedAt: observedAt(),
    runtime: {
      nodeVersion: process.version,
      architecture: process.arch,
      systemUptimeSeconds: Math.floor(os.uptime()),
      totalMemoryMiB: Math.floor(os.totalmem() / 1048576),
      freeMemoryMiB: Math.floor(os.freemem() / 1048576),
      storage: readStorage(),
    },
    services: readServices().map((service) => ({
      id: service.name,
      label: service.name,
      ownership: 'external' as const,
      state: service.state,
    })),
  };
}
