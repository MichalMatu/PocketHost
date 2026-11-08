import { describe, expect, it } from "vitest"
import { parseShizukuStatus } from "@/lib/shizuku-schema"

const now = "2026-11-08T09:30:00+01:00"
describe("Shizuku status bridge contract", () => {
  it("accepts valid native companion CPU and process readings", () => {
    const parsed = parseShizukuStatus({
      version: 1, source: "android-companion", connected: true, authorized: true,
      mode: "adb", observedAt: now, cpuPercent: 31, visibleProcesses: 128,
      capabilities: [{ id: "cpu", title: "CPU", available: true, description: "System CPU" }],
    })
    expect(parsed.cpuPercent).toBe(31)
  })
  it("rejects simulated successes and untyped privilege data", () => {
    expect(() => parseShizukuStatus({ source: "diagnostic" })).toThrow()
    expect(() => parseShizukuStatus({
      version: 1, source: "android-companion", connected: true,
      authorized: true, mode: "adb", observedAt: now,
      cpuPercent: 250, visibleProcesses: 0, capabilities: [],
    })).toThrow()
  })
})
