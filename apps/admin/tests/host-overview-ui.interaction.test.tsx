import * as React from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { navGroups } from "@/config/navigation"

vi.mock("@/components/layouts/base-layout", () => ({
  BaseLayout: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}))
import HostOverview from "@/app/host/page"

const snapshot = {
  version: 1, mode: "read-only", platform: "termux",
  observedAt: "2026-11-11T10:00:00.000Z",
  runtime: { nodeVersion: "v26.4.0", architecture: "arm64",
    systemUptimeSeconds: 8000, freeMemoryMiB: 2000,
    totalMemoryMiB: 6000, storage: { totalMiB: 7000, availableMiB: 4000 } },
  services: ["ilestoi", "tunnel", "ssh", "mqtt", "healthwatch", "local-agent"].map(
    id => ({ id, label: id, ownership: "external", state: "running" }),
  ),
}
afterEach(() => vi.unstubAllGlobals())

describe("Host Overview stable and minimal UI", () => {
  it("places Host Inventory in Hosting, before Websites and exactly once", () => {
    const system = navGroups.find(group => group.label === "System")
    const hosting = navGroups.find(group => group.label === "Hosting")
    expect(system?.items.some(item => item.url === "/host")).toBe(false)
    expect(hosting?.items[0].url).toBe("/host")
    expect(hosting?.items[1].url).toBe("/sites")
    expect(navGroups.flatMap(group => group.items).filter(item => item.url === "/host")).toHaveLength(1)
  })

  it("reserves four cards and service list before data rather than showing a page-jumping message", async () => {
    let deliver: ((value: unknown) => void) | undefined
    const calls = vi.fn(async () => ({
      ok: true, json: () => new Promise(resolve => { deliver = resolve }),
    }))
    vi.stubGlobal("fetch", calls)
    render(<HostOverview />)
    const summaries = screen.getByTestId("host-summary")
    expect(summaries.children).toHaveLength(4)
    expect(summaries.getAttribute("aria-busy")).toBe("true")
    expect(summaries.querySelectorAll(".animate-pulse").length).toBeGreaterThanOrEqual(4)
    const services = screen.getByTestId("host-services")
    expect(services.getAttribute("aria-busy")).toBe("true")
    expect(services.querySelectorAll(".animate-pulse").length).toBeGreaterThanOrEqual(6)
    expect(screen.queryByText(/Reading Termux status/)).toBeNull()
    await waitFor(() => expect(deliver).toBeTypeOf("function"))
    deliver?.(snapshot)
    expect(await screen.findByText("v26.4.0")).toBeTruthy()
    expect(screen.getByTestId("host-summary")).toBe(summaries)
    expect(screen.getByTestId("host-services")).toBe(services)
    expect(screen.getByText("6 observed services")).toBeTruthy()
    expect(screen.queryByText(/External services are never controlled/)).toBeNull()
    expect(calls).toHaveBeenCalledTimes(1)
  })

  it("retains the last known cards and service rows during Refresh and on read errors", async () => {
    let round = 0
    let finish: ((data: unknown) => void) | undefined
    const calls = vi.fn(async () => {
      round++
      if (round === 1) return { ok: true, json: async () => snapshot }
      return { ok: true, json: () => new Promise(resolve => { finish = resolve }) }
    })
    vi.stubGlobal("fetch", calls)
    render(<HostOverview />)
    const oldValue = await screen.findByText("v26.4.0")
    const oldService = screen.getByText("ilestoi")
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }))
    await waitFor(() => expect(round).toBe(2))
    expect(screen.getByText("v26.4.0")).toBe(oldValue)
    expect(screen.getByText("ilestoi")).toBe(oldService)
    expect(screen.getByTestId("host-summary").getAttribute("aria-busy")).toBe("false")
    finish?.({ ...snapshot, runtime: { ...snapshot.runtime, nodeVersion: "v26.5.0" } })
    expect(await screen.findByText("v26.5.0")).toBeTruthy()
    expect(calls).toHaveBeenCalledTimes(2)
  })
})
