import * as React from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { render, screen, within } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import SystemPage from "@/app/termux/system-page"

vi.mock("@/components/layouts/base-layout", () => ({
  BaseLayout: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}))
vi.mock("@/components/ui/chart", () => ({
  ChartContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="live-chart">{children}</div>,
  ChartTooltip: () => null,
  ChartTooltipContent: () => null,
}))
vi.mock("recharts", () => ({
  AreaChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  LineChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CartesianGrid: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Area: () => null,
  Line: () => null,
}))

const hostFixture = {
  version: 1, mode: "read-only", platform: "termux",
  observedAt: "2026-11-10T09:00:00.000Z",
  runtime: {
    nodeVersion: "v26.13.0", architecture: "arm64", systemUptimeSeconds: 1234,
    totalMemoryMiB: 4096, freeMemoryMiB: 2048,
    storage: { totalMiB: 150000, availableMiB: 120093 },
  },
  services: ["ilestoi", "tunnel", "ssh", "mqtt", "healthwatch", "local-agent"].map(id => ({
    id, label: id, ownership: "external", state: "running",
  })),
}

const bridgeFixture = () => ({
  version: 1, source: "android-companion", connected: true, authorized: true,
  mode: "adb", observedAt: new Date().toISOString(), uid: 2000,
  cpuPercent: 22.5, visibleProcesses: 550, capabilities: [],
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe("PocketHost real-data dashboard", () => {
  it("shows only live Termux and authorized Android metrics, never demo runtime or module tiles", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => ({
      ok: true,
      json: async () => url.includes("shizuku") ? bridgeFixture() : hostFixture,
    })))
    render(<MemoryRouter><SystemPage /></MemoryRouter>)
    const metrics = screen.getByTestId("system-metrics")
    expect(within(metrics).getAllByLabelText("Loading")).toHaveLength(4)
    await within(metrics).findByText("22.5%")
    expect(within(metrics).getByText("2.0 GiB")).toBeTruthy()
    expect(within(metrics).getByText("117.3 GiB")).toBeTruthy()
    expect(within(metrics).getByText("6 / 6")).toBeTruthy()
    expect(screen.getByText("Live system resources")).toBeTruthy()
    expect(screen.getByText("Android Bridge connectivity")).toBeTruthy()
    expect(screen.getByText("Connected · authorized")).toBeTruthy()
    expect(screen.queryByText("Node runtime")).toBeNull()
    expect(screen.queryByText("v26.13.0")).toBeNull()
    expect(screen.queryByText("File Manager")).toBeNull()
    expect(screen.queryByText("Packages")).toBeNull()
    expect(screen.getAllByTestId("live-chart")).toHaveLength(3)
  })

  it("keeps unknown / inaccessible Android CPU explicitly unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => ({
      ok: true,
      json: async () => url.includes("shizuku")
        ? { ...bridgeFixture(), authorized: false, connected: false, mode: "none", cpuPercent: null, visibleProcesses: null, uid: null }
        : hostFixture,
    })))
    render(<MemoryRouter><SystemPage /></MemoryRouter>)
    const metrics = screen.getByTestId("system-metrics")
    await within(metrics).findByText("6 / 6")
    expect(within(metrics).getByText("Unavailable")).toBeTruthy()
    expect(screen.getByText("Android Bridge: disconnected or unauthorized")).toBeTruthy()
    expect(screen.getByText("Disconnected · last status received")).toBeTruthy()
    expect(screen.queryByText("0.0%")).toBeNull()
    expect(screen.getAllByTestId("live-chart")).toHaveLength(3)
  })

  it("reports genuine API and bridge unavailability without fabricated samples", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false })))
    render(<MemoryRouter><SystemPage /></MemoryRouter>)
    const metrics = screen.getByTestId("system-metrics")
    await within(metrics).findAllByText("Unavailable")
    expect(within(metrics).getAllByText("Unavailable")).toHaveLength(4)
    expect(screen.getByText("No successful PocketHost API request yet.")).toBeTruthy()
    expect(screen.getByText("No successful Bridge status API request yet.")).toBeTruthy()
    expect(screen.queryAllByTestId("live-chart")).toHaveLength(0)
  })
})
