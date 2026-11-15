import { describe, expect, it } from "vitest"
import { parseDashboardHistory } from "@/lib/dashboard-history-schema"

const makePoint = (serviceStates: Record<string, string>) => ({
  observedAt: new Date().toISOString(),
  cpu: null, ram: 48, internetMs: 21, internetFailed: false,
  bridgeMs: null, bridgeOnline: null, servicesRunning: 2,
  servicesTotal: 4, storageAvailableMiB: 16300, systemUptimeSeconds: 7200,
  batteryPercent: 79, batteryCharging: null, batteryTempC: null,
  dnsMs: 14, dnsFailed: false, serviceStates,
})

describe("Dashboard telemetry wire schema", () => {
  it("accepts sparse or empty service states from an owned A8 collector", () => {
    for (const states of [{}, { ssh: "stopped" }, { ssh: "stopped", mqtt: "unknown" }]) {
      const snapshot = parseDashboardHistory({
        version: 1, source: "pockethost-collector",
        state: "ok", intervalSeconds: 60, retentionHours: 168,
        samples: [makePoint(states)],
        events: [],
      })
      expect(snapshot.samples[0]?.serviceStates).toEqual(states)
      expect(snapshot.samples[0]?.batteryPercent).toBe(79)
    }
  })
  it("still rejects invented services and unsupported runtime states", () => {
    for (const states of [{ arbitrary: "running" }, { ssh: "healthy" }]) {
      expect(() => parseDashboardHistory({
        version: 1, source: "pockethost-collector",
        state: "ok", intervalSeconds: 60, retentionHours: 168,
        samples: [makePoint(states)], events: [],
      })).toThrow()
    }
  })
})
