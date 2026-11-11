import * as React from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
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
  it("shows Shizuku connection without waiting for slow app or process inventories", async () => {
    mount(async url => {
      if (url.endsWith("/status")) return status
      return new Promise(() => undefined)
    })
    expect(await screen.findByText(/Shizuku · ADB/)).toBeTruthy()
    expect(screen.getByText("Loading Android applications…")).toBeTruthy()
    await userEvent.setup().click(screen.getByRole("tab", { name: /Android processes/i }))
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
    fireEvent.change(screen.getByRole("textbox", { name: "Search Android packages" }), { target: { value: "Example 174" } })
    expect(screen.getByText("1–1 of 1")).toBeTruthy()
    expect(screen.getByText("Example 174")).toBeTruthy()

    await user.click(screen.getByRole("tab", { name: /Android processes/i }))
    await screen.findByText(/Showing 1–80 of 175/)
    expect(screen.queryByText("app80")).toBeNull()
    await user.click(screen.getByRole("button", { name: "Next processes" }))
    expect(screen.getByText(/Showing 81–160 of 175/)).toBeTruthy()
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
    const tab = screen.getByRole("tab", { name: /Apps & permissions/i })
    tab.focus()
    await user.keyboard("{ArrowRight}")
    expect(screen.getByRole("tab", { name: /Android processes/i }).getAttribute("aria-selected")).toBe("true")
    await user.keyboard("{Home}")
    expect(screen.getByRole("tab", { name: /Apps & permissions/i }).getAttribute("aria-selected")).toBe("true")
    await user.click(screen.getByText("Example 0"))
    expect(await screen.findByText("App detail request failed. Retry or choose another app.")).toBeTruthy()
  })

  it("shows real app permission grants and selectable observed Android service", async () => {
    const detail = {
      version: 1, source: "android-companion", packageName: "com.example.app0",
      label: "Example 0", versionName: "1.0", versionCode: 1, targetSdk: 35,
      enabled: true, system: false,
      permissions: [
        { name: "android.permission.CAMERA", granted: true },
        { name: "android.permission.RECORD_AUDIO", granted: false },
      ],
    }
    const calls = mount(async url => {
      if (url.endsWith("/status")) return status
      if (url.endsWith("/apps")) return apps
      if (url.endsWith("/system")) return system
      if (url.includes("/app?package=")) return detail
      throw new Error("unexpected route: " + url)
    })
    const user = userEvent.setup()
    await screen.findByText("Example 0")
    await user.click(screen.getByText("Example 0"))
    await screen.findByText("Version code")
    await user.click(screen.getByRole("button", { name: "Manage permissions" }))
    expect(screen.getByText("2 requested")).toBeTruthy()
    expect(screen.getByText("1 granted")).toBeTruthy()
    expect(screen.getByText("1 not granted")).toBeTruthy()
    expect(screen.getByText("android.permission.CAMERA")).toBeTruthy()
    fireEvent.change(screen.getByRole("textbox", { name: "Search Android permissions" }), { target: { value: "CAMERA" } })
    expect(screen.queryByText("android.permission.RECORD_AUDIO")).toBeNull()

    await user.click(screen.getByRole("tab", { name: /Android services/i }))
    const service = await screen.findByRole("button", { name: /com\.example.*\.Service/ })
    await user.click(service)
    expect(service.getAttribute("aria-pressed")).toBe("true")
    expect(screen.getByText("Selected Android component")).toBeTruthy()
    expect(calls.mock.calls.every(call => (call[1]?.method ?? "GET") === "GET")).toBe(true)
  })

  it("changes selected apps and inspects permissions without a second application picker", async () => {
    // Only two packages: this test covers selection, not the separately tested 175-row pagination.
    const focusedApps = { ...apps, packages: apps.packages.slice(0, 2) }
    const focusedSystem = { ...system, processes: [] }
    const calls = mount(async url => {
      if (url.endsWith("/status")) return status
      if (url.endsWith("/apps")) return focusedApps
      if (url.endsWith("/system")) return focusedSystem
      if (url.includes("/app?package=")) {
        const packageName = decodeURIComponent(url.split("package=")[1])
        return {
          version: 1, source: "android-companion", packageName,
          label: packageName.endsWith("app0") ? "Example 0" : "Example 1",
          versionName: "1.0", versionCode: 1, targetSdk: 35,
          enabled: true, system: false,
          permissions: [{ name: packageName.endsWith("app0") ?
            "android.permission.CAMERA" : "android.permission.RECORD_AUDIO",
            granted: packageName.endsWith("app0") }],
        }
      }
      throw new Error("Unexpected route")
    })
    fireEvent.click(await screen.findByText("Example 0"))
    await screen.findByText("Version code")
    fireEvent.click(screen.getByRole("button", { name: "Manage permissions" }))
    expect(screen.getByText("android.permission.CAMERA")).toBeTruthy()
    expect(screen.getByRole("button", { name: "Permissions (1)" }).getAttribute("aria-pressed")).toBe("true")
    fireEvent.click(screen.getByText("Example 1"))
    await screen.findByText("Version code")
    expect(screen.queryByText("android.permission.CAMERA")).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "Permissions (1)" }))
    expect(screen.getByText("android.permission.RECORD_AUDIO")).toBeTruthy()
    expect(calls.mock.calls.some(call => String(call[0]).includes("/app?package=com.example.app1"))).toBe(true)
  })

  it("retries an app detail request without refreshing the full Android inventory", async () => {
    let attempts = 0
    const calls = mount(async url => {
      if (url.endsWith("/status")) return status
      if (url.endsWith("/apps")) return apps
      if (url.endsWith("/system")) return system
      if (url.includes("/app?package=")) {
        attempts++
        if (attempts === 1) throw new Error("temporary failure")
        return {
          version: 1, source: "android-companion", packageName: "com.example.app20",
          label: "Example 20", versionName: "1.0", versionCode: 1, targetSdk: 35,
          enabled: true, system: false,
          permissions: [{ name: "android.permission.CAMERA", granted: true }],
        }
      }
      throw new Error("unexpected route")
    })
    const user = userEvent.setup()
    await user.click(await screen.findByText("Example 20"))
    expect(await screen.findByText("App detail request failed. Retry or choose another app.")).toBeTruthy()
    await user.click(screen.getByRole("button", { name: "Retry app details" }))
    expect(await screen.findByText("Version code")).toBeTruthy()
    expect(attempts).toBe(2)
    expect(calls.mock.calls.filter(call => String(call[0]).endsWith("/apps"))).toHaveLength(1)
  })

  it("isolates inventory failure without hiding real Shizuku connection", async () => {
    mount(async url => {
      if (url.endsWith("/status")) return status
      if (url.endsWith("/system")) return system
      throw new Error("inventory unavailable")
    })
    expect(await screen.findByText(/Shizuku · ADB/)).toBeTruthy()
    expect(await screen.findByText("Application inventory request failed. Try Refresh.")).toBeTruthy()
    await userEvent.setup().click(screen.getByRole("tab", { name: /Android services/i }))
    await waitFor(() => expect(screen.getByText(/runtime state unknown/)).toBeTruthy())
  })

  it("protects PID 1 in the UI and shows real process RSS in MiB", async () => {
    const sampleSystem = { ...system, processes: [
      { ...system.processes[0], pid: 1, name: "init", user: "root", rssKb: 0 },
      system.processes[1],
    ] }
    mount(async url => url.endsWith("/status") ? status :
      url.endsWith("/apps") ? apps : sampleSystem)
    const user = userEvent.setup()
    await screen.findByText("Example 0")
    await user.click(screen.getByRole("tab", { name: /Android processes/i }))
    const table = await screen.findByRole("table", { name: "Android processes" })
    expect(table.querySelector("thead th")?.className).toContain("sticky")
    expect(screen.getByText("0 MiB")).toBeTruthy()
    await user.click(screen.getByRole("button", { name: "Inspect process 1" }))
    expect(screen.getByText(/PID 1 is Android init/)).toBeTruthy()
    expect(screen.queryByRole("button", { name: "Send TERM to PID 1" })).toBeNull()
    await user.click(screen.getByRole("button", { name: "Inspect process 101" }))
    expect(screen.getByRole("button", { name: "Send TERM to PID 101" })).toBeTruthy()
  })

  it("sorts in table headers without a redundant toolbar and preserves RSS descending by default", async () => {
    const sample = { ...system, processes: [
      { ...system.processes[0], pid: 10, name: "alpha", rssKb: 1024, cpuPercent: 2 },
      { ...system.processes[0], pid: 20, name: "beta", rssKb: 8192, cpuPercent: 1 },
      { ...system.processes[0], pid: 30, name: "gamma", rssKb: 2048, cpuPercent: 9 },
    ] }
    mount(async url => url.endsWith("/status") ? status :
      url.endsWith("/apps") ? apps : sample)
    await screen.findByText("Example 0")
    fireEvent.click(screen.getByRole("tab", { name: /Android processes/i }))
    const table = screen.getByRole("table", { name: "Android processes" })
    const firstPid = () => table.querySelector("tbody tr td")?.textContent?.trim()
    expect(screen.queryByLabelText("Sort Android processes")).toBeNull()
    expect(firstPid()).toBe("20")
    expect(table.querySelector('th[aria-sort="descending"]')?.textContent).toContain("RSS")
    fireEvent.click(screen.getByRole("button", { name: "Sort by PID" }))
    expect(firstPid()).toBe("30")
    expect(table.querySelector('th[aria-sort="descending"]')?.textContent).toContain("PID")
    fireEvent.click(screen.getByRole("button", { name: "Sort by PID" }))
    expect(firstPid()).toBe("10")
    expect(table.querySelector('th[aria-sort="ascending"]')?.textContent).toContain("PID")
    fireEvent.click(screen.getByRole("button", { name: "Sort by CPU" }))
    expect(firstPid()).toBe("30")
    expect(table.querySelector('th[aria-sort="descending"]')?.textContent).toContain("CPU")
  })

  it("prioritizes user apps while retaining system apps under All", async () => {
    const mixed = { ...apps, packages: [
      { ...apps.packages[0], system: true },
      ...apps.packages.slice(1),
    ] }
    mount(async url => url.endsWith("/status") ? status :
      url.endsWith("/apps") ? mixed : system)
    await screen.findByText("Example 1")
    expect(screen.queryByText("Example 0")).toBeNull()
    await userEvent.setup().click(screen.getByRole("button", { name: "All" }))
    expect(screen.getByText("Example 0")).toBeTruthy()
  })

  it("keeps diagnostics idle until explicitly expanded, without Device duplication", async () => {
    const calls = mount(async url => url.endsWith("/status") ? status :
      url.endsWith("/apps") ? apps : system)
    await screen.findByText("Example 0")
    expect(screen.queryByRole("tab", { name: /^Device$/ })).toBeNull()
    expect(screen.getByText(/Advanced Shizuku diagnostics/)).toBeTruthy()
    expect(calls.mock.calls.filter(call => String(call[0]).endsWith("/status"))).toHaveLength(1)
    fireEvent.click(screen.getByText(/Advanced Shizuku diagnostics/))
    await waitFor(() => expect(calls.mock.calls.filter(call => String(call[0]).endsWith("/status"))).toHaveLength(2))
    fireEvent.click(screen.getByRole("tab", { name: /Android services/i }))
    expect(screen.queryByRole("slider", { name: /Set screen brightness/ })).toBeNull()
    expect(screen.getByRole("textbox", { name: "Search Android services" })).toBeTruthy()
    expect(screen.queryByText("Screen controls have moved to")).toBeNull()
  })

  it("keeps the application inventory mounted through a manual refresh", async () => {
    let resolveStatus: ((value: typeof status) => void) | undefined
    let attempts = 0
    mount(async url => {
      if (url.endsWith("/status")) {
        attempts++
        if (attempts === 2) return new Promise(resolve => { resolveStatus = resolve })
        return status
      }
      return url.endsWith("/apps") ? apps : system
    })
    await screen.findByText("Example 0")
    const inventory = screen.getByText("Example 0")
    const panel = screen.getByRole("tabpanel")
    expect(panel.className).not.toContain("min-h-[500px]")
    fireEvent.click(screen.getByRole("button", { name: /Refresh/ }))
    expect(screen.getByText("Example 0")).toBe(inventory)
    expect(screen.getByRole("tabpanel")).toBe(panel)
    if (!resolveStatus) throw new Error("Refresh status request not started")
    resolveStatus(status)
    await waitFor(() => expect(attempts).toBe(2))
  })
})
