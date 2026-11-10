import { randomUUID } from 'node:crypto';
import { lstatSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readHostSnapshot } from './host-snapshot.ts';
import { readCompanionStatus } from './shizuku-companion.mjs';
import { probeInternetConnectivity } from './internet-connectivity.ts';

export const DASHBOARD_INTERVAL_MS = 60_000;
export const DASHBOARD_MAX_POINTS = 1440;
const MAX_FILE_BYTES = 1024 * 1024;
const MAX_FUTURE_MS = 60_000;
const WINDOW_MS = 24 * 60 * 60 * 1000;
const FIELDS = ['observedAt', 'cpu', 'ram', 'internetMs', 'internetFailed', 'bridgeMs',
  'bridgeOnline', 'servicesRunning', 'servicesTotal', 'storageAvailableMiB', 'systemUptimeSeconds'] as const;

export type DashboardTelemetryPoint = {
  observedAt: string;
  cpu: number | null;
  ram: number | null;
  internetMs: number | null;
  internetFailed: boolean | null;
  bridgeMs: number | null;
  bridgeOnline: boolean | null;
  servicesRunning: number | null;
  servicesTotal: number | null;
  storageAvailableMiB: number | null;
  systemUptimeSeconds: number | null;
};

function validNumber(v: unknown, max: number): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= max;
}
function validOptional(v: unknown, max: number): boolean {
  return v === null || validNumber(v, max);
}
export function validateDashboardPoint(value: unknown, now = Date.now(), allowHistorical = false): value is DashboardTelemetryPoint {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  if (Object.keys(v).sort().join('|') !== [...FIELDS].sort().join('|')) return false;
  const at = typeof v.observedAt === 'string' ? Date.parse(v.observedAt) : NaN;
  if (!Number.isFinite(at) || (!allowHistorical && at < now - WINDOW_MS) || at > now + MAX_FUTURE_MS ||
    typeof v.observedAt !== 'string' || v.observedAt.length > 35) return false;
  if (!validOptional(v.cpu, 100) || !validOptional(v.ram, 100) ||
    !validOptional(v.internetMs, 15000) || !validOptional(v.bridgeMs, 15000) ||
    !validOptional(v.storageAvailableMiB, 100000000) ||
    !validOptional(v.systemUptimeSeconds, Number.MAX_SAFE_INTEGER)) return false;
  if (![null, true, false].includes(v.internetFailed as boolean | null) ||
    ![null, true, false].includes(v.bridgeOnline as boolean | null)) return false;
  if (!validOptional(v.servicesRunning, 100) || !validOptional(v.servicesTotal, 100)) return false;
  if (v.servicesRunning !== null && v.servicesTotal !== null &&
    (v.servicesRunning as number) > (v.servicesTotal as number)) return false;
  if (v.internetFailed === true && v.internetMs !== null) return false;
  if (v.internetFailed === null && v.internetMs !== null) return false;
  return true;
}

function privateParent(file: string): void {
  const folder = path.dirname(file);
  mkdirSync(folder, { recursive: true, mode: 0o700 });
  const stat = lstatSync(folder);
  if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error('Unsafe dashboard state directory');
}
function privateFile(file: string): boolean {
  try {
    const stat = lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > MAX_FILE_BYTES)
      throw new Error('Unsafe dashboard history file');
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw error;
  }
}

export function parseDashboardHistoryRoute(url: string): '1h' | '24h' | null {
  try {
    const target = new URL(url, 'http://127.0.0.1');
    if (target.pathname !== '/' || target.searchParams.size > 1 ||
      (target.searchParams.size === 1 && !target.searchParams.has('range'))) return null;
    const range = target.searchParams.get('range') ?? '1h';
    return range === '1h' || range === '24h' ? range : null;
  } catch {
    return null;
  }
}

/** Host-owned bounded history. Invalid on-disk state is never overwritten automatically. */
export class DashboardHistoryStore {
  private points: DashboardTelemetryPoint[] = [];
  private lastSavedAt = 0;
  private readState: 'ok' | 'unavailable' = 'ok';
  private readonly file: string;
  private readonly now: () => number;

  constructor(
    file = path.join(os.homedir(), '.local/state/pockethost/dashboard-telemetry-v1.json'),
    now: () => number = Date.now,
  ) {
    this.file = file;
    this.now = now;
    try {
      privateParent(file);
      if (privateFile(file)) {
        const value: unknown = JSON.parse(readFileSync(file, 'utf8'));
        if (!value || typeof value !== 'object' || Array.isArray(value) ||
          Object.keys(value).sort().join('|') !== 'points|version' ||
          (value as { version?: unknown }).version !== 1 ||
          !Array.isArray((value as { points?: unknown }).points) ||
          (value as { points: unknown[] }).points.length > DASHBOARD_MAX_POINTS) {
          throw new Error('Invalid history document');
        }
        const loaded = (value as { points: unknown[] }).points;
        if (!loaded.every((p) => validateDashboardPoint(p, this.now(), true)))
          throw new Error('Invalid history sample');
        this.points = (loaded as DashboardTelemetryPoint[]).filter(p =>
          Date.parse(p.observedAt) >= this.now() - WINDOW_MS,
        );
      }
    } catch {
      this.readState = 'unavailable';
      this.points = [];
    }
  }

  append(point: DashboardTelemetryPoint): boolean {
    if (this.readState !== 'ok' || !validateDashboardPoint(point, this.now())) return false;
    const time = Date.parse(point.observedAt);
    if (this.points.length && time <= Date.parse(this.points[this.points.length - 1]!.observedAt))
      return false;
    this.points = [...this.points, point]
      .filter(item => Date.parse(item.observedAt) >= this.now() - WINDOW_MS)
      .slice(-DASHBOARD_MAX_POINTS);
    if (this.lastSavedAt === 0 || this.now() - this.lastSavedAt >= 5 * DASHBOARD_INTERVAL_MS)
      this.flush();
    return true;
  }

  flush(): void {
    if (this.readState !== 'ok') return;
    let temporary: string | null = null;
    try {
      privateParent(this.file);
      privateFile(this.file);
      temporary = path.join(path.dirname(this.file), '.dashboard-history-' + randomUUID());
      const content = JSON.stringify({ version: 1, points: this.points }) + '\n';
      if (Buffer.byteLength(content) > MAX_FILE_BYTES) throw new Error('Dashboard history cap exceeded');
      writeFileSync(temporary, content, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
      renameSync(temporary, this.file);
      this.lastSavedAt = this.now();
    } catch {
      this.readState = 'unavailable';
      if (temporary) {
        try { unlinkSync(temporary); } catch { /* no host state changes outside owned temp */ }
      }
    }
  }

  history(range: '1h' | '24h' = '1h') {
    const since = this.now() - (range === '24h' ? WINDOW_MS : 60 * 60 * 1000);
    return {
      version: 1 as const, source: 'pockethost-collector' as const,
      state: this.readState, intervalSeconds: 60 as const, retentionHours: 24 as const,
      samples: this.points.filter(p => Date.parse(p.observedAt) >= since).map(p => ({ ...p })),
    };
  }
}

export async function observeDashboardTelemetry(
  readHost: typeof readHostSnapshot = readHostSnapshot,
  readBridge: typeof readCompanionStatus = readCompanionStatus,
  readInternet: typeof probeInternetConnectivity = probeInternetConnectivity,
  now: () => number = Date.now,
): Promise<DashboardTelemetryPoint> {
  const at = new Date(now()).toISOString();
  let host: ReturnType<typeof readHostSnapshot> | null = null;
  try { host = readHost(); } catch { /* no fabricated values */ }
  const measuredBridge = async () => {
    const started = performance.now();
    const status = await readBridge();
    return { status, ms: Math.max(0, Math.round(performance.now() - started)) };
  };
  const [bridgeResult, internetResult] = await Promise.allSettled([measuredBridge(), readInternet()]);
  const bridgeMs = bridgeResult.status === 'fulfilled' ? bridgeResult.value.ms : null;
  const bridge = bridgeResult.status === 'fulfilled' ? bridgeResult.value.status : null;
  const internet = internetResult.status === 'fulfilled' ? internetResult.value : null;
  const cpuAge = bridge ? now() - Date.parse(bridge.observedAt) : Infinity;
  const cpu = bridge?.connected && bridge?.authorized && typeof bridge?.cpuPercent === 'number'
    && cpuAge >= 0 && cpuAge <= 45000 ? bridge.cpuPercent : null;
  const total = host?.runtime.totalMemoryMiB ?? 0;
  const ram = total > 0
    ? Math.round(1000 * (total - host!.runtime.freeMemoryMiB) / total) / 10 : null;
  return {
    observedAt: at,
    cpu, ram,
    internetMs: internet?.state === 'reachable' ? internet.latencyMs : null,
    internetFailed: internet ? internet.state === 'unreachable' : null,
    bridgeMs, bridgeOnline: bridge ? bridge.connected : null,
    servicesRunning: host ? host.services.filter(s => s.state === 'running').length : null,
    servicesTotal: host?.services.length ?? null,
    storageAvailableMiB: host?.runtime.storage?.availableMiB ?? null,
    systemUptimeSeconds: host?.runtime.systemUptimeSeconds ?? null,
  };
}

/** Reuse the already runit-owned DEV panel; no new service or process. */
export class DashboardTelemetryRecorder {
  readonly store: DashboardHistoryStore;
  private timer: ReturnType<typeof setInterval> | null = null;
  private busy = false;
  constructor(store = new DashboardHistoryStore()) { this.store = store; }

  async sample(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try { this.store.append(await observeDashboardTelemetry()); }
    catch { /* sampling failure is never a command or service mutation */ }
    finally { this.busy = false; }
  }
  start(): void {
    if (this.timer) return;
    void this.sample();
    this.timer = setInterval(() => { void this.sample(); }, DASHBOARD_INTERVAL_MS);
    this.timer.unref?.();
  }
  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.store.flush();
  }
}
