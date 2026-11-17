import * as React from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"

vi.mock("@/components/layouts/base-layout", () => ({
  BaseLayout: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}))

import SitesPage from "@/app/sites/page"

const ID = "site-" + "a".repeat(32)
const FIRST = "r-" + "b".repeat(32)
const SECOND = "r-" + "c".repeat(32)
const base = {
  id: ID,
  name: "One HTML page",
  kind: "static-site",
  state: "stopped",
  port: 19080,
  activeRelease: null as string | null,
  previousRelease: null as string | null,
  canRollback: false,
  pid: null as number | null,
  startTicks: null as string | null,
  fileCount: 0,
  bytes: 0,
  releases: 0,
  memoryBytes: null,
  uptimeSeconds: null as number | null,
  healthy: null,
  history: [] as { at: string; action: "publish" | "rollback"; from: string | null; to: string }[],
}

afterEach(() => vi.unstubAllGlobals())

describe("one-file static site MVP", () => {
  it("creates, publishes, starts, reads existing HTML, publishes update, rolls back and reloads", async () => {
    const user = userEvent.setup()
    const site = { ...base }
    const content = new Map<string, string>()
    let created = false
    let published = 0
    const mock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      const method = init?.method ?? "GET"
      const reply = () => ({ ok: true, status: 200, json: async () => ({ site: { ...site } }) })
      if (url === "/api/v1/sites" && method === "GET")
        return { ok: true, status: 200, json: async () => ({ sites: created ? [{ ...site }] : [] }) }
      if (url === "/api/v1/sites/" && method === "POST") {
        created = true
        return reply()
      }
      if (url === "/api/v1/sites/" + ID && method === "GET") return reply()
      if (url === "/api/v1/sites/" + ID + "/html" && method === "GET") {
        return {
          ok: true, status: 200,
          json: async () => ({ release: site.activeRelease, html: content.get(site.activeRelease!) }),
        }
      }
      if (url === "/api/v1/sites/" + ID + "/deploy" && method === "PUT") {
        expect((init?.headers as Record<string, string>)["X-PocketHost-Intent"]).toBe("owned-sites")
        const file = JSON.parse(String(init?.body)).files[0]
        expect(file.name).toBe("index.html")
        const html = atob(file.base64)
        const release = published++ === 0 ? FIRST : SECOND
        content.set(release, html)
        const previous = site.activeRelease
        site.activeRelease = release
        site.previousRelease = previous
        site.canRollback = previous !== null
        site.fileCount = 1
        site.bytes = html.length
        site.releases = published
        site.history = [...site.history, { at: new Date().toISOString(), action: "publish", from: previous, to: release }]
        return reply()
      }
      if (url === "/api/v1/sites/" + ID + "/start" && method === "POST") {
        site.state = "running"
        site.pid = 1234
        site.startTicks = "55555"
        site.uptimeSeconds = 1
        return reply()
      }
      if (url === "/api/v1/sites/" + ID + "/rollback" && method === "POST") {
        const before = site.activeRelease
        site.activeRelease = site.previousRelease
        site.previousRelease = null
        site.canRollback = false
        site.history = [...site.history, { at: new Date().toISOString(), action: "rollback", from: before, to: site.activeRelease! }]
        return reply()
      }
      return { ok: false, status: 404, json: async () => ({ error: "not found" }) }
    })
    vi.stubGlobal("fetch", mock)
    vi.stubGlobal("confirm", vi.fn(() => true))
    render(<MemoryRouter initialEntries={["/sites"]}><SitesPage /></MemoryRouter>)

    await screen.findByText(/No static sites yet/)
    await user.type(screen.getByLabelText("Site name"), "One HTML page")
    await user.click(screen.getByRole("button", { name: "Create site" }))
    await screen.findByText(/created\. Edit HTML/)
    await user.click(screen.getByRole("button", { name: "Edit starter HTML" }))
    await user.clear(screen.getByLabelText("index.html source"))
    await user.type(screen.getByLabelText("index.html source"), "<h1>v1</h1>")
    await user.click(screen.getByRole("button", { name: "Publish HTML" }))
    await screen.findByText(/HTML was published/)
    await user.click(screen.getByRole("button", { name: /^Start$/ }))
    await screen.findByText("Start completed.")
    expect(screen.getByRole("link", { name: "Open hosted site" }).getAttribute("href")).toBe("http://127.0.0.1:19080/")

    await user.click(await screen.findByRole("button", { name: "Edit current HTML" }))
    expect((await screen.findByLabelText("index.html source") as HTMLTextAreaElement).value).toBe("<h1>v1</h1>")
    await user.clear(screen.getByLabelText("index.html source"))
    await user.type(screen.getByLabelText("index.html source"), "<h1>v2</h1>")
    await user.click(screen.getByRole("button", { name: "Publish HTML" }))
    await screen.findByText(/HTML was published/)
    await user.click(screen.getByRole("button", { name: "Rollback" }))
    await screen.findByText("Rollback completed.")

    await user.click(await screen.findByRole("button", { name: "Edit current HTML" }))
    expect((await screen.findByLabelText("index.html source") as HTMLTextAreaElement).value).toBe("<h1>v1</h1>")
    expect(site.activeRelease).toBe(FIRST)
    expect(mock.mock.calls.filter(call => call[1]?.method === "PUT")).toHaveLength(2)
  })
})
