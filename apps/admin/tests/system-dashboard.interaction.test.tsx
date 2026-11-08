import * as React from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { render, screen, within } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import SystemPage from "@/app/termux/system-page"

vi.mock("@/components/layouts/base-layout", () => ({
  BaseLayout: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}))

const fixture = {
  version: 1,
  mode: "read-only",
  platform: "termux",
  observedAt: "2026-11-08T06:30:00.000Z",
  runtime: {
    nodeVersion: "v26.4.0",
    architecture: "arm64",
    systemUptimeSeconds: 1234,
    totalMemoryMiB: 4096,
    freeMemoryMiB: 2312,
    storage: { totalMiB: 150000, availableMiB: 120093 },
  },
  services: ["ilestoi", "tunnel", "ssh", "mqtt", "healthwatch", "local-agent"].map(id => ({
    id, label: id, ownership: "external", state: "running",
  })),
}

afterEach(() => vi.unstubAllGlobals())

describe("system dashboard stable metrics layout", () => {
  it("keeps all four metric cards mounted before and after data resolves", async () => {
    let resolveFetch!: (value: unknown) => void
    const pending = new Promise(resolve => { resolveFetch = resolve })
    vi.stubGlobal("fetch", vi.fn(() => pending))
    render(<MemoryRouter><SystemPage /></MemoryRouter>)
    const metrics = screen.getByTestId("system-metrics")
    expect(metrics.getAttribute("aria-busy")).toBe("true")
    for (const label of ["Node runtime", "Free RAM", "Free Termux storage", "Observed services"]) {
      expect(within(metrics).getByText(label)).toBeTruthy()
    }
    expect(within(metrics).getAllByLabelText("Loading")).toHaveLength(4)
    resolveFetch({ ok: true, json: async () => fixture })
    await within(metrics).findByText("v26.4.0")
    expect(metrics.getAttribute("aria-busy")).toBe("false")
    expect(within(metrics).queryAllByLabelText("Loading")).toHaveLength(0)
    expect(within(metrics).getByText("2,312 MiB")).toBeTruthy()
    expect(within(metrics).getByText("120,093 MiB")).toBeTruthy()
    expect(within(metrics).getByText("6")).toBeTruthy()
  })

  it("keeps card positions and displays Unavailable if host status fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false })))
    render(<MemoryRouter><SystemPage /></MemoryRouter>)
    const metrics = screen.getByTestId("system-metrics")
    expect(within(metrics).getAllByLabelText("Loading")).toHaveLength(4)
    await screen.findByRole("alert")
    expect(metrics.getAttribute("aria-busy")).toBe("false")
    expect(within(metrics).getAllByText("Unavailable")).toHaveLength(5)
    expect(within(metrics).queryAllByLabelText("Loading")).toHaveLength(0)
  })
})
