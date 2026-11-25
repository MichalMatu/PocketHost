import * as React from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { act, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"

vi.mock("@/components/layouts/base-layout", () => ({
  BaseLayout: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}))

import SitesPage from "@/app/sites/page"

const ID = "site-" + "a".repeat(32)
const RELEASE = "r-" + "b".repeat(32)


function renderSites(route = "/sites/" + ID) {
  return render(<MemoryRouter initialEntries={[route]}><SitesPage /></MemoryRouter>)
}

function project(state: "stopped" | "running" | "unknown" = "stopped", active = false) {
  return {
    id: ID,
    name: "My own site",
    kind: "static-site",
    state,
    port: 19080,
    activeRelease: active ? RELEASE : null,
    previousRelease: null,
    canRollback: false,
    pid: state === "running" ? 1234 : null,
    startTicks: state === "running" ? "55555" : null,
    fileCount: active ? 2 : 0,
    bytes: active ? 345 : 0,
    releases: active ? 1 : 0,
    memoryBytes: null,
    uptimeSeconds: state === "running" ? 12 : null,
    healthy: null,
    history: [],
  }
}


afterEach(() => vi.unstubAllGlobals())

describe("H2.1 version-management UI", () => {
  const archived = "r-" + "d".repeat(32)
  const previous = "r-" + "c".repeat(32)

  function withVersionedSite(state: "running" | "unknown" = "running") {
    const site = {
      ...project(state, true),
      previousRelease: previous as string | null,
      canRollback: true,
      releases: 3,
      // Release details and catalog summary must describe the same active bytes.
      fileCount: 3,
      bytes: 11800,
    }
    let versions = [RELEASE, previous, archived].map((id, index) => ({
      id,
      createdAt: ["2026-11-07T09:00:00.000Z", "2026-11-06T09:00:00.000Z", "2026-11-05T09:00:00.000Z"][index],
      fileCount: 3,
      bytes: 11800,
      active: id === RELEASE,
      rollbackTarget: id === previous,
    }))
    const calls = vi.fn(async (input: RequestInfo | URL, options?: RequestInit) => {
      const url = String(input)
      if (url === "/api/v1/sites" && !options?.method)
        return { ok: true, json: async () => ({ sites: [site] }) }
      if (url === "/api/v1/sites/" + ID && !options?.method)
        return { ok: true, json: async () => ({ site }) }
      if (url === "/api/v1/sites/" + ID + "/releases" && !options?.method)
        return { ok: true, json: async () => ({ releases: versions }) }
      const match = new RegExp("^/api/v1/sites/" + ID + "/releases/(r-[a-f0-9]{32})/(restore|prune)$").exec(url)
      if (match && options) {
        expect((options.headers as Record<string, string>)["X-PocketHost-Intent"]).toBe("owned-sites")
        if (match[2] === "restore") {
          expect(options.method).toBe("POST")
          site.previousRelease = site.activeRelease
          site.activeRelease = match[1]
          site.canRollback = true
          versions = versions.map(v => ({
            ...v,
            active: v.id === site.activeRelease,
            rollbackTarget: v.id === site.previousRelease,
          }))
          return { ok: true, json: async () => ({ site }) }
        }
        expect(options.method).toBe("DELETE")
        expect(match[1]).not.toBe(site.activeRelease)
        expect(match[1]).not.toBe(site.previousRelease)
        versions = versions.filter(v => v.id !== match[1])
        site.releases = versions.length
        return { ok: true, json: async () => ({ site }) }
      }
      return { ok: false, status: 404, json: async () => ({ error: "not found" }) }
    })
    vi.stubGlobal("fetch", calls)
    vi.stubGlobal("confirm", vi.fn(() => true))
    renderSites()
    return calls
  }

  it("allows canceling a pending version read from the actual button and reopening immediately", async () => {
    const user = userEvent.setup()
    const normalFetch = withVersionedSite()
    await screen.findByText("My own site")
    let releaseOld!: (value: { ok: boolean; json: () => Promise<{ releases: never[] }> }) => void
    const pendingOld = new Promise<{ ok: boolean; json: () => Promise<{ releases: never[] }> }>(
      resolve => { releaseOld = resolve },
    )
    let heldFirst = false
    const requests = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === "/api/v1/sites/" + ID + "/releases" && !init?.method && !heldFirst) {
        heldFirst = true
        return pendingOld
      }
      return normalFetch(input, init)
    })
    vi.stubGlobal("fetch", requests)

    await user.click(await screen.findByRole("tab", { name: "Versions" }))
    await user.click(screen.getByRole("button", { name: "Manage versions" }))
    const cancel = screen.getByRole("button", { name: "Cancel version read" }) as HTMLButtonElement
    expect(cancel.disabled).toBe(false)
    await user.click(cancel)
    expect(screen.getByRole("button", { name: "Manage versions" })).toBeTruthy()
    await user.click(screen.getByRole("button", { name: "Manage versions" }))
    await screen.findByRole("heading", { name: "Saved releases" })
    expect(screen.getAllByRole("link", { name: "Preview" })).toHaveLength(3)

    await act(async () => {
      releaseOld({ ok: true, json: async () => ({ releases: [] }) })
      await pendingOld
    })
    expect(screen.getAllByRole("link", { name: "Preview" })).toHaveLength(3)
    expect(requests).toHaveBeenCalledTimes(2)
  })

  it("shows actual immutable release dates, preview URLs and protected archived versions", async () => {
    const user = userEvent.setup()
    const mock = withVersionedSite()
    await screen.findByText("My own site")
    await user.click(await screen.findByRole("tab", { name: "Versions" }))
    await user.click(screen.getByRole("button", { name: /Manage versions/ }))
    await screen.findByRole("heading", { name: "Saved releases" })
    expect(screen.getAllByRole("link", { name: "Preview" })).toHaveLength(3)
    expect(screen.getAllByRole("link", { name: "Preview" })[2].getAttribute("href"))
      .toContain("/__versions/" + archived + "/")
    const restoreButtons = screen.getAllByRole("button", { name: "Restore" }) as HTMLButtonElement[]
    const deleteButtons = screen.getAllByRole("button", { name: "Delete archive" }) as HTMLButtonElement[]
    expect(restoreButtons[0].disabled).toBe(true)
    expect(restoreButtons[2].disabled).toBe(false)
    expect(deleteButtons[0].disabled).toBe(true)
    expect(deleteButtons[1].disabled).toBe(true)
    expect(deleteButtons[2].disabled).toBe(false)
    expect(mock.mock.calls.some(call => call[1]?.method === "POST")).toBe(false)
  })

  it("restores an arbitrary archive and prunes only a now-unprotected release", async () => {
    const user = userEvent.setup()
    const mock = withVersionedSite()
    await screen.findByText("My own site")
    await user.click(await screen.findByRole("tab", { name: "Versions" }))
    await user.click(screen.getByRole("button", { name: /Manage versions/ }))
    await screen.findByRole("heading", { name: "Saved releases" })
    await user.click(screen.getAllByRole("button", { name: "Restore" })[2])
    await screen.findByText(/Selected release restored/)
    expect(mock.mock.calls.some(call => call[1]?.method === "POST" && String(call[0]).endsWith("/" + archived + "/restore"))).toBe(true)
    await user.click(screen.getAllByRole("button", { name: "Delete archive" })[1])
    await screen.findByText(/Archived release permanently removed/)
    expect(screen.getAllByRole("link", { name: "Preview" })).toHaveLength(2)
    expect(mock.mock.calls.some(call => call[1]?.method === "DELETE" && String(call[0]).endsWith("/" + previous + "/prune"))).toBe(true)
  })

  it("unknown process identity permits read-only history but blocks restore and prune", async () => {
    const user = userEvent.setup()
    const mock = withVersionedSite("unknown")
    await screen.findByText(/Process identity is uncertain/)
    await user.click(await screen.findByRole("tab", { name: "Versions" }))
    await user.click(screen.getByRole("button", { name: /Manage versions/ }))
    await screen.findByRole("heading", { name: "Saved releases" })
    expect(screen.queryAllByRole("link", { name: "Preview" })).toHaveLength(0)
    expect(screen.getAllByRole("button", { name: "Restore" }).every(button => (button as HTMLButtonElement).disabled)).toBe(true)
    expect(screen.getAllByRole("button", { name: "Delete archive" }).every(button => (button as HTMLButtonElement).disabled)).toBe(true)
    expect(mock.mock.calls.some(call => ["POST", "DELETE"].includes(call[1]?.method || ""))).toBe(false)
  })
})
