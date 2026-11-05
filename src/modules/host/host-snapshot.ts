import { spawnSync } from 'node:child_process';
import { statfsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

type ServiceScope = 'system' | 'local-agent';

/** Every entry is externally owned. A successful probe confers no management rights. */
export const SERVICE_CATALOG = [
  { id: 'ilestoi', label: 'IleStoi.pl', runit: 'wreckscanner', scope: 'system' },
  { id: 'tunnel', label: 'Cloudflare tunnel', runit: 'cloudflared', scope: 'system' },
  { id: 'ssh', label: 'SSH server', runit: 'sshd', scope: 'system' },
  { id: 'mqtt', label: 'MQTT broker', runit: 'mosquitto', scope: 'system' },
  {
    id: 'healthwatch',
    label: 'IleStoi healthwatch',
    runit: 'ilestoi-healthwatch',
    scope: 'system',
  },
  { id: 'local-agent', label: 'Termux Local Agent', runit: 'termux-agent', scope: 'local-agent' },
] as const satisfies ReadonlyArray<{
  id: string;
  label: string;
  runit: string;
  scope: ServiceScope;
}>;

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

/** Two audited locations; callers cannot choose an arbitrary filesystem path. */
function runApprovedSvStatus(serviceName: string, scope: ServiceScope): string | null {
  const binary = path.join(TERMUX_PREFIX, 'bin', 'sv');
  const servicePath =
    scope === 'local-agent'
      ? path.join(os.homedir(), '.local/state/local-agent/termux/runit/services/termux-agent')
      : path.join(TERMUX_PREFIX, 'var', 'service', serviceName);
  try {
    const result = spawnSync(binary, ['status', servicePath], {
      encoding: 'utf8',
      shell: false,
      timeout: 1200,
      maxBuffer: MAX_STATUS_OUTPUT,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return typeof result.stdout === 'string' ? result.stdout.slice(0, MAX_STATUS_OUTPUT) : null;
  } catch {
    return null;
  }
}

/** Unknown identifiers are rejected before any external command can execute. */
export function probeServiceState(
  id: string,
  readStatus: (serviceName: string, scope: ServiceScope) => string | null = runApprovedSvStatus,
): ServiceState {
  const service = SERVICE_CATALOG.find((item) => item.id === id);
  if (!service) throw new RangeError('Service is not on the inspection allowlist');
  return parseRunitStatus(readStatus(service.runit, service.scope));
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

/** Fixed read-only probes; no request data, shell fragments or secret values in output. */
export function readHostSnapshot(
  readState: (id: string) => ServiceState = probeServiceState,
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
    services: SERVICE_CATALOG.map((service) => ({
      id: service.id,
      label: service.label,
      ownership: 'external' as const,
      state: readState(service.id),
    })),
  };
}
