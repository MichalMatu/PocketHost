import * as React from "react"
import { afterEach, expect, it, vi } from "vitest"
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"

const mocks = vi.hoisted(() => ({ readSites: vi.fn() }))
vi.mock("@/app/sites/site-client", () => ({ readSites: mocks.readSites }))

import { useOwnedSiteInventory } from "@/app/sites/use-owned-site-inventory"

afterEach(() => {
  cleanup()
  mocks.readSites.mockReset()
})

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: Error) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

type Site = { id: string; name: string }
const site = (id: string): Site => ({ id, name: id })

function Probe() {
  const { sites, loading, error, refresh, reload } = useOwnedSiteInventory()
  return <main>
    <output data-testid="status">{loading ? "loading" : "ready"}</output>
    <output data-testid="inventory">{sites.map(site => site.name).join(",")}</output>
    <output data-testid="error">{error ?? "none"}</output>
    <button onClick={() => void refresh()}>Refresh</button>
    <button onClick={() => void reload().catch(() => {})}>Readback</button>
  </main>
}

it("a stale initial read cannot affect a newer manual refresh or loading", async () => {
  const initial = deferred<Site[]>()
  const newer = deferred<Site[]>()
  mocks.readSites.mockImplementationOnce(() => initial.promise)
    .mockImplementationOnce(() => newer.promise)
  render(<Probe />)
  await waitFor(() => expect(mocks.readSites).toHaveBeenCalledTimes(1))
  fireEvent.click(screen.getByRole("button", { name: "Refresh" }))
  await waitFor(() => expect(mocks.readSites).toHaveBeenCalledTimes(2))
  expect(screen.getByTestId("status").textContent).toBe("loading")
  await act(async () => { newer.resolve([site("new")]) })
  expect(screen.getByTestId("status").textContent).toBe("ready")
  expect(screen.getByTestId("inventory").textContent).toBe("new")
  await act(async () => { initial.reject(new Error("late request failed")) })
  expect(screen.getByTestId("status").textContent).toBe("ready")
  expect(screen.getByTestId("inventory").textContent).toBe("new")
  expect(screen.getByTestId("error").textContent).toBe("none")
})

it("a superseded Refresh cannot end loading before a later site readback finishes", async () => {
  const refresh = deferred<Site[]>()
  const readback = deferred<Site[]>()
  mocks.readSites.mockResolvedValueOnce([site("first")])
    .mockImplementationOnce(() => refresh.promise)
    .mockImplementationOnce(() => readback.promise)
  render(<Probe />)
  await waitFor(() => expect(screen.getByTestId("status").textContent).toBe("ready"))
  expect(screen.getByTestId("inventory").textContent).toBe("first")
  fireEvent.click(screen.getByRole("button", { name: "Refresh" }))
  await waitFor(() => expect(mocks.readSites).toHaveBeenCalledTimes(2))
  fireEvent.click(screen.getByRole("button", { name: "Readback" }))
  await waitFor(() => expect(mocks.readSites).toHaveBeenCalledTimes(3))
  await act(async () => { refresh.resolve([site("stale")]) })
  expect(screen.getByTestId("status").textContent).toBe("loading")
  expect(screen.getByTestId("inventory").textContent).toBe("first")
  await act(async () => { readback.resolve([site("latest")]) })
  expect(screen.getByTestId("status").textContent).toBe("ready")
  expect(screen.getByTestId("inventory").textContent).toBe("latest")
  expect(screen.getByTestId("error").textContent).toBe("none")
})
