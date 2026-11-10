import * as React from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"

vi.mock("@/components/layouts/base-layout", () => ({
  BaseLayout: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}))
import PhoneSettingsPage from "@/app/phone-settings/page"

const status = {
  version: 1, source: "android-companion", connected: true, authorized: true,
  mode: "adb", uid: 2000, observedAt: "2026-11-10T22:00:00.000Z",
  cpuPercent: 12, visibleProcesses: 120, capabilities: [],
}
const system = {
  version: 1, source: "android-companion", connected: true, authorized: true,
  mode: "adb", observedAt: "2026-11-10T22:00:00.000Z",
  processes: [], processesTruncated: false,
  power: { batteryLevel: 100, batteryTemperatureC: 31, charging: true,
    memoryTotalKb: 7000000, memoryAvailableKb: 2500000 },
  settings: { brightness: 154, airplaneMode: false, screenTimeoutMs: 600000 },
  services: { names: [], truncated: false },
}
function mount(disconnected = false) {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (init?.method === "POST") {
      return { ok: true, json: async () => ({
        success: true, action: "brightness", mode: "adb", output: "", durationMs: 2,
      }) }
    }
    expect(init?.method).toBe("GET")
    return { ok: true, json: async () => url.endsWith("/status") ?
      { ...status, connected: !disconnected, authorized: !disconnected,
        mode: disconnected ? "none" : "adb",
        uid: disconnected ? null : 2000,
        cpuPercent: disconnected ? null : 12,
        visibleProcesses: disconnected ? null : 120 } : system }
  })
  vi.stubGlobal("fetch", fetchMock)
  render(<MemoryRouter><PhoneSettingsPage /></MemoryRouter>)
  return fetchMock
}
afterEach(() => vi.unstubAllGlobals())

describe("dedicated Phone Settings", () => {
  it("shows saved display values, clear scope and deliberate brightness actions", async () => {
    const calls = mount()
    await screen.findByText(/Saved time until screen sleeps: 10 min/)
    const slider = screen.getByRole("slider", { name: "Set screen brightness" })
    expect(slider.getAttribute("value")).toBe("154")
    expect(screen.getByText(/Adaptive brightness may override/)).toBeTruthy()
    expect(screen.queryByRole("button", { name: "Save brightness" })).toBeNull()

    fireEvent.change(slider, { target: { value: "7" } })
    expect(calls.mock.calls.filter(call => call[1]?.method === "POST")).toHaveLength(0)
    fireEvent.click(screen.getByRole("button", { name: "Save brightness" }))
    await waitFor(() => expect(calls.mock.calls.filter(call => call[1]?.method === "POST")).toHaveLength(1))
    const post = calls.mock.calls.find(call => call[1]?.method === "POST")
    expect(JSON.parse(String(post?.[1]?.body))).toEqual({ action: "brightness", target: "", value: "7" })
    expect(screen.getByText("Display & screen")).toBeTruthy()
  })

  it("does not offer settings writes on unauthorized Shizuku", async () => {
    const calls = mount(true)
    expect(await screen.findByRole("alert")).toBeTruthy()
    const slider = screen.getByRole("slider", { name: "Set screen brightness" })
    expect(slider.hasAttribute("disabled")).toBe(true)
    expect(screen.getByRole("combobox", { name: "Set screen timeout" }).hasAttribute("disabled")).toBe(true)
    expect(calls.mock.calls.filter(call => call[1]?.method === "POST")).toHaveLength(0)
    expect(calls.mock.calls.some(call => String(call[0]).endsWith("/system"))).toBe(false)
  })
})
