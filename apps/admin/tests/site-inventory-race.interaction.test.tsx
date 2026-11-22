import * as React from "react"
import { act, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import { MemoryRouter } from "react-router-dom"

vi.mock("@/components/layouts/base-layout", () => ({
  BaseLayout: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}))

import SitesPage from "@/app/sites/page"

const ID = "site-" + "a".repeat(32)
const RELEASE = "r-" + "b".repeat(32)
const stopped = {
  id: ID, name: "Race fixture", kind: "static-site", state: "stopped",
  port: 19080, activeRelease: RELEASE, previousRelease: null, canRollback: false,
  pid: null, startTicks: null, fileCount: 1, bytes: 20, releases: 1,
  memoryBytes: null, uptimeSeconds: null, healthy: null, history: [],
}
const running = { ...stopped, state: "running", pid: 1234, startTicks: "55555", uptimeSeconds: 3 }

afterEach(() => vi.unstubAllGlobals())

describe("Owned hosting inventory freshness", () => {
  it.each(["older success", "older error"])("ignores %s after newer owned readback", async outcome => {
    const user = userEvent.setup()
    let count = 0
    let finishOld: ((response: unknown) => void) | undefined
    const oldResponse = new Promise<unknown>(resolve => { finishOld = resolve })
    const requests = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url === "/api/v1/sites" && !init?.method) {
        count++
        if (count === 1) return { ok: true, json: async () => ({ sites: [stopped] }) }
        if (count === 2) return await oldResponse
        return { ok: true, json: async () => ({ sites: [running] }) }
      }
      if (url === "/api/v1/sites/" + ID + "/start" && init?.method === "POST")
        return { ok: true, json: async () => ({ site: running }) }
      if (url === "/api/v1/sites/" + ID && !init?.method)
        return { ok: true, json: async () => ({ site: running }) }
      throw new Error("Unexpected request: " + url)
    })
    vi.stubGlobal("fetch", requests)
    render(<MemoryRouter initialEntries={["/sites"]}><SitesPage /></MemoryRouter>)
    await screen.findByText("Race fixture")
    await user.click(screen.getByRole("button", { name: "Refresh" }))
    await waitFor(() => expect(count).toBe(2))
    await user.click(screen.getByRole("button", { name: /^Start$/ }))
    await screen.findByRole("button", { name: /^Stop$/ })
    await act(async () => {
      finishOld?.(outcome === "older success"
        ? { ok: true, json: async () => ({ sites: [stopped] }) }
        : { ok: false, status: 503 })
    })
    expect(screen.getByRole("button", { name: /^Stop$/ })).toBeTruthy()
    expect(screen.queryByRole("button", { name: /^Start$/ })).toBeNull()
    expect(screen.queryByText("Could not load static sites. Try Refresh.")).toBeNull()
    expect(requests.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(1)
  })
})
