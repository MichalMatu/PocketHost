import * as React from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, within } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import ObservabilityPage from "@/app/observability/page"

vi.mock("@/components/layouts/base-layout", () => ({
  BaseLayout: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}))
vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogContent: () => null,
  DialogHeader: () => null,
  DialogTitle: () => null,
  DialogDescription: () => null,
}))

const now = () => new Date().toISOString()
const reading = (state: "ok" | "unavailable") => state === "ok"
  ? { state: "ok", value: 60, observedAt: now() }
  : { state: "unavailable", value: null, observedAt: now() }
const sample = () => ({
  version: 1, mode: "read-only", observedAt: now(),
  host: {
    version: 1, mode: "read-only", platform: "termux", observedAt: now(),
    runtime: { nodeVersion: "v26.1.0", architecture: "arm64", systemUptimeSeconds: 4000,
      totalMemoryMiB: 8000, freeMemoryMiB: 3000,
      storage: { totalMiB: 1000, availableMiB: 500 } },
    services: ["ilestoi", "tunnel", "ssh", "mqtt", "healthwatch", "local-agent"].map(id =>
      ({ id, label: id, ownership: "external", state: "running" })),
  },
  metrics: {
    cpuPercent: reading("unavailable"),
    batteryPercent: reading("ok"),
    network: reading("unavailable"),
  },
  processes: {
    state: "ok", observedAt: now(), partial: true, truncated: false,
    processes: [
      { name: "node", pid: 220, ppid: 1, startTicks: "550", cpuTicks: 250, rssMiB: 12.5, ownership: "self" },
      { name: "python3", pid: 110, ppid: 1, startTicks: "250", cpuTicks: 550, rssMiB: 9, ownership: "unverified" },
    ],
  },
  packages: { state: "ok", observedAt: now(), installed: [{ ecosystem: "termux", name: "curl", version: "9.0" }],
    truncated: false, updates: { state: "unknown", candidates: [] } },
  diagnostics: {
    state: "ok", events: [{ timestamp: now(), instanceId: "owned-test", code: "sample-event" }],
  },
  history: [],
  alerts: ["CPU metric unavailable", "Network counters unavailable"],
})

afterEach(() => vi.unstubAllGlobals())

describe("Monitoring screen: diagnostic-only scope", () => {
  it("shows one process table, source states and events but no Dashboard summary clones", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => sample() })))
    render(<MemoryRouter><ObservabilityPage /></MemoryRouter>)
    expect(await screen.findByText("Process diagnostics")).toBeTruthy()
    expect(screen.getByText("Telemetry sources")).toBeTruthy()
    expect(screen.getByText("Diagnostic events")).toBeTruthy()
    expect(screen.getByText("2 visible processes")).toBeTruthy()
    expect(screen.getByRole("table", { name: "Termux-visible process details" })).toBeTruthy()
    const table = screen.getByRole("table", { name: "Termux-visible process details" })
    expect(within(table).getAllByRole("row")[1]?.textContent).toContain("node")
    expect(screen.queryByText("CPU ticks (lifetime total)")).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "Process details for PID 110" }))
    expect(screen.getByText("CPU ticks (lifetime total)")).toBeTruthy()
    expect(screen.getByText("550", { selector: "dd" })).toBeTruthy()
    expect(screen.queryByText("Available RAM")).toBeNull()
    expect(screen.queryByText("Free Termux storage")).toBeNull()
    expect(screen.queryByText("Installed packages")).toBeNull()
    expect(screen.queryByText("Service status")).toBeNull()
    expect(screen.queryByText("Termux process activity")).toBeNull()
    expect(screen.getByText("Termux CPU counters")).toBeTruthy()
    expect(screen.getByText("Termux battery")).toBeTruthy()
    expect(screen.getByText("sample event")).toBeTruthy()
    expect(screen.queryByText("CPU metric unavailable")).toBeNull()
    expect(screen.getByRole("link", { name: "Dashboard trends" })).toBeTruthy()
    expect(screen.getByRole("link", { name: "Services & Processes" })).toBeTruthy()
    expect(screen.getByRole("link", { name: "Packages & Software" })).toBeTruthy()
  })

  it("filters and sorts process details without claiming live CPU percentages", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => sample() })))
    render(<MemoryRouter><ObservabilityPage /></MemoryRouter>)
    const table = await screen.findByRole("table", { name: "Termux-visible process details" })
    let rows = within(table).getAllByRole("row")
    expect(rows[1]?.textContent).toContain("node")
    fireEvent.click(screen.getByRole("button", { name: "CPU ticks" }))
    rows = within(table).getAllByRole("row")
    expect(rows[1]?.textContent).toContain("python3")
    fireEvent.click(screen.getByRole("button", { name: "PID" }))
    rows = within(table).getAllByRole("row")
    expect(rows[1]?.textContent).toContain("python3")
    fireEvent.click(screen.getByRole("button", { name: "Process RAM" }))
    rows = within(table).getAllByRole("row")
    expect(rows[1]?.textContent).toContain("node")
    fireEvent.change(screen.getByRole("textbox", { name: "Filter processes" }), { target: { value: "python" } })
    expect(within(table).getAllByRole("row")).toHaveLength(2)
    expect(table.textContent).toContain("python3")
    expect(table.textContent).not.toContain("node")
    expect(screen.getByText(/cumulative since each process started/)).toBeTruthy()
  })

  it("keeps permission failures and missing process inventory explicitly unavailable", async () => {
    const fixture = sample()
    fixture.processes.state = "permission-denied"
    fixture.processes.processes = []
    fixture.diagnostics.state = "unavailable"
    fixture.diagnostics.events = []
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => fixture })))
    render(<MemoryRouter><ObservabilityPage /></MemoryRouter>)
    expect(await screen.findByText("Process list unavailable")).toBeTruthy()
    expect(screen.queryByRole("table")).toBeNull()
    expect(screen.getByText(/no zero-process assumption/)).toBeTruthy()
    expect(screen.getByText("Host diagnostic event stream is not connected yet.")).toBeTruthy()
    expect(screen.getByRole("link", { name: "Logs & Diagnostics" })).toBeTruthy()
    expect(screen.queryByText("Diagnostic events")).toBeNull()
  })

  it("marks a missing or unsafe process name Unknown without inventing an executable", async () => {
    const fixture = sample()
    fixture.processes.processes[0]!.name = null
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => fixture })))
    render(<MemoryRouter><ObservabilityPage /></MemoryRouter>)
    const table = await screen.findByRole("table", { name: "Termux-visible process details" })
    expect(within(table).getByText("Unknown")).toBeTruthy()
    expect(screen.getByRole("button", { name: "Process details for PID 220" })).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Process details for PID 220" }))
    expect(within(table).getByText("Unavailable")).toBeTruthy()
  })

  it("shows a real endpoint failure instead of fake empty monitoring", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false })))
    render(<MemoryRouter><ObservabilityPage /></MemoryRouter>)
    expect(await screen.findByRole("alert")).toBeTruthy()
    expect(screen.queryByRole("table")).toBeNull()
    expect(screen.getByText("No diagnostic snapshot available.")).toBeTruthy()
  })
})
