import * as React from "react"
import { afterEach, expect, it, vi } from "vitest"
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"

const mocks = vi.hoisted(() => ({ readSites: vi.fn() }))
vi.mock("@/app/sites/site-client", () => ({ readSites: mocks.readSites }))
import { useOwnedSiteInventory } from "@/app/sites/use-owned-site-inventory"
import type { FleetSite } from "@/lib/site-fleet-schema"

afterEach(() => { cleanup(); mocks.readSites.mockReset() })

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: Error) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

type Site = FleetSite
const site = (name: string): Site => ({
  id: "site-" + (name === "confirmed" ? "a" : name === "stale" ? "b" : "c").repeat(32),
  name, kind: "static-site", state: "stopped", port: 19080,
  activeRelease: null, previousRelease: null, canRollback: false,
  pid: null, startTicks: null, fileCount: 0, bytes: 0, releases: 0,
  memoryBytes: null, uptimeSeconds: null, healthy: null, history: [],
})

function Probe() {
  const { sites, setSites, loading, error, refresh } = useOwnedSiteInventory()
  return <main>
    <output data-testid="inventory">{sites.map(item => item.name).join(",")}</output>
    <output data-testid="status">{loading ? "loading" : "ready"}</output>
    <output data-testid="error">{error ?? "none"}</output>
    <button onClick={() => void refresh()}>Refresh</button>
    <button onClick={() => setSites([site("confirmed")])}>Confirm mutation</button>
    <button onClick={() => setSites([])}>Mark unconfirmed</button>
  </main>
}

it.each(["success", "failure"] as const)(
  "does not replace a confirmed mutation after a stale %s read", async outcome => {
    const old = deferred<Site[]>()
    mocks.readSites.mockResolvedValueOnce([site("before")])
      .mockImplementationOnce(() => old.promise)
    render(<Probe />)
    await waitFor(() => expect(screen.getByTestId("inventory").textContent).toBe("before"))
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }))
    await waitFor(() => expect(screen.getByTestId("status").textContent).toBe("loading"))
    fireEvent.click(screen.getByRole("button", { name: "Confirm mutation" }))
    expect(screen.getByTestId("inventory").textContent).toBe("confirmed")
    expect(screen.getByTestId("status").textContent).toBe("ready")
    await act(async () => {
      if (outcome === "success") old.resolve([site("stale")])
      else old.reject(new Error("stale read failed"))
    })
    expect(screen.getByTestId("inventory").textContent).toBe("confirmed")
    expect(screen.getByTestId("error").textContent).toBe("none")
    expect(screen.getByTestId("status").textContent).toBe("ready")
  },
)

it("does not restore stale inventory after an unconfirmed mutation cleared it", async () => {
  const old = deferred<Site[]>()
  mocks.readSites.mockResolvedValueOnce([site("before")])
    .mockImplementationOnce(() => old.promise)
  render(<Probe />)
  await waitFor(() => expect(screen.getByTestId("inventory").textContent).toBe("before"))
  fireEvent.click(screen.getByRole("button", { name: "Refresh" }))
  await waitFor(() => expect(screen.getByTestId("status").textContent).toBe("loading"))
  fireEvent.click(screen.getByRole("button", { name: "Mark unconfirmed" }))
  await act(async () => { old.resolve([site("stale")]) })
  expect(screen.getByTestId("inventory").textContent).toBe("")
  expect(screen.getByTestId("error").textContent).toBe("none")
  expect(screen.getByTestId("status").textContent).toBe("ready")
})
