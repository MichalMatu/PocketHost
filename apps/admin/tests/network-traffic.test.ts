import { describe, expect, it } from "vitest"
import { formatTrafficMbps, trafficMbps } from "@/lib/network-traffic"

const first = { networkObservedAt: "2026-11-10T13:00:00Z", networkRxBytes: 1000, networkTxBytes: 2000 }
const next = { networkObservedAt: "2026-11-10T13:00:10Z", networkRxBytes: 126000, networkTxBytes: 127000 }

describe("Android network telemetry arithmetic", () => {
  it("calculates live RX / TX rates and preserves real zero", () => {
    expect(trafficMbps(first, next)).toEqual({ networkRxMbps: 0.1, networkTxMbps: 0.1 })
    expect(trafficMbps(first, { ...next, networkRxBytes: 1000, networkTxBytes: 2000 }))
      .toEqual({ networkRxMbps: 0, networkTxMbps: 0 })
    expect(formatTrafficMbps(0)).toBe("0 Mb/s")
    expect(formatTrafficMbps(0.00001)).toBe("<0.01 Mb/s")
  })
  it("never converts missing data, reboot resets or gaps to zero", () => {
    expect(formatTrafficMbps(null)).toBe("Unavailable")
    expect(trafficMbps(null, next).networkRxMbps).toBeNull()
    expect(trafficMbps(first, { ...next, networkRxBytes: null }).networkRxMbps).toBeNull()
    expect(trafficMbps(next, first).networkRxMbps).toBeNull()
    expect(trafficMbps(first, { ...next, networkObservedAt: first.networkObservedAt }).networkRxMbps).toBeNull()
    expect(trafficMbps(first, { ...next, networkObservedAt: "2026-11-10T13:10:00Z" }).networkRxMbps).toBeNull()
    expect(trafficMbps(first, { ...next, networkRxBytes: -1 }).networkRxMbps).toBeNull()
  })
})
