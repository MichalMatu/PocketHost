export interface ShizukuBridgeStatus {
  version: 1;
  source: 'android-companion';
  connected: boolean;
  authorized: boolean;
  mode: 'none' | 'adb' | 'root';
  observedAt: string;
  cpuPercent: number | null;
  visibleProcesses: number | null;
  capabilities: Array<{ id: string; title: string; available: boolean; description: string }>;
}
export interface ShizukuBridgeApps {
  version: 1;
  source: 'android-companion';
  connected: true;
  authorized: true;
  mode: 'adb' | 'root';
  observedAt: string;
  packages: Array<{ packageName: string; system: boolean }>;
  truncated: boolean;
}
export interface ShizukuBridgeSystem {
  version: 1;
  source: 'android-companion';
  connected: true;
  authorized: true;
  mode: 'adb' | 'root';
  observedAt: string;
  processes: Array<{
    pid: number;
    name: string;
    user: string;
    rssKb: number | null;
    cpuPercent: number | null;
  }>;
  processesTruncated: boolean;
  processError?: string;
  power: {
    batteryLevel: number | null;
    charging: boolean | null;
    batteryTemperatureC: number | null;
    memoryTotalKb: number | null;
    memoryAvailableKb: number | null;
  };
  settings: { brightness: number | null; airplaneMode: boolean | null };
  services: { names: string[]; truncated: boolean; error?: string };
}
export function parseCompanionStatus(raw: string): ShizukuBridgeStatus;
export function parseCompanionApps(raw: string): ShizukuBridgeApps;
export function parseCompanionSystem(raw: string): ShizukuBridgeSystem;
export function readCompanionStatus(): Promise<ShizukuBridgeStatus>;
export function readCompanionApps(): Promise<ShizukuBridgeApps>;
export function readCompanionSystem(): Promise<ShizukuBridgeSystem>;
