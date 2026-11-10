export interface ShizukuBridgeStatus {
  version: 1;
  source: 'android-companion';
  connected: boolean;
  authorized: boolean;
  mode: 'none' | 'adb' | 'root';
  observedAt: string;
  cpuPercent: number | null;
  visibleProcesses: number | null;
  /** Optional for older installed Companion APKs. Device-wide totals since Android boot. */
  network?: {
    source: 'android-trafficstats';
    scope: 'all-interfaces-since-boot';
    observedAt: string;
    rxBytes: number | null;
    txBytes: number | null;
  };
  capabilities: Array<{ id: string; title: string; available: boolean; description: string }>;
}
export interface ShizukuBridgeApps {
  version: 1;
  source: 'android-companion';
  connected: true;
  authorized: true;
  mode: 'adb' | 'root';
  observedAt: string;
  packages: Array<{ packageName: string; system: boolean; label: string; enabled: boolean | null }>;
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

export interface ShizukuBridgeApp {
  version: 1;
  source: 'android-companion';
  packageName: string;
  label: string;
  versionName: string;
  versionCode: number;
  targetSdk: number;
  system: boolean;
  enabled: boolean;
  permissions: Array<{ name: string; granted: boolean }>;
  iconPng?: string;
}
export function parseCompanionApp(raw: string): ShizukuBridgeApp;
export function readCompanionApp(packageName: string): Promise<ShizukuBridgeApp>;
