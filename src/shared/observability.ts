/** Pure, versioned read-only O1 contracts; never authorize lifecycle operations. */
export type ReadingState = 'ok' | 'unavailable' | 'permission-denied' | 'stale';
export interface Reading<T> {
  state: ReadingState;
  value: T | null;
  observedAt: string;
}
export interface ProcessObservation {
  pid: number;
  ppid: number;
  startTicks: string;
  cpuTicks: number;
  rssMiB: number | null;
  ownership: 'self' | 'unverified';
}
export interface ProcessInventory {
  state: ReadingState;
  observedAt: string;
  partial: true;
  truncated: boolean;
  processes: ProcessObservation[];
}
export interface PackageEntry {
  name: string;
  version: string;
  ecosystem: 'termux' | 'node' | 'python';
}
export interface PackageInventory {
  state: ReadingState;
  observedAt: string;
  installed: PackageEntry[];
  truncated: boolean;
  updates: { state: 'unknown' | 'cached-unverified'; candidates: string[] };
}
export interface HostMetrics {
  cpuPercent: Reading<number>;
  batteryPercent: Reading<number>;
  network: Reading<{ rxBytes: number; txBytes: number }>;
}
export interface O1HistoryPoint {
  observedAt: string;
  cpuPercent: number | null;
  freeMemoryMiB: number;
}
export interface O1Event {
  timestamp: string;
  instanceId: string;
  code: string;
}
export interface O1Snapshot {
  version: 1;
  mode: 'read-only';
  observedAt: string;
  host: {
    runtime: {
      totalMemoryMiB: number;
      freeMemoryMiB: number;
      storage: { totalMiB: number; availableMiB: number } | null;
    };
    services: {
      id: string;
      label: string;
      ownership: 'external';
      state: 'running' | 'stopped' | 'unknown';
    }[];
  };
  metrics: HostMetrics;
  processes: ProcessInventory;
  packages: PackageInventory;
  diagnostics: { state: ReadingState; events: O1Event[] };
  history: O1HistoryPoint[];
  alerts: string[];
}
