import * as React from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

vi.mock("@/components/layouts/base-layout", () => ({
  BaseLayout: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}))

import SitesPage from "@/app/sites/page"

const ID = "site-" + "a".repeat(32)
const RELEASE = "r-" + "b".repeat(32)

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

function withSites(initial: ReturnType<typeof project>[] = []) {
  let sites = [...initial]
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    if (url === "/api/v1/sites" && (!init?.method || init.method === "GET"))
      return { ok: true, json: async () => ({ sites }) }
    if (url === "/api/v1/sites/" && init?.method === "POST") {
      expect((init.headers as Record<string, string>)["X-PocketHost-Intent"]).toBe("owned-sites")
      expect(JSON.parse(String(init.body)).name).toBe("My own site")
      const site = project()
      sites = [site]
      return { ok: true, json: async () => ({ site }) }
    }
    if (url === "/api/v1/sites/" + ID + "/files" && (!init?.method || init.method === "GET"))
      return { ok: true, json: async () => ({ files: [
        { name: "index.html", bytes: 120 }, { name: "css/main.css", bytes: 225 },
      ] }) }
    if (url.endsWith("/health"))
      return { ok: true, json: async () => ({ healthy: true }) }
    if (url.endsWith("/logs"))
      return { ok: true, json: async () => ({ logs: ["PocketHost owned H2 site listening"] }) }
    return { ok: false, status: 404, json: async () => ({ error: "not-found" }) }
  })
  vi.stubGlobal("fetch", fetchMock)
  render(<SitesPage />)
  return fetchMock
}

afterEach(() => vi.unstubAllGlobals())

describe("H2 browser site-manager lifecycle", () => {
  it("creates one explicitly owned site with deliberate intent but cannot start before publishing", async () => {
    const user = userEvent.setup()
    const fetchMock = withSites()
    await screen.findByText(/No user sites created yet/)
    await user.type(screen.getByLabelText("Site name"), "My own site")
    await user.click(screen.getByRole("button", { name: /Create site/ }))
    await screen.findByText("My own site")
    expect(screen.getByText(ID)).toBeTruthy()
    expect((screen.getByRole("button", { name: /Start/ }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole("button", { name: /Rollback/ }) as HTMLButtonElement).disabled).toBe(true)
    expect(fetchMock.mock.calls.some(call => call[1]?.method === "POST")).toBe(true)
    expect(fetchMock.mock.calls.some(call => call[1]?.method === "PUT")).toBe(false)
  })

  it("starts only the selected PocketHost-owned site through Hosting with explicit intent", async () => {
    const user = userEvent.setup()
    let current = project("stopped", true)
    const calls = vi.fn(async (input: RequestInfo | URL, options?: RequestInit) => {
      const url = String(input)
      if (url === "/api/v1/sites" && !options?.method)
        return { ok: true, json: async () => ({ sites: [current] }) }
      if (url === "/api/v1/sites/" + ID + "/start" && options?.method === "POST") {
        expect((options.headers as Record<string, string>)["X-PocketHost-Intent"]).toBe("owned-sites")
        current = project("running", true)
        return { ok: true, json: async () => ({ site: current }) }
      }
      return { ok: false, status: 404, json: async () => ({ error: "not-found" }) }
    })
    vi.stubGlobal("fetch", calls)
    render(<SitesPage />)
    await screen.findByText("My own site")
    await user.click(screen.getByRole("button", { name: /^Start$/ }))
    await screen.findByText("Start completed.")
    expect(calls.mock.calls.filter(call => call[1]?.method === "POST")).toHaveLength(1)
    expect(screen.getByRole("button", { name: /Stop/ })).toBeTruthy()
  })

  it("with uncertain process identity blocks all writes while retaining read-only logs", async () => {
    const user = userEvent.setup()
    const fetchMock = withSites([project("unknown", true)])
    await screen.findByText(/Process identity is uncertain/)
    expect((screen.getByRole("button", { name: /Start/ }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByLabelText("Upload static ZIP") as HTMLInputElement).disabled).toBe(true)
    await user.click(screen.getByRole("button", { name: /Read logs/ }))
    await screen.findByText(/PocketHost owned H2 site listening/)
    expect(fetchMock.mock.calls.every(call => call[1]?.method !== "POST")).toBe(true)
  })

  it("inspects bounded active-release files inside Hosting without mutating processes", async () => {
    const user = userEvent.setup()
    const calls = withSites([project("stopped", true)])
    await screen.findByText("My own site")
    await user.click(screen.getByRole("button", { name: "Inspect assets" }))
    await screen.findByText("css/main.css")
    expect(screen.getByRole("region", { name: "Active assets of My own site" })).toBeTruthy()
    expect(calls.mock.calls.some(call => String(call[0]) === "/api/v1/sites/" + ID + "/files")).toBe(true)
    expect(calls.mock.calls.every(call => (call[1]?.method ?? "GET") === "GET")).toBe(true)
    await user.click(screen.getByRole("button", { name: "Hide assets" }))
    expect(screen.queryByText("css/main.css")).toBeNull()
  })

  it("renders real owned PID and asynchronous HTTP verification result", async () => {
    const user = userEvent.setup()
    withSites([project("running", true)])
    await screen.findByText(/1234 \/ 55555/)
    expect(screen.getByRole("button", { name: /Restart/ })).toBeTruthy()
    expect(screen.getByRole("button", { name: /Stop/ })).toBeTruthy()
    await user.click(screen.getByRole("button", { name: /Verify HTTP/ }))
    await screen.findByText(/HTTP: healthy/)
  })
})


describe("H2.1 version-management UI", () => {
  const archived = "r-" + "d".repeat(32)
  const previous = "r-" + "c".repeat(32)

  function withVersionedSite(state: "running" | "unknown" = "running") {
    const site = {
      ...project(state, true),
      previousRelease: previous as string | null,
      canRollback: true,
      releases: 3,
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
    render(<SitesPage />)
    return calls
  }

  it("shows actual immutable release dates, preview URLs and protected archived versions", async () => {
    const user = userEvent.setup()
    const mock = withVersionedSite()
    await screen.findByText("My own site")
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
    await user.click(screen.getByRole("button", { name: /Manage versions/ }))
    await screen.findByRole("heading", { name: "Saved releases" })
    expect(screen.queryAllByRole("link", { name: "Preview" })).toHaveLength(0)
    expect(screen.getAllByRole("button", { name: "Restore" }).every(button => (button as HTMLButtonElement).disabled)).toBe(true)
    expect(screen.getAllByRole("button", { name: "Delete archive" }).every(button => (button as HTMLButtonElement).disabled)).toBe(true)
    expect(mock.mock.calls.some(call => ["POST", "DELETE"].includes(call[1]?.method || ""))).toBe(false)
  })
})
