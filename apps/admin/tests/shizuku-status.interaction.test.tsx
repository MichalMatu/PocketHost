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


describe("Shizuku applications contract", () => {
  it("validates distinct native Android packages and their origin", async () => {
    const { parseShizukuApps } = await import("@/lib/shizuku-schema")
    const inventory = {
      version: 1, source: "android-companion", connected: true, authorized: true,
      mode: "adb", observedAt: now, truncated: false,
      packages: [{ packageName: "com.example.demo", system: false, label: "Example App", enabled: true }],
    }
    expect(parseShizukuApps(inventory).packages[0].system).toBe(false)
    expect(() => parseShizukuApps({ ...inventory, packages: [inventory.packages[0], inventory.packages[0]] })).toThrow()
    expect(() => parseShizukuApps({ ...inventory, packages: [{ packageName: "bad;app", system: true, label: "Bad", enabled: true }] })).toThrow()
  })
})


describe("Shizuku system overview contract", () => {
  it("accepts genuine bounded process, power, settings and service fields", async () => {
    const { parseShizukuSystem } = await import("@/lib/shizuku-schema")
    const observation = {
      version: 1, source: "android-companion", connected: true, authorized: true,
      mode: "adb", observedAt: now, processesTruncated: false,
      processes: [{ pid: 123, user: "shell", name: "com.example", rssKb: 2048, cpuPercent: null }],
      power: { batteryLevel: 80, batteryTemperatureC: 32.5, charging: true,
        memoryTotalKb: 6000000, memoryAvailableKb: 2000000 },
      settings: { brightness: 140, airplaneMode: false },
      services: { names: ["com.example/.Service"], truncated: false },
    }
    expect(parseShizukuSystem(observation).processes[0].rssKb).toBe(2048)
    expect(() => parseShizukuSystem({ ...observation,
      processes: [observation.processes[0], observation.processes[0]] })).toThrow()
    expect(() => parseShizukuSystem({ ...observation,
      power: { ...observation.power, batteryLevel: 140 } })).toThrow()
  })
})


describe("Shizuku charging states", () => {
  it("renders full and unavailable separately from external power", () => {
    const state = { charging: false, chargingState: "full", powerConnected: true }
    expect(state.chargingState).toBe("full")
    expect(state.powerConnected).toBe(true)
    expect(state.charging).toBe(false)
  })
})


describe("Shizuku selected application details", () => {
  it("accepts only typed package metadata and unique requested permissions", async () => {
    const { parseShizukuApp } = await import("@/lib/shizuku-schema")
    const app = {
      version: 1, source: "android-companion", packageName: "com.example.demo",
      label: "Demo", versionName: "2.0", versionCode: 20, targetSdk: 35,
      enabled: true, system: false,
      permissions: [{ name: "android.permission.CAMERA", granted: true }],
    }
    expect(parseShizukuApp(app).label).toBe("Demo")
    expect(() => parseShizukuApp({ ...app,
      permissions: [...app.permissions, ...app.permissions] })).toThrow()
    expect(() => parseShizukuApp({ ...app, iconPng: "not base64!" })).toThrow()
  })
})
