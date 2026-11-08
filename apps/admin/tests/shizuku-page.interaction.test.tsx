import * as React from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"

vi.mock("@/components/layouts/base-layout", () => ({
  BaseLayout: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}))
import ShizukuPage from "@/app/shizuku/page"

const now = "2026-11-08T12:00:00.000Z"
const status = {
  version: 1, source: "android-companion", connected: true, authorized: true,
  mode: "adb", observedAt: now, cpuPercent: 19, visibleProcesses: 852, capabilities: [],
}
const apps = {
  version: 1, source: "android-companion", connected: true, authorized: true,
  mode: "adb", observedAt: now, truncated: false,
  packages: Array.from({ length: 175 }, (_, index) => ({
    packageName: "com.example.app" + index, label: "Example " + index,
    system: false, enabled: true,
  })),
}
const system = {
  version: 1, source: "android-companion", connected: true, authorized: true,
  mode: "adb", observedAt: now, processesTruncated: false,
  processes: Array.from({ length: 175 }, (_, index) => ({
    pid: index + 100, user: "shell", name: "app" + index,
    rssKb: 1024, cpuPercent: null,
  })),
  power: { batteryLevel: 80, batteryTemperatureC: 31, charging: false,
    memoryTotalKb: 8000000, memoryAvailableKb: 3000000 },
  settings: { brightness: 128, airplaneMode: false },
  services: { names: ["com.example/.Service"], truncated: false },
}
function mount(fetcher: (url: string) => Promise<unknown>) {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    expect(init?.method).toBe("GET")
    const value = await fetcher(url)
    return { ok: true, json: async () => value }
  })
  vi.stubGlobal("fetch", fetchMock)
  render(<MemoryRouter><ShizukuPage /></MemoryRouter>)
  return fetchMock
}
afterEach(() => vi.unstubAllGlobals())

describe("Android Shizuku UI response and bounded inventories", () => {
  it("shows connected status/CPU without waiting for slow apps or processes", async () => {
    mount(async url => {
      if (url.endsWith("/status")) return status
      return new Promise(() => undefined)
    })
    expect(await screen.findByText("Connected")).toBeTruthy()
    expect(screen.getByText("19.0%")).toBeTruthy()
    expect(screen.getByText("Loading Android applications…")).toBeTruthy()
    await userEvent.setup().click(screen.getByRole("tab", { name: /CPU & processes/i }))
    expect(screen.getByText("Loading Android processes…")).toBeTruthy()
  })

  it("pages applications and processes without rendering 175 rows at once", async () => {
    mount(async url => url.endsWith("/status") ? status :
      url.endsWith("/apps") ? apps : system)
    const user = userEvent.setup()
    await screen.findByText("Example 0")
    expect(screen.getByText("1–80 of 175")).toBeTruthy()
    expect(screen.queryByText("Example 80")).toBeNull()
    await user.click(screen.getByRole("button", { name: "Next applications" }))
    expect(screen.getByText("81–160 of 175")).toBeTruthy()
    expect(screen.getByText("Example 80")).toBeTruthy()
    await user.type(screen.getByRole("textbox", { name: "Search Android packages" }), "Example 174")
    expect(screen.getByText("1–1 of 1")).toBeTruthy()
    expect(screen.getByText("Example 174")).toBeTruthy()

    await user.click(screen.getByRole("tab", { name: /CPU & processes/i }))
    await screen.findByText("1–80 of 175")
    expect(screen.queryByText("app80")).toBeNull()
    await user.click(screen.getByRole("button", { name: "Next processes" }))
    expect(screen.getByText("81–160 of 175")).toBeTruthy()
    expect(screen.getByText("app80")).toBeTruthy()
  })

  it("supports keyboard tab navigation and exposes native detail errors", async () => {
    mount(async url => {
      if (url.endsWith("/status")) return status
      if (url.endsWith("/apps")) return apps
      if (url.endsWith("/system")) return system
      throw new Error("read failed")
    })
    const user = userEvent.setup()
    await screen.findByText("Example 0")
    const tab = screen.getByRole("tab", { name: /Applications/i })
    tab.focus()
    await user.keyboard("{ArrowRight}")
    expect(screen.getByRole("tab", { name: /CPU & processes/i }).getAttribute("aria-selected")).toBe("true")
    await user.keyboard("{Home}")
    expect(screen.getByRole("tab", { name: /Applications/i }).getAttribute("aria-selected")).toBe("true")
    await user.click(screen.getByText("Example 0"))
    expect(await screen.findByText("App detail request failed. Select the app again to retry.")).toBeTruthy()
  })

  it("isolates inventory failure without hiding real Shizuku connection", async () => {
    mount(async url => {
      if (url.endsWith("/status")) return status
      if (url.endsWith("/system")) return system
      throw new Error("inventory unavailable")
    })
    expect(await screen.findByText("Connected")).toBeTruthy()
    expect(await screen.findByText("Application inventory request failed. Try Refresh.")).toBeTruthy()
    await userEvent.setup().click(screen.getByRole("tab", { name: /Power & hardware/i }))
    await waitFor(() => expect(screen.getByText(/Total system RAM:/)).toBeTruthy())
  })
})
