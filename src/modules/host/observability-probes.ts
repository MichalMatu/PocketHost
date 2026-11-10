import { execFile, spawnSync } from 'node:child_process';
import { promisify } from 'node:util';
import { readFileSync, readdirSync } from 'node:fs';
import os from 'node:os';
import type {
  HostMetrics,
  PackageEntry,
  PackageInventory,
  ProcessInventory,
  ProcessObservation,
  Reading,
  ReadingState,
} from '../../shared/observability.ts';

const MAX_PROCESSES = 96;
const MAX_PACKAGES = 48;
const PROC = '/proc';
const BATTERY = '/sys/class/power_supply/battery/capacity';
const NETWORK = '/proc/net/dev';
const TERMUX_BIN = '/data/data/com.termux/files/usr/bin';
const execFileAsync = promisify(execFile);

function missing<T>(state: ReadingState, now: string): Reading<T> {
  return { state, value: null, observedAt: now };
}

function reason(error: unknown): ReadingState {
  const code = (error as { code?: unknown } | null)?.code;
  return code === 'EACCES' || code === 'EPERM' ? 'permission-denied' : 'unavailable';
}

/** Kernel CPU times are accumulated; percentages require two separate samples. */
export function cpuPercentage(
  before: ReadonlyArray<{
    times: { user: number; nice: number; sys: number; idle: number; irq: number };
  }>,
  after: ReadonlyArray<{
    times: { user: number; nice: number; sys: number; idle: number; irq: number };
  }>,
): number | null {
  if (before.length === 0 || before.length !== after.length) return null;
  let total = 0;
  let idle = 0;
  for (let i = 0; i < before.length; i++) {
    const a = before[i]?.times;
    const b = after[i]?.times;
    if (!a || !b) return null;
    const values = [
      b.user - a.user,
      b.nice - a.nice,
      b.sys - a.sys,
      b.idle - a.idle,
      b.irq - a.irq,
    ];
    if (values.some((n) => !Number.isFinite(n) || n < 0)) return null;
    total += values.reduce((sum, n) => sum + n, 0);
    idle += values[3] ?? 0;
  }
  return total > 0 ? Math.round((10000 * (total - idle)) / total) / 100 : null;
}

export async function readCpuPercent(
  sample: () => ReturnType<typeof os.cpus> = () => os.cpus(),
  pause: () => Promise<void> = () => new Promise((done) => setTimeout(done, 180)),
  now: () => string = () => new Date().toISOString(),
): Promise<Reading<number>> {
  try {
    const before = sample();
    await pause();
    const percentage = cpuPercentage(before, sample());
    return percentage === null
      ? missing('unavailable', now())
      : { state: 'ok', value: percentage, observedAt: now() };
  } catch (error) {
    return missing(reason(error), now());
  }
}

export function readBatteryPercent(
  read: (path: string) => string = (file) => readFileSync(file, 'utf8'),
  now = new Date().toISOString(),
): Reading<number> {
  try {
    const raw = read(BATTERY).trim();
    if (!/^\d{1,3}$/.test(raw)) return missing('unavailable', now);
    const value = Number(raw);
    return value <= 100 ? { state: 'ok', value, observedAt: now } : missing('unavailable', now);
  } catch (error) {
    return missing(reason(error), now);
  }
}

/** Parse a fixed Termux:API battery response without accepting missing or forged values. */
export function parseTermuxBatteryPercent(
  raw: string,
  now = new Date().toISOString(),
): Reading<number> {
  try {
    const json: unknown = JSON.parse(raw);
    if (!json || typeof json !== 'object' || Array.isArray(json))
      return missing('unavailable', now);
    const percentage = (json as { percentage?: unknown }).percentage;
    if (
      typeof percentage !== 'number' ||
      !Number.isInteger(percentage) ||
      percentage < 0 ||
      percentage > 100
    )
      return missing('unavailable', now);
    return { state: 'ok', value: percentage, observedAt: now };
  } catch {
    return missing('unavailable', now);
  }
}

/**
 * The Android battery sysfs path is restricted on recent Samsung builds.
 * Termux:API is an optional, bounded, read-only companion; never use a shell.
 */
export async function readTermuxApiBatteryPercent(
  now = new Date().toISOString(),
): Promise<Reading<number>> {
  try {
    const result = await execFileAsync(`${TERMUX_BIN}/termux-battery-status`, [], {
      timeout: 7500,
      maxBuffer: 4096,
      encoding: 'utf8',
      shell: false,
    });
    return parseTermuxBatteryPercent(result.stdout, now);
  } catch {
    return missing('unavailable', now);
  }
}

/** Only aggregate device interface counters, never IP addresses or interface names. */
export function readNetworkBytes(
  read: (path: string) => string = (file) => readFileSync(file, 'utf8'),
  now = new Date().toISOString(),
): Reading<{ rxBytes: number; txBytes: number }> {
  try {
    const raw = read(NETWORK);
    let rx = 0;
    let tx = 0;
    let matched = 0;
    for (const line of raw.split('\n').slice(2, 32)) {
      const match = /^\s*([a-zA-Z0-9_.-]+):\s*(.+)$/.exec(line);
      if (!match || match[1] === 'lo') continue;
      const columns = match[2]?.trim().split(/\s+/) ?? [];
      if (columns.length < 16 || !/^\d+$/.test(columns[0] ?? '') || !/^\d+$/.test(columns[8] ?? ''))
        continue;
      const a = Number(columns[0]);
      const b = Number(columns[8]);
      if (!Number.isSafeInteger(a) || !Number.isSafeInteger(b)) return missing('unavailable', now);
      rx += a;
      tx += b;
      matched++;
    }
    if (matched === 0 || !Number.isSafeInteger(rx) || !Number.isSafeInteger(tx))
      return missing('unavailable', now);
    return { state: 'ok', value: { rxBytes: rx, txBytes: tx }, observedAt: now };
  } catch (error) {
    return missing(reason(error), now);
  }
}

/** Parse /proc/PID/stat without exposing argv, comm, paths or credentials. */
export function parseProcessStat(
  raw: string,
  expectedPid: number,
): Omit<ProcessObservation, 'ownership' | 'rssMiB'> | null {
  const close = raw.lastIndexOf(') ');
  if (close < 0 || !Number.isSafeInteger(expectedPid) || expectedPid < 1) return null;
  if (raw.slice(0, raw.indexOf(' ')) !== String(expectedPid)) return null;
  const fields = raw
    .slice(close + 2)
    .trim()
    .split(/\s+/);
  const ppid = Number(fields[1]);
  const utime = Number(fields[11]);
  const stime = Number(fields[12]);
  const ticks = fields[19];
  if (
    !Number.isSafeInteger(ppid) ||
    ppid < 0 ||
    !Number.isSafeInteger(utime) ||
    utime < 0 ||
    !Number.isSafeInteger(stime) ||
    stime < 0 ||
    !Number.isSafeInteger(utime + stime) ||
    !ticks ||
    !/^\d+$/.test(ticks)
  )
    return null;
  return { pid: expectedPid, ppid, startTicks: ticks, cpuTicks: utime + stime };
}

/** Only the bounded status Name field; never /proc/stat comm, argv or command line. */
export function parseProcessName(status: string): string | null {
  const name = /^Name:[ \t]*([^\r\n]*)$/m.exec(status)?.[1]?.trim();
  return name && /^[A-Za-z0-9][A-Za-z0-9._+:-]{0,23}$/.test(name) ? name : null;
}

export function parseProcessRss(status: string): number | null {
  const match = /^VmRSS:\s*(\d+)\s+kB\s*$/m.exec(status);
  if (!match) return null;
  const kb = Number(match[1]);
  return Number.isSafeInteger(kb) ? Math.round((kb / 1024) * 10) / 10 : null;
}

/** A bounded and necessarily partial Android /proc view; discovered PIDs are NOT owned. */
export function readProcessInventory(
  enumerate: () => string[] = () => readdirSync(PROC),
  read: (file: string) => string = (file) => readFileSync(file, 'utf8'),
  now = new Date().toISOString(),
  selfPid = process.pid,
): ProcessInventory {
  let ids: number[];
  try {
    ids = [
      ...new Set([
        ...enumerate()
          .filter((entry) => /^[1-9]\d*$/.test(entry))
          .map(Number),
        selfPid,
      ]),
    ]
      .filter((pid) => Number.isSafeInteger(pid) && pid > 0)
      .sort((a, b) => a - b);
  } catch (error) {
    return {
      state: reason(error),
      observedAt: now,
      partial: true,
      truncated: false,
      processes: [],
    };
  }
  const truncated = ids.length > MAX_PROCESSES;
  const selected = ids.slice(0, MAX_PROCESSES - 1);
  if (!selected.includes(selfPid)) selected.push(selfPid);
  const processes: ProcessObservation[] = [];
  let denied = false;
  for (const pid of selected) {
    try {
      const stat = parseProcessStat(read(`${PROC}/${pid}/stat`), pid);
      if (!stat) continue;
      let rss: number | null = null;
      let name: string | null = null;
      try {
        const status = read(`${PROC}/${pid}/status`);
        rss = parseProcessRss(status);
        name = parseProcessName(status);
      } catch {
        // Android can restrict /proc/PID/status independently. Never infer a name from argv.
      }
      processes.push({ ...stat, name, rssMiB: rss, ownership: pid === selfPid ? 'self' : 'unverified' });
    } catch (error) {
      if (reason(error) === 'permission-denied') denied = true;
    }
  }
  return {
    state: processes.length ? 'ok' : denied ? 'permission-denied' : 'unavailable',
    observedAt: now,
    partial: true,
    truncated,
    processes,
  };
}

/** Fixed executable/argument pairs only; no shell or caller-controlled commands. */
export function readFixedCommand(
  binary: string,
  args: string[],
  run: typeof spawnSync = spawnSync,
): string | null {
  try {
    const result = run(binary, args, {
      shell: false,
      encoding: 'utf8',
      timeout: 1800,
      maxBuffer: 65536,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    if (result.status !== 0 || result.error || typeof result.stdout !== 'string') return null;
    return result.stdout.slice(0, 65536);
  } catch {
    return null;
  }
}

export function parseInstalledPackages(raw: string, limit = MAX_PACKAGES): PackageEntry[] {
  const entries: PackageEntry[] = [];
  for (const line of raw.split('\n').slice(0, 2048)) {
    const match = /^([a-z0-9][a-z0-9+.-]{0,80})\t([a-zA-Z0-9.+:~_-]{1,96})$/.exec(line.trim());
    if (!match) continue;
    entries.push({ ecosystem: 'termux', name: match[1]!, version: match[2]! });
    if (entries.length >= limit) break;
  }
  return entries;
}

/** Read-only package metadata from two local tool JSON formats; no install plans. */
export function parseNpmGlobals(raw: string, limit = 8): PackageEntry[] {
  try {
    const payload: unknown = JSON.parse(raw);
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return [];
    const deps = (payload as { dependencies?: unknown }).dependencies;
    if (!deps || typeof deps !== 'object' || Array.isArray(deps)) return [];
    const result: PackageEntry[] = [];
    for (const [name, meta] of Object.entries(deps).slice(0, 128)) {
      const version = (meta as { version?: unknown } | null)?.version;
      if (
        !/^@?[a-zA-Z0-9][a-zA-Z0-9._+-]{0,60}(?:\/[a-zA-Z0-9][a-zA-Z0-9._+-]{0,60})?$/.test(name) ||
        typeof version !== 'string' ||
        !/^[a-zA-Z0-9][a-zA-Z0-9.+:~_-]{0,95}$/.test(version)
      )
        continue;
      result.push({ ecosystem: 'node', name, version });
      if (result.length >= limit) break;
    }
    return result;
  } catch {
    return [];
  }
}

export function parsePipInstalled(raw: string, limit = 8): PackageEntry[] {
  try {
    const payload: unknown = JSON.parse(raw);
    if (!Array.isArray(payload)) return [];
    const result: PackageEntry[] = [];
    for (const item of payload.slice(0, 256)) {
      if (!item || typeof item !== 'object') continue;
      const { name, version } = item as { name?: unknown; version?: unknown };
      if (
        typeof name !== 'string' ||
        !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,80}$/.test(name) ||
        typeof version !== 'string' ||
        !/^[a-zA-Z0-9][a-zA-Z0-9.+:~_-]{0,95}$/.test(version)
      )
        continue;
      result.push({ ecosystem: 'python', name, version });
      if (result.length >= limit) break;
    }
    return result;
  } catch {
    return [];
  }
}

export function readPackageInventory(
  command: (binary: string, args: string[]) => string | null = readFixedCommand,
  now = new Date().toISOString(),
): PackageInventory {
  const installed: PackageEntry[] = [{ ecosystem: 'node', name: 'node', version: process.version }];
  const npm = command(`${TERMUX_BIN}/npm`, ['--version'])?.trim();
  const python = command(`${TERMUX_BIN}/python3`, ['--version'])?.trim();
  if (npm && /^\d+(?:\.\d+){1,3}$/.test(npm))
    installed.push({ ecosystem: 'node', name: 'npm', version: npm });
  if (python && /^Python \d+\.\d+(?:\.\d+)?$/.test(python))
    installed.push({ ecosystem: 'python', name: 'python', version: python.slice(7) });
  const raw = command(`${TERMUX_BIN}/dpkg-query`, ['-W', '-f=${binary:Package}\\t${Version}\\n']);
  const termux = raw === null ? [] : parseInstalledPackages(raw, 28);
  const npmModules = parseNpmGlobals(
    command(`${TERMUX_BIN}/npm`, ['ls', '--global', '--depth=0', '--json']) ?? '',
  );
  const pipModules = parsePipInstalled(
    command(`${TERMUX_BIN}/python3`, [
      '-m',
      'pip',
      'list',
      '--disable-pip-version-check',
      '--format=json',
    ]) ?? '',
  );
  installed.push(...termux, ...npmModules, ...pipModules);
  // Never refresh apt indexes or use network. Cached upgrade hints are not authoritative.
  const cached = command(`${TERMUX_BIN}/apt`, ['list', '--upgradable']);
  const candidates = (cached ?? '')
    .split('\n')
    .slice(0, 128)
    .map((line) => /^([a-z0-9][a-z0-9+.-]{0,80})\//.exec(line)?.[1])
    .filter((v): v is string => !!v)
    .slice(0, 24);
  return {
    state: raw === null ? 'unavailable' : 'ok',
    observedAt: now,
    installed,
    truncated:
      (raw !== null && termux.length >= 28) || npmModules.length >= 8 || pipModules.length >= 8,
    updates: { state: cached === null ? 'unknown' : 'cached-unverified', candidates },
  };
}

export async function readHostMetrics(): Promise<HostMetrics> {
  const directBattery = readBatteryPercent();
  const [cpuPercent, fallbackBattery] = await Promise.all([
    readCpuPercent(),
    directBattery.state === 'ok' ? Promise.resolve(directBattery) : readTermuxApiBatteryPercent(),
  ]);
  return {
    cpuPercent,
    batteryPercent: fallbackBattery.state === 'ok' ? fallbackBattery : directBattery,
    network: readNetworkBytes(),
  };
}
