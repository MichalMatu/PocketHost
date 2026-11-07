import { describe, expect, it } from "vitest"
import { parseObservabilitySnapshot } from "@/lib/observability-schema"

const time = "2026-11-07T03:00:00.000Z"
const missing = { state: "unavailable", value: null, observedAt: time }
const fixture = () => ({
  version: 1, mode: "read-only", observedAt: time,
  host: {
    version: 1, mode: "read-only", platform: "termux", observedAt: time,
    runtime: { nodeVersion: "v26.4.0", architecture: "arm64", systemUptimeSeconds: 1,
      totalMemoryMiB: 4096, freeMemoryMiB: 1024, storage: null },
    services: ["ilestoi","tunnel","ssh","mqtt","healthwatch","local-agent"].map((id) =>
      ({ id, label: id, ownership: "external", state: "unknown" })),
  },
  metrics: { cpuPercent: missing, batteryPercent: missing, network: missing },
  processes: { state: "unavailable", observedAt: time, partial: true, truncated: false, processes: [] },
  packages: { state: "unavailable", observedAt: time, installed: [], truncated: false,
    updates: { state: "unknown", candidates: [] } },
  diagnostics: { state: "unavailable", events: [] },
  history: [{ observedAt: time, cpuPercent: null, freeMemoryMiB: 1024 }],
  alerts: [],
})

describe("O1 observational-only API contract", () => {
  it("accepts explicit missing values without inventing zeros", () => {
    expect(parseObservabilitySnapshot(fixture()).metrics.cpuPercent.value).toBeNull()
  })
  it("rejects forged managed ownership, inconsistent missing state and secrets", () => {
    const bad = fixture()
    bad.host.services[0].ownership = "pockethost"
    expect(() => parseObservabilitySnapshot(bad)).toThrow()
    const other = fixture()
    other.metrics.cpuPercent = { state: "ok", value: null, observedAt: time }
    expect(() => parseObservabilitySnapshot(other)).toThrow()
    expect(() => parseObservabilitySnapshot({ ...fixture(), secret: "token" })).toThrow()
  })
  it("rejects unbounded lists and unjustified complete Android process view", () => {
    const bad = fixture()
    bad.processes.partial = false
    expect(() => parseObservabilitySnapshot(bad)).toThrow()
    expect(() => parseObservabilitySnapshot({ ...fixture(), history: Array(37).fill(fixture().history[0]) })).toThrow()
  })
})
