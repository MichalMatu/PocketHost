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
    expect(screen.getByRole("link", { name: "Open hosted site" }).getAttribute("href"))
      .toBe("http://127.0.0.1:19080/")

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

describe("Static create/import form separation", () => {
  it("preserves the starter HTML controls and reset behavior without requesting a write", async () => {
    const user = userEvent.setup()
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input) === "/api/v1/sites")
        return { ok: true, json: async () => ({ sites: [] }) }
      throw new Error("Unexpected create/import request")
    })
    vi.stubGlobal("fetch", fetcher)
    render(<MemoryRouter initialEntries={["/sites"]}><SitesPage /></MemoryRouter>)
    const button = await screen.findByRole("button", { name: "Create site" })
    expect((button as HTMLButtonElement).disabled).toBe(true)
    await user.type(screen.getByLabelText("Site name"), "Starter fixture")
    await user.click(screen.getByRole("checkbox", { name: "Publish starter HTML on creation" }))
    expect(screen.getByRole("button", { name: "Create with starter HTML" })).toBeTruthy()
    const editor = screen.getByLabelText("Initial HTML") as HTMLTextAreaElement
    const sample = editor.value
    await user.clear(editor)
    await user.type(editor, "<h1>changed</h1>")
    await user.click(screen.getByRole("button", { name: "Reset sample HTML" }))
    expect(editor.value).toBe(sample)
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(fetcher.mock.calls.every(([url]) => String(url) === "/api/v1/sites")).toBe(true)
  })
})

describe("active HTML read cancel and retry", () => {
  const active = { ...base, activeRelease: FIRST, fileCount: 1, bytes: 18, releases: 1 }

  it("lets the owner cancel a pending read and ignores its stale successful reply", async () => {
    const user = userEvent.setup()
    let resolveOld!: (value: { ok: boolean; json: () => Promise<{ release: string; html: string }> }) => void
    const old = new Promise<{
      ok: boolean; json: () => Promise<{ release: string; html: string }>
    }>(resolve => { resolveOld = resolve })
    let htmlReads = 0
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url === "/api/v1/sites")
        return { ok: true, json: async () => ({ sites: [active] }) }
      if (url === "/api/v1/sites/" + ID + "/html") {
        htmlReads++
        if (htmlReads === 1) return old
        return { ok: true, json: async () => ({ release: FIRST, html: "<h1>new</h1>" }) }
      }
      throw new Error("Unexpected endpoint " + url)
    })
    vi.stubGlobal("fetch", fetcher)
    render(<MemoryRouter initialEntries={["/sites"]}><SitesPage /></MemoryRouter>)
    await user.click(await screen.findByRole("button", { name: "Edit current HTML" }))
    const cancel = screen.getByRole("button", { name: "Cancel HTML read" }) as HTMLButtonElement
    expect(cancel.disabled).toBe(false)
    await user.click(cancel)
    expect(screen.getByRole("button", { name: "Edit current HTML" })).toBeTruthy()
    await user.click(screen.getByRole("button", { name: "Edit current HTML" }))
    expect((await screen.findByLabelText("index.html source") as HTMLTextAreaElement).value)
      .toBe("<h1>new</h1>")
    await act(async () => {
      resolveOld({ ok: true, json: async () => ({ release: FIRST, html: "<h1>stale</h1>" }) })
      await old
    })
    expect((screen.getByLabelText("index.html source") as HTMLTextAreaElement).value)
      .toBe("<h1>new</h1>")
    expect(htmlReads).toBe(2)
  })

  it("reopens the HTML source on the first click after a failed GET", async () => {
    const user = userEvent.setup()
    let htmlReads = 0
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url === "/api/v1/sites")
        return { ok: true, json: async () => ({ sites: [active] }) }
      if (url === "/api/v1/sites/" + ID + "/html") {
        htmlReads++
        if (htmlReads === 1) return { ok: false }
        return { ok: true, json: async () => ({ release: FIRST, html: "<h1>retry</h1>" }) }
      }
      throw new Error("Unexpected endpoint " + url)
    })
    vi.stubGlobal("fetch", fetcher)
    render(<MemoryRouter initialEntries={["/sites"]}><SitesPage /></MemoryRouter>)
    await user.click(await screen.findByRole("button", { name: "Edit current HTML" }))
    await screen.findByText("Could not load the published HTML for editing.")
    expect(screen.getByRole("button", { name: "Edit current HTML" })).toBeTruthy()
    await user.click(screen.getByRole("button", { name: "Edit current HTML" }))
    expect((await screen.findByLabelText("index.html source") as HTMLTextAreaElement).value)
      .toBe("<h1>retry</h1>")
    expect(htmlReads).toBe(2)
  })
})
