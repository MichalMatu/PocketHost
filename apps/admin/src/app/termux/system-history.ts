import type { DashboardHistoryPoint } from "@/lib/dashboard-history-schema"

export const MAX_SAMPLES = 1680 // 24h full-resolution, 7d hourly archive and bounded in-tab readings

export type Sample = {
  observedAt: string
  cpu: number | null
  ram: number | null
  apiMs: number | null
  internetMs: number | null
  internetFailed: boolean | null
  bridgeMs: number | null
  bridgeOnline: boolean | null
  batteryPercent?: number | null
  batteryCharging?: boolean | null
  batteryTempC?: number | null
  dnsMs?: number | null
  dnsFailed?: boolean | null
  storageUsedPercent?: number | null
  systemUptimeSeconds?: number | null
  networkRxBytes?: number | null
  networkTxBytes?: number | null
  networkObservedAt?: string | null
}

export function mergeHistory(previous: Sample[], stored: DashboardHistoryPoint[]): Sample[] {
  const merged = new Map<string, Sample>()
  for (const item of stored) merged.set(item.observedAt, {
    observedAt: item.observedAt,
    cpu: item.cpu, ram: item.ram, internetMs: item.internetMs,
    internetFailed: item.internetFailed, bridgeMs: item.bridgeMs,
    bridgeOnline: item.bridgeOnline, apiMs: null,
    batteryPercent: item.batteryPercent ?? null,
    batteryCharging: item.batteryCharging ?? null,
    batteryTempC: item.batteryTempC ?? null,
    dnsMs: item.dnsMs ?? null,
    dnsFailed: item.dnsFailed ?? null,
    storageUsedPercent: item.storageUsedPercent ?? null,
    systemUptimeSeconds: item.systemUptimeSeconds,
    networkRxBytes: item.networkRxBytes ?? null,
    networkTxBytes: item.networkTxBytes ?? null,
    networkObservedAt: item.networkObservedAt ?? null,
  })
  for (const item of previous) merged.set(item.observedAt, item)
  return [...merged.values()]
    .sort((a, b) => Date.parse(a.observedAt) - Date.parse(b.observedAt))
    .slice(-MAX_SAMPLES)
}

