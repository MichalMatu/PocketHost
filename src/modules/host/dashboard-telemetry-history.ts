import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { lookup } from 'node:dns/promises';
import { promisify } from 'node:util';
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
const EXTRA_FIELDS = ['batteryPercent', 'batteryCharging', 'batteryTempC', 'dnsMs', 'dnsFailed',
  'storageUsedPercent', 'serviceStates'] as const;
const SERVICE_IDS = ['ilestoi', 'tunnel', 'ssh', 'mqtt', 'healthwatch', 'local-agent'] as const;
type ServiceId = typeof SERVICE_IDS[number];
type ServiceState = 'running' | 'stopped' | 'unknown';
type ServiceStates = Partial<Record<ServiceId, ServiceState>>;
export type DashboardEventCode =
  'service-unavailable' | 'service-restored' | 'internet-down' | 'internet-restored' |
  'dns-down' | 'dns-restored' | 'bridge-down' | 'bridge-restored' | 'system-rebooted';
export type DashboardEvent = { observedAt: string; code: DashboardEventCode; service: ServiceId | null };
const EVENT_CODES = new Set<DashboardEventCode>([
  'service-unavailable','service-restored','internet-down','internet-restored',
  'dns-down','dns-restored','bridge-down','bridge-restored','system-rebooted',
]);

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
  batteryPercent?: number | null;
  batteryCharging?: boolean | null;
  batteryTempC?: number | null;
  dnsMs?: number | null;
  dnsFailed?: boolean | null;
  storageUsedPercent?: number | null;
  serviceStates?: ServiceStates | null;
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
  if (!FIELDS.every(k => Object.hasOwn(v, k)) ||
    !Object.keys(v).every(k =>
      (FIELDS as readonly string[]).includes(k) || (EXTRA_FIELDS as readonly string[]).includes(k))) return false;
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
  if (Object.hasOwn(v, 'batteryPercent') && !validOptional(v.batteryPercent, 100)) return false;
  if (Object.hasOwn(v, 'batteryCharging') && ![null,true,false].includes(v.batteryCharging as boolean | null)) return false;
  if (Object.hasOwn(v, 'batteryTempC') &&
    v.batteryTempC !== null && (typeof v.batteryTempC !== 'number' ||
    !Number.isFinite(v.batteryTempC) || v.batteryTempC < -30 || v.batteryTempC > 100)) return false;
  if (Object.hasOwn(v, 'dnsMs') && !validOptional(v.dnsMs, 15000)) return false;
  if (Object.hasOwn(v, 'dnsFailed') && ![null,true,false].includes(v.dnsFailed as boolean | null)) return false;
  if (v.dnsFailed === true && v.dnsMs != null) return false;
  if (Object.hasOwn(v, 'storageUsedPercent') && !validOptional(v.storageUsedPercent, 100)) return false;
  if (Object.hasOwn(v, 'serviceStates') && v.serviceStates !== null) {
    const states = v.serviceStates;
    if (!states || typeof states !== 'object' || Array.isArray(states)) return false;
    const entries = Object.entries(states);
    if (entries.length > SERVICE_IDS.length || entries.some(([id,state]) =>
      !(SERVICE_IDS as readonly string[]).includes(id) || !['running','stopped','unknown'].includes(String(state))))
      return false;
  }
  return true;
}

function validEvent(value: unknown, now: number, allowHistorical = false): value is DashboardEvent {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const v = value as Record<string,unknown>;
  if (Object.keys(v).sort().join('|') !== 'code|observedAt|service') return false;
  const time = typeof v.observedAt === 'string' ? Date.parse(v.observedAt) : NaN;
  return Number.isFinite(time) && (allowHistorical || time >= now - WINDOW_MS) &&
    time <= now + MAX_FUTURE_MS &&
    typeof v.observedAt === 'string' && v.observedAt.length <= 35 &&
    EVENT_CODES.has(v.code as DashboardEventCode) &&
    (v.service === null || (SERVICE_IDS as readonly string[]).includes(String(v.service))) &&
    ((String(v.code).startsWith('service-')) === (v.service !== null));
}

function deriveEvents(previous: DashboardTelemetryPoint, current: DashboardTelemetryPoint): DashboardEvent[] {
  const make = (code: DashboardEventCode, service: ServiceId | null = null): DashboardEvent =>
    ({ observedAt: current.observedAt, code, service });
  const events: DashboardEvent[] = [];
  for (const id of SERVICE_IDS) {
    const from = previous.serviceStates?.[id];
    const to = current.serviceStates?.[id];
    if (from && to && from !== to) {
      if (to === 'running') events.push(make('service-restored', id));
      else if (from === 'running') events.push(make('service-unavailable', id));
    }
  }
  for (const [before, after, down, up] of [
    [previous.internetFailed, current.internetFailed, 'internet-down', 'internet-restored'],
    [previous.dnsFailed, current.dnsFailed, 'dns-down', 'dns-restored'],
  ] as const) {
    if (before === false && after === true) events.push(make(down));
    if (before === true && after === false) events.push(make(up));
  }
  if (previous.bridgeOnline === true && current.bridgeOnline === false) events.push(make('bridge-down'));
  if (previous.bridgeOnline === false && current.bridgeOnline === true) events.push(make('bridge-restored'));
  if (previous.systemUptimeSeconds !== null && current.systemUptimeSeconds !== null &&
    current.systemUptimeSeconds < previous.systemUptimeSeconds) events.push(make('system-rebooted'));
  return events;
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
  private events: DashboardEvent[] = [];
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
          !['points|version', 'events|points|version'].includes(Object.keys(value).sort().join('|')) ||
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
        const events = (value as { events?: unknown }).events ?? [];
        if (!Array.isArray(events) || events.length > 80 ||
          !events.every(e => validEvent(e, this.now(), true))) throw new Error('Invalid history events');
        this.events = (events as DashboardEvent[]).filter(e =>
          Date.parse(e.observedAt) >= this.now() - WINDOW_MS);
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
    const previous = this.points.at(-1);
    if (previous) this.events.push(...deriveEvents(previous, point));
    this.events = this.events.filter(item =>
      Date.parse(item.observedAt) >= this.now() - WINDOW_MS).slice(-60);
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
      const content = JSON.stringify({ version: 1, points: this.points, events: this.events }) + '\n';
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
      events: this.events.filter(e => Date.parse(e.observedAt) >= since).map(e => ({ ...e })),
    };
  }
}

const execFileAsync = promisify(execFile);
const BATTERY_COMMAND = '/data/data/com.termux/files/usr/bin/termux-battery-status';
export type DashboardBattery = { batteryPercent: number | null; batteryCharging: boolean | null; batteryTempC: number | null };

export function parseDashboardBattery(raw: string): DashboardBattery {
  const missing: DashboardBattery = { batteryPercent: null, batteryCharging: null, batteryTempC: null };
  try {
    const data: unknown = JSON.parse(raw);
    if (!data || typeof data !== 'object' || Array.isArray(data)) return missing;
    const v = data as Record<string, unknown>;
    const percent = typeof v.percentage === 'number' && Number.isInteger(v.percentage) &&
      validNumber(v.percentage, 100) ? v.percentage : null;
    const status = v.status;
    const charging = status === 'CHARGING' || status === 'FULL' ? true :
      status === 'DISCHARGING' || status === 'NOT_CHARGING' ? false : null;
    const temperature = typeof v.temperature === 'number' && Number.isFinite(v.temperature) &&
      v.temperature >= -30 && v.temperature <= 100 ? v.temperature : null;
    return { batteryPercent: percent as number | null, batteryCharging: charging, batteryTempC: temperature };
  } catch { return missing; }
}

/** Reuse the already installed Termux:API, no package installation or shell. */
export async function readDashboardBattery(): Promise<DashboardBattery> {
  try {
    const result = await execFileAsync(BATTERY_COMMAND, [], {
      timeout: 6000, maxBuffer: 4096, encoding: 'utf8', shell: false,
    });
    return parseDashboardBattery(result.stdout);
  } catch { return { batteryPercent: null, batteryCharging: null, batteryTempC: null }; }
}

export type DashboardDns = { dnsMs: number | null; dnsFailed: boolean | null };
/** Fixed DNS lookup, never scans the local network or retains resolved IP addresses. */
export async function probeDashboardDns(
  resolver: () => Promise<unknown> = () => lookup('one.one.one.one', { family: 4 }),
  clock: () => number = () => performance.now(),
): Promise<DashboardDns> {
  const start = clock();
  let timeout: ReturnType<typeof setTimeout> | null = null;
  try {
    await Promise.race([
      resolver(),
      new Promise((_, reject) => {
        timeout = setTimeout(() => reject(new Error('dns-timeout')), 2500);
      }),
    ]);
    const ms = Math.round((clock() - start) * 10) / 10;
    return { dnsMs: validNumber(ms, 15000) ? ms : null, dnsFailed: false };
  } catch { return { dnsMs: null, dnsFailed: true }; }
  finally { if (timeout) clearTimeout(timeout); }
}

export async function observeDashboardTelemetry(
  readHost: typeof readHostSnapshot = readHostSnapshot,
  readBridge: typeof readCompanionStatus = readCompanionStatus,
  readInternet: typeof probeInternetConnectivity = probeInternetConnectivity,
  now: () => number = Date.now,
  readBattery: () => Promise<DashboardBattery> = readDashboardBattery,
  readDns: () => Promise<DashboardDns> = probeDashboardDns,
): Promise<DashboardTelemetryPoint> {
  const at = new Date(now()).toISOString();
  let host: ReturnType<typeof readHostSnapshot> | null = null;
  try { host = readHost(); } catch { /* no fabricated values */ }
  const measuredBridge = async () => {
    const started = performance.now();
    const status = await readBridge();
    return { status, ms: Math.max(0, Math.round(performance.now() - started)) };
  };
  const [bridgeResult, internetResult, batteryResult, dnsResult] = await Promise.allSettled([
    measuredBridge(), readInternet(), readBattery(), readDns(),
  ]);
  const bridgeMs = bridgeResult.status === 'fulfilled' ? bridgeResult.value.ms : null;
  const bridge = bridgeResult.status === 'fulfilled' ? bridgeResult.value.status : null;
  const internet = internetResult.status === 'fulfilled' ? internetResult.value : null;
  const cpuAge = bridge ? now() - Date.parse(bridge.observedAt) : Infinity;
  const cpu = bridge?.connected && bridge?.authorized && typeof bridge?.cpuPercent === 'number'
    && cpuAge >= 0 && cpuAge <= 45000 ? bridge.cpuPercent : null;
  const total = host?.runtime.totalMemoryMiB ?? 0;
  const ram = total > 0
    ? Math.round(1000 * (total - host!.runtime.freeMemoryMiB) / total) / 10 : null;
  const battery = batteryResult.status === 'fulfilled' ? batteryResult.value : null;
  const dns = dnsResult.status === 'fulfilled' ? dnsResult.value : null;
  const storage = host?.runtime.storage;
  const serviceStates: ServiceStates | null = host
    ? Object.fromEntries(host.services
      .filter(s => (SERVICE_IDS as readonly string[]).includes(s.id))
      .map(s => [s.id, s.state])) as ServiceStates : null;
  const storageUsedPercent = storage && storage.totalMiB > 0
    ? Math.round(1000 * (storage.totalMiB - storage.availableMiB) / storage.totalMiB) / 10 : null;
  return {
    observedAt: at,
    cpu, ram,
    batteryPercent: battery?.batteryPercent ?? null,
    batteryCharging: battery?.batteryCharging ?? null,
    batteryTempC: battery?.batteryTempC ?? null,
    dnsMs: dns?.dnsMs ?? null,
    dnsFailed: dns?.dnsFailed ?? null,
    storageUsedPercent,
    serviceStates,
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
