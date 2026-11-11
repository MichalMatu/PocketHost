import * as React from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import { ShizukuDiagnosticsPanel } from "@/app/shizuku/diagnostics-panel"

afterEach(() => vi.unstubAllGlobals())

describe("Shizuku native diagnostics", () => {
  it("reports the actual UID and independently probes three native endpoints", async () => {
    const sample = {
      version: 1, source: "android-companion", connected: true, authorized: true,
      uid: 2000, mode: "adb", observedAt: new Date().toISOString(),
      cpuPercent: 20, visibleProcesses: 2, capabilities: [{
        id: "apps", title: "apps", available: true,
        description: "Shizuku Binder operation available",
      }],
    }
    const apps = { ...sample, truncated: false, packages: [] }
    delete (apps as { capabilities?: unknown }).capabilities
    delete (apps as { cpuPercent?: unknown }).cpuPercent
    delete (apps as { visibleProcesses?: unknown }).visibleProcesses
    delete (apps as { uid?: unknown }).uid
    const system = {
      version: 1, source: "android-companion", connected: true, authorized: true,
      mode: "adb", observedAt: new Date().toISOString(), processes: [], processesTruncated: false,
      settings: { brightness: 128, airplaneMode: false, screenTimeoutMs: 60000 },
      services: { names: [], truncated: false },
      power: { batteryLevel: 80, batteryTemperatureC: 30, charging: false,
        memoryAvailableKb: 2000000, memoryTotalKb: 6000000 },
    }
    const fetchMock = vi.fn(async (url: string) => ({
      ok: true, json: async () => url.endsWith("/status") ? sample :
        url.endsWith("/apps") ? apps : system,
    }))
    vi.stubGlobal("fetch", fetchMock)
    render(<ShizukuDiagnosticsPanel />)
    expect(await screen.findByText("2000")).toBeTruthy()
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3))
    for (const endpoint of ["/status", "/apps", "/system"]) {
      expect(fetchMock.mock.calls.some(([url]) => url.endsWith(endpoint))).toBe(true)
    }
    expect(screen.getByText(/Native capabilities \(1\)/)).toBeTruthy()
    expect(screen.getByText(/Shizuku Binder operation available/)).toBeTruthy()
    expect(screen.getByRole("region", { name: "Native capabilities" }).querySelectorAll("li")).toHaveLength(1)
    expect(screen.queryByText("Advanced Shizuku diagnostics")).toBeNull()
    expect(screen.queryByText(sample.observedAt)).toBeNull()
  })
})
