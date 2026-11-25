import * as React from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import userEvent from "@testing-library/user-event"
vi.mock("@/components/layouts/base-layout", () => ({
  BaseLayout: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}))

import SitesPage from "@/app/sites/page"
import { starterHtml } from "@/app/sites/site-client"

afterEach(() => vi.unstubAllGlobals())

const site = {
  id: "site-" + "a".repeat(32),
  name: "My test",
  kind: "static-site",
  state: "stopped",
  port: 19500,
  activeRelease: null,
  previousRelease: null,
  canRollback: false,
  pid: null,
  startTicks: null,
  fileCount: 0,
  bytes: 0,
  releases: 0,
  memoryBytes: null,
  uptimeSeconds: null,
  healthy: null,
  history: [],
}

describe("Static site HTML starter", () => {
  it("publishes the starter through the same owned site API and readback gate", async () => {
    const user = userEvent.setup()
    const next = { ...site, activeRelease: "r-" + "b".repeat(32),
      releases: 1, fileCount: 1, bytes: new TextEncoder().encode(starterHtml).length,
      history: [{ at: new Date().toISOString(), action: "publish",
        from: null, to: "r-" + "b".repeat(32) }] }
    let current = site
    const requests = vi.fn(async (url: string, options?: RequestInit) => {
      if (options?.method === "PUT") {
        current = next
        return { ok: true, json: async () => ({ site: next }) }
      }
      return { ok: true, json: async () => url.endsWith(site.id)
        ? { site: current } : { sites: [current] } }
    })
    vi.stubGlobal("fetch", requests)
    render(<MemoryRouter initialEntries={["/sites/" + site.id]}><SitesPage /></MemoryRouter>)
    await screen.findByText("My test")
    await user.click(screen.getByRole("button", { name: "Edit starter HTML" }))
    await user.click(screen.getByRole("button", { name: "Publish HTML" }))
    expect(await screen.findByText(/HTML was published as a new immutable release/)).toBeTruthy()
    const puts = requests.mock.calls.filter(call => call[1]?.method === "PUT")
    expect(puts).toHaveLength(1)
    expect(puts[0][1]?.headers).toMatchObject({
      "X-PocketHost-Intent": "owned-sites",
      "Content-Type": "application/json",
    })
    const payload = JSON.parse(String(puts[0][1]?.body))
    expect(payload.files[0].name).toBe("index.html")
    expect(payload.files[0].base64).toMatch(/^[A-Za-z0-9+/=]+$/)
  })
})
