/** Device-wide cumulative Android TrafficStats; not speed-test measurements. */
export type NetworkCounters = {
  networkRxBytes?: number | null
  networkTxBytes?: number | null
  networkObservedAt?: string | null
}
const valid = (n: number | null | undefined): n is number =>
  typeof n === "number" && Number.isSafeInteger(n) && n >= 0

export function trafficMbps(previous: NetworkCounters | null, current: NetworkCounters) {
  const missing = { networkRxMbps: null as number | null, networkTxMbps: null as number | null }
  if (!previous?.networkObservedAt || !current.networkObservedAt) return missing
  const ms = Date.parse(current.networkObservedAt) - Date.parse(previous.networkObservedAt)
  if (!Number.isFinite(ms) || ms < 1000 || ms > 300000) return missing
  const rate = (start: number | null | undefined, end: number | null | undefined) => {
    if (!valid(start) || !valid(end) || end < start) return null
    const value = (end - start) * 8 / (ms * 1000)
    return Number.isFinite(value) && value >= 0 && value <= 10000 ? value : null
  }
  return {
    networkRxMbps: rate(previous.networkRxBytes, current.networkRxBytes),
    networkTxMbps: rate(previous.networkTxBytes, current.networkTxBytes),
  }
}

export function formatTrafficMbps(rate: number | null | undefined) {
  if (rate === null || rate === undefined || !Number.isFinite(rate)) return "Unavailable"
  if (rate === 0) return "0 Mb/s"
  if (rate > 0 && rate < 0.01) return "<0.01 Mb/s"
  return rate.toFixed(2) + " Mb/s"
}
