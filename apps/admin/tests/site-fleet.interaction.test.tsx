import * as React from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"

vi.mock("@/components/layouts/base-layout", () => ({
  BaseLayout: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}))

import SitesPage from "@/app/sites/page"

const ID = "site-" + "a".repeat(32)
const RELEASE = "r-" + "b".repeat(32)

function makeStaticZip(name = "index.html"): File {
  const encoder = new TextEncoder()
  const filename = encoder.encode(name)
  const payload = encoder.encode("<!doctype html><title>ZIP fixture</title>")
  let checksum = 0xffffffff
  for (const byte of payload) {
    checksum ^= byte
    for (let bit = 0; bit < 8; bit++)
      checksum = (checksum >>> 1) ^ ((checksum & 1) ? 0xedb88320 : 0)
  }
  checksum = (checksum ^ 0xffffffff) >>> 0
  const centralOffset = 30 + filename.length + payload.length
  const centralLength = 46 + filename.length
  const bytes = new Uint8Array(centralOffset + centralLength + 22)
  const view = new DataView(bytes.buffer)
  const write16 = (offset: number, value: number) => view.setUint16(offset, value, true)
  const write32 = (offset: number, value: number) => view.setUint32(offset, value, true)
  write32(0, 0x04034b50)
  write16(4, 20)
  write16(6, 0x0800)
  write32(14, checksum)
  write32(18, payload.length)
  write32(22, payload.length)
  write16(26, filename.length)
  bytes.set(filename, 30)
  bytes.set(payload, 30 + filename.length)
  write32(centralOffset, 0x02014b50)
  write16(centralOffset + 4, 20)
  write16(centralOffset + 6, 20)
  write16(centralOffset + 8, 0x0800)
  write32(centralOffset + 16, checksum)
  write32(centralOffset + 20, payload.length)
  write32(centralOffset + 24, payload.length)
  write16(centralOffset + 28, filename.length)
  write32(centralOffset + 42, 0)
  bytes.set(filename, centralOffset + 46)
  const end = centralOffset + centralLength
  write32(end, 0x06054b50)
  write16(end + 8, 1)
  write16(end + 10, 1)
  write32(end + 12, centralLength)
  write32(end + 16, centralOffset)
  return new File([bytes], "first.zip", { type: "application/zip" })
}


function renderSites(route = "/sites") {
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

function withSites(initial: ReturnType<typeof project>[] = [], route = "/sites") {
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
  renderSites(route)
  return fetchMock
}

afterEach(() => vi.unstubAllGlobals())

describe("Static Hosting catalog states", () => {
  it.each([
    [404, "Static hosting is disabled on this panel."],
    [403, "Static hosting access denied."],
    [503, "Could not load static sites. Try Refresh."],
  ])("keeps API failure %i distinct from no sites", async (status, message) => {
    const calls = vi.fn(async () => ({ ok: false, status }))
    vi.stubGlobal("fetch", calls)
    renderSites()
    expect((await screen.findByRole("alert")).textContent).toBe(message)
    expect(screen.queryByText(/No static sites yet/)).toBeNull()
    expect((screen.getByRole("button", { name: "Create site" }) as HTMLButtonElement).disabled).toBe(true)
    expect(calls.mock.calls).toHaveLength(1)
  })

  it("drops stale site cards and action controls when the owned catalog fails", async () => {
    const user = userEvent.setup()
    let failed = false
    const requests = vi.fn(async (input: RequestInfo | URL, options?: RequestInit) => {
      if (String(input) === "/api/v1/sites" && !options?.method)
        return failed
          ? { ok: false, status: 503 }
          : { ok: true, json: async () => ({ sites: [project("stopped", true)] }) }
      throw new Error("Unexpected endpoint " + String(input))
    })
    vi.stubGlobal("fetch", requests)
    renderSites()
    await screen.findByText("My own site")
    failed = true
    await user.click(screen.getByRole("button", { name: "Refresh" }))
    await screen.findByText("Could not load static sites. Try Refresh.")
    expect(screen.queryByText("My own site")).toBeNull()
    expect(screen.queryByRole("button", { name: /^Start$/ })).toBeNull()
    expect((screen.getByRole("button", { name: "Create site" }) as HTMLButtonElement).disabled).toBe(true)
    expect(requests.mock.calls.every(([, options]) => !options?.method)).toBe(true)
  })

  it("refuses an invalid inventory instead of claiming it is empty", async () => {
    const calls = vi.fn(async () => ({
      ok: true, status: 200, json: async () => ({ sites: [{ id: "not-owned" }] }),
    }))
    vi.stubGlobal("fetch", calls)
    renderSites()
    await screen.findByText("Invalid static site inventory. No changes were made.")
    expect(screen.queryByText(/No static sites yet/)).toBeNull()
    expect((screen.getByRole("button", { name: "Create site" }) as HTMLButtonElement).disabled).toBe(true)
  })
})

describe("H2 browser site-manager lifecycle", () => {
  it("selects an owned site from a direct link and returns to the full inventory", async () => {
    const user = userEvent.setup()
    withSites([
      project("stopped", true),
      { ...project("stopped", true), id: "site-" + "c".repeat(32), name: "Other owned site" },
    ], "/sites?site=" + ID)
    await screen.findByText("Selected static site: My own site")
    expect(screen.queryByText("Other owned site")).toBeNull()
    await user.click(screen.getByRole("button", { name: "Show all sites" }))
    expect(await screen.findByText("Other owned site")).toBeTruthy()
  })

  it("creates one explicitly owned site with deliberate intent but cannot start before publishing", async () => {
    const user = userEvent.setup()
    const fetchMock = withSites()
    await screen.findByText(/No static sites yet/)
    await user.type(screen.getByLabelText("Site name"), "My own site")
    await user.click(screen.getByRole("button", { name: /Create site/ }))
    await screen.findByText("My own site")
    expect(screen.getByText(ID)).toBeTruthy()
    expect((screen.getByRole("button", { name: /Start/ }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole("button", { name: /Rollback/ }) as HTMLButtonElement).disabled).toBe(true)
    expect(fetchMock.mock.calls.some(call => call[1]?.method === "POST")).toBe(true)
    expect(fetchMock.mock.calls.some(call => call[1]?.method === "PUT")).toBe(false)
  })

  it("shows pending create readback and blocks duplicate submission", async () => {
    const user = userEvent.setup()
    const createdSite = project()
    let releasePost: (() => void) | null = null
    let posted = false
    const requests = vi.fn(async (input: RequestInfo | URL, options?: RequestInit) => {
      const url = String(input)
      if (url === "/api/v1/sites" && !options?.method)
        return { ok: true, json: async () => ({ sites: posted ? [createdSite] : [] }) }
      if (url === "/api/v1/sites/" && options?.method === "POST") {
        await new Promise<void>((resolve) => { releasePost = resolve })
        posted = true
        return { ok: true, json: async () => ({ site: createdSite }) }
      }
      throw new Error("Unexpected endpoint " + url)
    })
    vi.stubGlobal("fetch", requests)
    renderSites()
    await screen.findByText(/No static sites yet/)
    await user.type(screen.getByLabelText("Site name"), "My own site")
    await user.click(screen.getByRole("button", { name: "Create site" }))
    expect(screen.getByRole("status").textContent).toContain("Creating site and verifying readback")
    const submit = screen.getByRole("button", { name: "Create site" }) as HTMLButtonElement
    expect(submit.disabled).toBe(true)
    expect(submit.closest("form")?.getAttribute("aria-busy")).toBe("true")
    await user.click(submit)
    expect(requests.mock.calls.filter(([, options]) => options?.method === "POST")).toHaveLength(1)
    if (!releasePost) throw new Error("Create request did not reach the pending readback")
    releasePost()
    await screen.findByText(/Site "My own site" created\. Edit HTML/)
    expect(screen.queryByText("Creating site and verifying readback…")).toBeNull()
  })

  it.each(["post-unconfirmed", "readback-unconfirmed"] as const)(
    "removes stale site actions after %s during creation", async (scenario) => {
      const user = userEvent.setup()
      let submitted = false
      const created = { ...project(), id: "site-" + "d".repeat(32), name: "Another site" }
      const requests = vi.fn(async (input: RequestInfo | URL, options?: RequestInit) => {
        const url = String(input)
        if (url === "/api/v1/sites" && !options?.method)
          return submitted && scenario === "readback-unconfirmed"
            ? { ok: false, status: 503 }
            : { ok: true, json: async () => ({ sites: [project("stopped", true)] }) }
        if (url === "/api/v1/sites/" && options?.method === "POST") {
          submitted = true
          return scenario === "post-unconfirmed"
            ? { ok: false, status: 503 }
            : { ok: true, json: async () => ({ site: created }) }
        }
        throw new Error("Unexpected site operation " + url)
      })
      vi.stubGlobal("fetch", requests)
      renderSites()
      await screen.findByText("My own site")
      await user.type(screen.getByLabelText("Site name"), "Another site")
      await user.click(screen.getByRole("button", { name: "Create site" }))
      await screen.findByText(scenario === "post-unconfirmed"
        ? /Create result unconfirmed/ : /Creation was acknowledged/)
      expect(screen.queryByText("My own site")).toBeNull()
      expect(screen.queryByRole("button", { name: /^Start$/ })).toBeNull()
      expect((screen.getByRole("button", { name: "Create site" }) as HTMLButtonElement).disabled).toBe(true)
      expect(requests.mock.calls.filter(([, options]) => options?.method === "POST")).toHaveLength(1)
    },
  )



  it("keeps existing owned sites visible after a definite create-name 400 and accepts correction", async () => {
    const user = userEvent.setup()
    const existing = project("stopped", true)
    const accepted = { ...project("stopped", false), id: "site-" + "e".repeat(32), name: "Corrected site" }
    let sites = [existing]
    const requests = vi.fn(async (input: RequestInfo | URL, options?: RequestInit) => {
      const url = String(input)
      if (url === "/api/v1/sites" && !options?.method)
        return { ok: true, json: async () => ({ sites }) }
      if (url === "/api/v1/sites/" && options?.method === "POST") {
        const submitted = JSON.parse(String(options.body)).name
        if (submitted === "Rejected site") return { ok: false, status: 400 }
        expect(submitted).toBe("Corrected site")
        sites = [existing, accepted]
        return { ok: true, json: async () => ({ site: accepted }) }
      }
      throw new Error("Unexpected site request " + url)
    })
    vi.stubGlobal("fetch", requests)
    renderSites()
    await screen.findByText("My own site")
    await user.type(screen.getByLabelText("Site name"), "Rejected site")
    await user.click(screen.getByRole("button", { name: "Create site" }))
    await screen.findByText(/The site name was rejected/)
    expect(screen.getByText("My own site")).toBeTruthy()
    expect(screen.queryByText(/Create result unconfirmed/)).toBeNull()
    await user.clear(screen.getByLabelText("Site name"))
    await user.type(screen.getByLabelText("Site name"), "Corrected site")
    await user.click(screen.getByRole("button", { name: "Create site" }))
    await screen.findByText(/created. Edit HTML to publish the first release/)
    expect(screen.getByText("My own site")).toBeTruthy()
    expect(screen.getByText(accepted.id)).toBeTruthy()
    expect(requests.mock.calls.filter(([, options]) => options?.method === "POST")).toHaveLength(2)
  })

  it("cannot clear failed owned inventory by changing the optional ZIP or site name", async () => {
    const user = userEvent.setup()
    const requests = vi.fn(async () => ({ ok: false, status: 503 }))
    vi.stubGlobal("fetch", requests)
    renderSites()
    await screen.findByText("Could not load static sites. Try Refresh.")
    await user.type(screen.getByLabelText("Site name"), "Test site")
    await user.upload(screen.getByLabelText("Initial ZIP (optional)"),
      new File(["fixture"], "site.zip", { type: "application/zip" }))
    expect((screen.getByRole("button", { name: "Create and import ZIP" }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText("Could not load static sites. Try Refresh.")).toBeTruthy()
    expect(requests.mock.calls.every(([, options]) => !options?.method)).toBe(true)
  })




  it("publishes edited starter HTML as the first immutable release without extra writes", async () => {
    const user = userEvent.setup()
    let sites: ReturnType<typeof project>[] = []
    const published = {
      ...project("stopped", true),
      fileCount: 1,
      bytes: 48,
      releases: 1,
      history: [{ at: "2026-11-22T00:00:00.000Z", action: "publish", from: null, to: RELEASE }],
    }
    const custom = "<!doctype html><html><body><h1>My own page</h1></body></html>"
    const calls = vi.fn(async (input: RequestInfo | URL, options?: RequestInit) => {
      const url = String(input)
      if (url === "/api/v1/sites" && !options?.method)
        return { ok: true, json: async () => ({ sites }) }
      if (url === "/api/v1/sites/import?name=My%20own%20site" && options?.method === "POST") {
        const payload = JSON.parse(String(options.body))
        expect(payload.files).toHaveLength(1)
        expect(payload.files[0].name).toBe("index.html")
        expect(atob(payload.files[0].base64)).toBe(custom)
        sites = [published]
        return { ok: true, json: async () => ({ site: published }) }
      }
      if (url === "/api/v1/sites/" + ID && !options?.method)
        return { ok: true, json: async () => ({ site: sites[0] }) }
      throw new Error("Unexpected site request " + url)
    })
    vi.stubGlobal("fetch", calls)
    renderSites()
    await screen.findByText(/No static sites yet/)
    await user.type(screen.getByLabelText("Site name"), "My own site")
    await user.click(screen.getByRole("checkbox", { name: /Publish starter HTML on creation/ }))
    await user.clear(screen.getByLabelText("Initial HTML"))
    await user.type(screen.getByLabelText("Initial HTML"), custom)
    await user.click(screen.getByRole("button", { name: "Create with starter HTML" }))
    await screen.findByText(/created and starter HTML published as its first immutable release/)
    expect(calls.mock.calls.filter(([, options]) => options?.method).map(([, options]) => options?.method))
      .toEqual(["POST"])
    await user.click(screen.getByRole("checkbox", { name: /Publish starter HTML on creation/ }))
    expect((screen.getByLabelText("Initial HTML") as HTMLTextAreaElement).value)
      .toContain("<h1>My first PocketHost site</h1>")
  })

  it("prevents creating a site from empty starter HTML before any request", async () => {
    const user = userEvent.setup()
    const calls = withSites()
    await screen.findByText(/No static sites yet/)
    await user.type(screen.getByLabelText("Site name"), "My own site")
    await user.click(screen.getByRole("checkbox", { name: /Publish starter HTML on creation/ }))
    await user.clear(screen.getByLabelText("Initial HTML"))
    await user.click(screen.getByRole("button", { name: "Create with starter HTML" }))
    await screen.findByText("Initial index.html cannot be empty.")
    expect(calls.mock.calls.every(([, options]) => !options?.method)).toBe(true)
  })

  it("prevents oversized multibyte initial HTML without posting an import", async () => {
    const user = userEvent.setup()
    const calls = withSites()
    await screen.findByText(/No static sites yet/)
    await user.type(screen.getByLabelText("Site name"), "My own site")
    await user.click(screen.getByRole("checkbox", { name: /Publish starter HTML on creation/ }))
    fireEvent.change(screen.getByLabelText("Initial HTML"), { target: { value: "🦊".repeat(9000) } })
    await user.click(screen.getByRole("button", { name: "Create with starter HTML" }))
    await screen.findByText(/Initial HTML is larger than 32 KiB/)
    expect(calls.mock.calls.every(([, options]) => !options?.method)).toBe(true)
  })

  it("creates a stopped website with first starter HTML release in one POST", async () => {
    const user = userEvent.setup()
    let sites: ReturnType<typeof project>[] = []
    const published = {
      ...project("stopped", true),
      fileCount: 1,
      bytes: 432,
      releases: 1,
      history: [{ at: "2026-11-22T00:00:00.000Z", action: "publish", from: null, to: RELEASE }],
    }
    const calls = vi.fn(async (input: RequestInfo | URL, options?: RequestInit) => {
      const url = String(input)
      if (url === "/api/v1/sites" && !options?.method)
        return { ok: true, json: async () => ({ sites }) }
      if (url === "/api/v1/sites/import?name=My%20own%20site" && options?.method === "POST") {
        expect((options.headers as Record<string, string>)["X-PocketHost-Intent"]).toBe("owned-sites")
        expect((options.headers as Record<string, string>)["Content-Type"]).toBe("application/json")
        const payload = JSON.parse(String(options.body))
        expect(payload.files).toHaveLength(1)
        expect(payload.files[0].name).toBe("index.html")
        expect(atob(payload.files[0].base64)).toContain("<h1>My first PocketHost site</h1>")
        sites = [published]
        return { ok: true, json: async () => ({ site: published }) }
      }
      if (url === "/api/v1/sites/" + ID && !options?.method)
        return { ok: true, json: async () => ({ site: sites[0] }) }
      throw new Error("Unexpected site request " + url)
    })
    vi.stubGlobal("fetch", calls)
    renderSites()
    await screen.findByText(/No static sites yet/)
    await user.type(screen.getByLabelText("Site name"), "My own site")
    await user.click(screen.getByRole("checkbox", { name: /Publish starter HTML on creation/ }))
    await user.click(screen.getByRole("button", { name: "Create with starter HTML" }))
    await screen.findByText(/created and starter HTML published as its first immutable release/)
    expect(calls.mock.calls.filter(([, options]) => options?.method).map(([, options]) => options?.method))
      .toEqual(["POST"])
    expect(calls.mock.calls.some(([url, options]) =>
      String(url) === "/api/v1/sites/" + ID && !options?.method)).toBe(true)
    expect(screen.getByRole("button", { name: /^Start$/ })).toBeTruthy()
    expect((screen.getByRole("checkbox", { name: /Publish starter HTML on creation/ }) as HTMLInputElement).checked)
      .toBe(false)
  })

  it("disables starter HTML when a ZIP or folder is selected", async () => {
    const user = userEvent.setup()
    const calls = withSites()
    await screen.findByText(/No static sites yet/)
    await user.type(screen.getByLabelText("Site name"), "My own site")
    const starter = screen.getByRole("checkbox", { name: /Publish starter HTML on creation/ }) as HTMLInputElement
    await user.click(starter)
    expect(starter.checked).toBe(true)
    await user.upload(screen.getByLabelText("Initial ZIP (optional)"), makeStaticZip())
    expect(starter.checked).toBe(false)
    expect(starter.disabled).toBe(true)
    expect(screen.getByRole("button", { name: "Create and import ZIP" })).toBeTruthy()
    await user.upload(screen.getByLabelText("Initial folder (optional)"),
      new File(["<h1>Folder</h1>"], "index.html"))
    expect(starter.disabled).toBe(true)
    expect(starter.checked).toBe(false)
    expect(screen.getByRole("button", { name: "Create and import folder" })).toBeTruthy()
    expect(calls.mock.calls.every(([, options]) => !options?.method)).toBe(true)
  })

  it("creates and publishes an initial folder in one POST with exact-site readback", async () => {
    const user = userEvent.setup()
    let current: ReturnType<typeof project>[] = []
    const published = {
      ...project("stopped", true),
      fileCount: 1,
      bytes: 15,
      releases: 1,
      history: [{ at: "2026-11-22T00:00:00.000Z", action: "publish", from: null, to: RELEASE }],
    }
    const requests = vi.fn(async (input: RequestInfo | URL, options?: RequestInit) => {
      const url = String(input)
      if (url === "/api/v1/sites" && !options?.method)
        return { ok: true, json: async () => ({ sites: current }) }
      if (url === "/api/v1/sites/import?name=My%20own%20site" && options?.method === "POST") {
        expect((options.headers as Record<string, string>)["X-PocketHost-Intent"]).toBe("owned-sites")
        expect((options.headers as Record<string, string>)["Content-Type"]).toBe("application/json")
        const payload = JSON.parse(String(options.body))
        expect(payload.files).toHaveLength(1)
        expect(payload.files[0].name).toBe("index.html")
        expect(atob(payload.files[0].base64)).toBe("<h1>Folder</h1>")
        current = [published]
        return { ok: true, json: async () => ({ site: published }) }
      }
      if (url === "/api/v1/sites/" + ID && !options?.method)
        return { ok: true, json: async () => ({ site: current[0] }) }
      throw new Error("Unexpected endpoint " + url)
    })
    vi.stubGlobal("fetch", requests)
    renderSites()
    await screen.findByText(/No static sites yet/)
    await user.type(screen.getByLabelText("Site name"), "My own site")
    await user.upload(screen.getByLabelText("Initial folder (optional)"),
      new File(["<h1>Folder</h1>"], "index.html", { type: "text/html" }))
    await user.click(screen.getByRole("button", { name: "Create and import folder" }))
    await screen.findByText(/created and folder published as its first immutable release/)
    expect(requests.mock.calls.filter(([, options]) => options?.method).map(([, options]) => options?.method))
      .toEqual(["POST"])
    expect(requests.mock.calls.some(([url, options]) =>
      String(url) === "/api/v1/sites/" + ID && !options?.method)).toBe(true)
    expect(screen.getByRole("button", { name: /^Start$/ })).toBeTruthy()
  })

  it("rejects an oversized initial folder before sending a create request", async () => {
    const user = userEvent.setup()
    const requests = withSites()
    await screen.findByText(/No static sites yet/)
    await user.type(screen.getByLabelText("Site name"), "My own site")
    await user.upload(screen.getByLabelText("Initial folder (optional)"),
      new File([new Uint8Array(2 * 1024 * 1024 + 1)], "index.html"))
    await user.click(screen.getByRole("button", { name: "Create and import folder" }))
    await screen.findByText(/Folder exceeds 100 files/)
    expect(requests.mock.calls.every(([, options]) => !options?.method)).toBe(true)
  })

  it("definitively rejects an initial folder 400 without hiding verified inventory", async () => {
    const user = userEvent.setup()
    const requests = vi.fn(async (input: RequestInfo | URL, options?: RequestInit) => {
      const url = String(input)
      if (url === "/api/v1/sites" && !options?.method)
        return { ok: true, json: async () => ({ sites: [] }) }
      if (url === "/api/v1/sites/import?name=My%20own%20site" && options?.method === "POST")
        return { ok: false, status: 400 }
      throw new Error("Unexpected endpoint " + url)
    })
    vi.stubGlobal("fetch", requests)
    renderSites()
    await screen.findByText(/No static sites yet/)
    await user.type(screen.getByLabelText("Site name"), "My own site")
    await user.upload(screen.getByLabelText("Initial folder (optional)"),
      new File(["Invalid starter"], "readme.txt"))
    await user.click(screen.getByRole("button", { name: "Create and import folder" }))
    await screen.findByText(/The site files were rejected/)
    expect(screen.getByText(/No static sites yet/)).toBeTruthy()
    expect(requests.mock.calls.filter(([, options]) => options?.method === "POST")).toHaveLength(1)
  })

  it("clears a pending ZIP or folder without POST and restores source choices", async () => {
    const user = userEvent.setup()
    const requests = withSites()
    await screen.findByText(/No static sites yet/)
    await user.type(screen.getByLabelText("Site name"), "My own site")
    const zip = screen.getByLabelText("Initial ZIP (optional)") as HTMLInputElement
    const folder = screen.getByLabelText("Initial folder (optional)") as HTMLInputElement
    const starter = screen.getByRole("checkbox", {
      name: /Publish starter HTML on creation/,
    }) as HTMLInputElement
    await user.upload(zip, makeStaticZip())
    expect(zip.files?.length).toBe(1)
    expect(starter.disabled).toBe(true)
    expect(screen.getByText(/Selected ZIP: first.zip/)).toBeTruthy()
    await user.click(screen.getByRole("button", { name: "Clear selected import" }))
    expect(zip.files?.length).toBe(0)
    expect(folder.files?.length).toBe(0)
    expect(starter.disabled).toBe(false)
    expect(screen.getByRole("button", { name: "Create site" })).toBeTruthy()
    await user.upload(folder, new File(["<h1>Hello</h1>"], "index.html"))
    expect(screen.getByText("Selected folder: 1 file")).toBeTruthy()
    await user.click(screen.getByRole("button", { name: "Clear selected import" }))
    expect(folder.files?.length).toBe(0)
    expect(starter.disabled).toBe(false)
    expect(screen.queryByRole("button", { name: "Clear selected import" })).toBeNull()
    expect(requests.mock.calls.every(([, options]) => !options?.method)).toBe(true)
  })

  it("uses the most recently selected import source, never both ZIP and folder", async () => {
    const user = userEvent.setup()
    const requests = withSites()
    await screen.findByText(/No static sites yet/)
    await user.type(screen.getByLabelText("Site name"), "My own site")
    await user.upload(screen.getByLabelText("Initial ZIP (optional)"), makeStaticZip())
    expect(screen.getByRole("button", { name: "Create and import ZIP" })).toBeTruthy()
    await user.upload(screen.getByLabelText("Initial folder (optional)"),
      new File(["<h1>First</h1>"], "index.html"))
    expect(screen.getByRole("button", { name: "Create and import folder" })).toBeTruthy()
    await user.upload(screen.getByLabelText("Initial ZIP (optional)"), makeStaticZip())
    expect(screen.getByRole("button", { name: "Create and import ZIP" })).toBeTruthy()
    expect(requests.mock.calls.every(([, options]) => !options?.method)).toBe(true)
  })

  it("imports first ZIP with one POST and confirms new site identity and release", async () => {
    const user = userEvent.setup()
    let current: ReturnType<typeof project>[] = []
    const imported = {
      ...project("stopped", true),
      fileCount: 1,
      bytes: 23,
      releases: 1,
      history: [{ at: "2026-11-22T00:00:00.000Z", action: "publish", from: null, to: RELEASE }],
    }
    const calls = vi.fn(async (input: RequestInfo | URL, options?: RequestInit) => {
      const url = String(input)
      if (url === "/api/v1/sites" && !options?.method)
        return { ok: true, json: async () => ({ sites: current }) }
      if (url === "/api/v1/sites/import?name=My%20own%20site" && options?.method === "POST") {
        expect((options.headers as Record<string, string>)["X-PocketHost-Intent"]).toBe("owned-sites")
        expect((options.headers as Record<string, string>)["Content-Type"]).toBe("application/zip")
        expect((options.body as File).name).toBe("first.zip")
        current = [imported]
        return { ok: true, json: async () => ({ site: imported }) }
      }
      if (url === "/api/v1/sites/" + ID && !options?.method)
        return { ok: true, json: async () => ({ site: current[0] }) }
      throw new Error("Unexpected endpoint " + url)
    })
    vi.stubGlobal("fetch", calls)
    renderSites()
    await screen.findByText(/No static sites yet/)
    await user.type(screen.getByLabelText("Site name"), "My own site")
    await user.upload(screen.getByLabelText("Initial ZIP (optional)"),
      makeStaticZip())
    await user.click(screen.getByRole("button", { name: "Create and import ZIP" }))
    await screen.findByText(/created and ZIP published as its first immutable release/)
    const operations = calls.mock.calls
      .filter(([, options]) => options?.method)
      .map(([, options]) => options?.method)
    expect(operations).toEqual(["POST"])
    expect(calls.mock.calls.some(([url, options]) =>
      String(url) === "/api/v1/sites/" + ID && !options?.method)).toBe(true)
    expect(screen.getByText("My own site")).toBeTruthy()
    expect(screen.getByRole("button", { name: "Create site" })).toBeTruthy()
    expect(screen.getByRole("button", { name: /^Start$/ })).toBeTruthy()
  })

  it("rejects empty first-release ZIP before site creation", async () => {
    const user = userEvent.setup()
    const requests = withSites()
    await screen.findByText(/No static sites yet/)
    await user.type(screen.getByLabelText("Site name"), "My own site")
    await user.upload(screen.getByLabelText("Initial ZIP (optional)"),
      new File([], "empty.zip", { type: "application/zip" }))
    await user.click(screen.getByRole("button", { name: "Create and import ZIP" }))
    await screen.findByText("The selected ZIP is empty.")
    expect(requests.mock.calls.every(([, options]) => !options?.method)).toBe(true)
  })



  it("refuses initial ZIP without index.html before creating a site", async () => {
    const user = userEvent.setup()
    const calls = withSites()
    await screen.findByText(/No static sites yet/)
    await user.type(screen.getByLabelText("Site name"), "My own site")
    await user.upload(screen.getByLabelText("Initial ZIP (optional)"),
      makeStaticZip("readme.txt"))
    await user.click(screen.getByRole("button", { name: "Create and import ZIP" }))
    await screen.findByText(/ZIP needs a nonempty index.html/)
    expect(calls.mock.calls.every(([, options]) => !options?.method)).toBe(true)
    expect(screen.queryByText(ID)).toBeNull()
  })

  it("permits one containing folder when ZIP index.html is inside it", async () => {
    const user = userEvent.setup()
    let sites: ReturnType<typeof project>[] = []
    const released = {
      ...project("stopped", true),
      fileCount: 1,
      bytes: 23,
      releases: 1,
      history: [{ at: "2026-11-22T00:00:00.000Z", action: "publish", from: null, to: RELEASE }],
    }
    const calls = vi.fn(async (input: RequestInfo | URL, options?: RequestInit) => {
      const url = String(input)
      if (url === "/api/v1/sites" && !options?.method)
        return { ok: true, json: async () => ({ sites }) }
      if (url === "/api/v1/sites/import?name=My%20own%20site" && options?.method === "POST") {
        sites = [released]
        return { ok: true, json: async () => ({ site: released }) }
      }
      if (url === "/api/v1/sites/" + ID && !options?.method)
        return { ok: true, json: async () => ({ site: sites[0] }) }
      throw new Error("Unexpected endpoint " + url)
    })
    vi.stubGlobal("fetch", calls)
    renderSites()
    await screen.findByText(/No static sites yet/)
    await user.type(screen.getByLabelText("Site name"), "My own site")
    await user.upload(screen.getByLabelText("Initial ZIP (optional)"),
      makeStaticZip("dist/index.html"))
    await user.click(screen.getByRole("button", { name: "Create and import ZIP" }))
    await screen.findByText(/created and ZIP published as its first immutable release/)
    expect(calls.mock.calls.filter(([, options]) => options?.method).map(([, options]) => options?.method))
      .toEqual(["POST"])
    expect(screen.queryByText(/ZIP needs a nonempty index.html/)).toBeNull()
  })

  it("rejects a renamed non-ZIP before creating an empty site", async () => {
    const user = userEvent.setup()
    const calls = withSites()
    await screen.findByText(/No static sites yet/)
    await user.type(screen.getByLabelText("Site name"), "My own site")
    await user.upload(screen.getByLabelText("Initial ZIP (optional)"),
      new File(["This is plain text"], "renamed.zip", { type: "application/zip" }))
    await user.click(screen.getByRole("button", { name: "Create and import ZIP" }))
    await screen.findByText(/ZIP structure is invalid/)
    expect(calls.mock.calls.every(([, options]) => !options?.method)).toBe(true)
    expect(screen.queryByText(ID)).toBeNull()
  })

  it("does not create a site when initial ZIP is definitively rejected", async () => {
    const user = userEvent.setup()
    const requests = vi.fn(async (input: RequestInfo | URL, options?: RequestInit) => {
      const url = String(input)
      if (url === "/api/v1/sites" && !options?.method)
        return { ok: true, json: async () => ({ sites: [] }) }
      if (url === "/api/v1/sites/import?name=My%20own%20site" && options?.method === "POST")
        return { ok: false, status: 400 }
      throw new Error("Unexpected endpoint " + url)
    })
    vi.stubGlobal("fetch", requests)
    renderSites()
    await screen.findByText(/No static sites yet/)
    await user.type(screen.getByLabelText("Site name"), "My own site")
    await user.upload(screen.getByLabelText("Initial ZIP (optional)"), makeStaticZip())
    await user.click(screen.getByRole("button", { name: "Create and import ZIP" }))
    await screen.findByText(/The site files were rejected/)
    expect(screen.queryByText(ID)).toBeNull()
    expect(screen.getByText(/No static sites yet/)).toBeTruthy()
    expect(requests.mock.calls.filter(([, opts]) => opts?.method === "POST")).toHaveLength(1)
    expect(requests.mock.calls.filter(([, opts]) => opts?.method === "PUT")).toHaveLength(0)
  })

  it("hides stale site actions after an unconfirmed one-step initial ZIP import", async () => {
    const user = userEvent.setup()
    const requests = vi.fn(async (input: RequestInfo | URL, options?: RequestInit) => {
      const url = String(input)
      if (url === "/api/v1/sites" && !options?.method)
        return { ok: true, json: async () => ({ sites: [project("stopped", true)] }) }
      if (url === "/api/v1/sites/import?name=My%20own%20site" && options?.method === "POST")
        return { ok: false, status: 503 }
      throw new Error("Unexpected endpoint " + url)
    })
    vi.stubGlobal("fetch", requests)
    renderSites()
    await screen.findByText("My own site")
    await user.type(screen.getByLabelText("Site name"), "My own site")
    await user.upload(screen.getByLabelText("Initial ZIP (optional)"), makeStaticZip())
    await user.click(screen.getByRole("button", { name: "Create and import ZIP" }))
    await screen.findByText(/Create and ZIP import result unconfirmed/)
    expect(screen.queryByText("My own site")).toBeNull()
    expect(screen.queryByRole("button", { name: /^Start$/ })).toBeNull()
    expect(requests.mock.calls.filter(([, opts]) => opts?.method === "POST")).toHaveLength(1)
  })

  it("starts only the selected PocketHost-owned site through Hosting with explicit intent", async () => {
    const user = userEvent.setup()
    let current = project("stopped", true)
    const calls = vi.fn(async (input: RequestInfo | URL, options?: RequestInit) => {
      const url = String(input)
      if (url === "/api/v1/sites" && !options?.method)
        return { ok: true, json: async () => ({ sites: [current] }) }
      if (url === "/api/v1/sites/" + ID && !options?.method)
        return { ok: true, json: async () => ({ site: current }) }
      if (url === "/api/v1/sites/" + ID + "/start" && options?.method === "POST") {
        expect((options.headers as Record<string, string>)["X-PocketHost-Intent"]).toBe("owned-sites")
        current = project("running", true)
        return { ok: true, json: async () => ({ site: current }) }
      }
      return { ok: false, status: 404, json: async () => ({ error: "not-found" }) }
    })
    vi.stubGlobal("fetch", calls)
    renderSites()
    await screen.findByText("My own site")
    await user.click(screen.getByRole("button", { name: /^Start$/ }))
    await screen.findByText("Start completed.")
    expect(calls.mock.calls.filter(call => call[1]?.method === "POST")).toHaveLength(1)
    expect(screen.getByRole("button", { name: /Stop/ })).toBeTruthy()
  })


  it("locks writes after uncertain mutation, keeps logs available, unlocks on explicit refresh", async () => {
    const user = userEvent.setup()
    let inventories = 0
    const calls = vi.fn(async (input: RequestInfo | URL, options?: RequestInit) => {
      const url = String(input)
      if (url === "/api/v1/sites" && !options?.method) {
        inventories += 1
        return { ok: true, json: async () => ({ sites: [project("running", true)] }) }
      }
      if (url === "/api/v1/sites/" + ID + "/stop" && options?.method === "POST")
        return { ok: false, status: 503 }
      if (url === "/api/v1/sites/" + ID + "/logs" && !options?.method)
        return { ok: true, json: async () => ({ logs: ["read-only audit trail"] }) }
      throw new Error("Unexpected endpoint " + url)
    })
    vi.stubGlobal("fetch", calls)
    vi.stubGlobal("confirm", vi.fn(() => true))
    renderSites()
    await screen.findByText("My own site")
    await user.click(screen.getByRole("button", { name: /^Stop$/ }))
    await screen.findByText(/Write actions are paused for this site/)
    expect((screen.getByRole("button", { name: /^Stop$/ }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole("button", { name: /^Restart$/ }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByLabelText("Upload static ZIP") as HTMLInputElement).disabled).toBe(true)
    await user.click(screen.getByRole("button", { name: /Read logs/ }))
    await screen.findByText("read-only audit trail")
    expect((screen.getByRole("button", { name: /^Stop$/ }) as HTMLButtonElement).disabled).toBe(true)
    expect(inventories).toBe(1)
    await user.click(screen.getByRole("button", { name: "Refresh" }))
    await waitFor(() => expect(
      (screen.getByRole("button", { name: /^Stop$/ }) as HTMLButtonElement).disabled,
    ).toBe(false))
    expect(screen.queryByText(/Write actions are paused for this site/)).toBeNull()
    expect(calls.mock.calls.filter(([, options]) => options?.method === "POST")).toHaveLength(1)
  })

  it("pauses site writes when acknowledged mutation lacks exact-site readback", async () => {
    const user = userEvent.setup()
    const calls = vi.fn(async (input: RequestInfo | URL, options?: RequestInit) => {
      const url = String(input)
      if (url === "/api/v1/sites" && !options?.method)
        return { ok: true, json: async () => ({ sites: [project("stopped", true)] }) }
      if (url === "/api/v1/sites/" + ID + "/start" && options?.method === "POST")
        return { ok: true, json: async () => ({ site: project("running", true) }) }
      if (url === "/api/v1/sites/" + ID && !options?.method)
        return { ok: false, status: 503 }
      throw new Error("Unexpected endpoint " + url)
    })
    vi.stubGlobal("fetch", calls)
    renderSites()
    await screen.findByText("My own site")
    await user.click(screen.getByRole("button", { name: /^Start$/ }))
    await screen.findByText(/Write actions are paused for this site/)
    expect((screen.getByRole("button", { name: /^Start$/ }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByLabelText("Upload static ZIP") as HTMLInputElement).disabled).toBe(true)
    expect(calls.mock.calls.filter(([, options]) => options?.method === "POST")).toHaveLength(1)
  })


  it("does not lock writes when an oversized folder is rejected locally before upload", async () => {
    const user = userEvent.setup()
    const calls = withSites([project("stopped", true)])
    await screen.findByText("My own site")
    const tooLarge = new File([new Uint8Array(2 * 1024 * 1024 + 1)], "oversized.html", {
      type: "text/html",
    })
    await user.upload(screen.getByLabelText("Upload folder"), tooLarge)
    await screen.findByText(/Folder exceeds 100 files, 2 MiB per file or 8 MiB total/)
    expect(screen.queryByText(/Write actions are paused for this site/)).toBeNull()
    expect((screen.getByLabelText("Upload static ZIP") as HTMLInputElement).disabled).toBe(false)
    expect(calls.mock.calls.every(([, options]) => !options?.method)).toBe(true)
  })

  it("keeps the ZIP picker available after definite invalid-input rejection", async () => {
    const user = userEvent.setup()
    const calls = vi.fn(async (input: RequestInfo | URL, options?: RequestInit) => {
      const url = String(input)
      if (url === "/api/v1/sites" && !options?.method)
        return { ok: true, json: async () => ({ sites: [project("stopped", false)] }) }
      if (url === "/api/v1/sites/" + ID + "/deploy" && options?.method === "PUT")
        return { ok: false, status: 400 }
      throw new Error("Unexpected endpoint " + url)
    })
    vi.stubGlobal("fetch", calls)
    renderSites()
    await screen.findByText("My own site")
    await user.upload(screen.getByLabelText("Upload static ZIP"),
      new File(["bad ZIP"], "bad.zip", { type: "application/zip" }))
    await screen.findByText(/The site files were rejected/)
    expect((screen.getByLabelText("Upload static ZIP") as HTMLInputElement).disabled).toBe(false)
    expect(screen.queryByText(/Write actions are paused for this site/)).toBeNull()
    expect(calls.mock.calls.filter(([, options]) => options?.method === "PUT")).toHaveLength(1)
  })


  it("keeps writes unavailable when exact-site readback succeeded but owned inventory reload failed", async () => {
    const user = userEvent.setup()
    let mutated = false
    const calls = vi.fn(async (input: RequestInfo | URL, options?: RequestInit) => {
      const url = String(input)
      if (url === "/api/v1/sites" && !options?.method)
        return mutated
          ? { ok: false, status: 503 }
          : { ok: true, json: async () => ({ sites: [project("stopped", true)] }) }
      if (url === "/api/v1/sites/" + ID + "/start" && options?.method === "POST") {
        mutated = true
        return { ok: true, json: async () => ({ site: project("running", true) }) }
      }
      if (url === "/api/v1/sites/" + ID && !options?.method)
        return { ok: true, json: async () => ({ site: project("running", true) }) }
      throw new Error("Unexpected endpoint " + url)
    })
    vi.stubGlobal("fetch", calls)
    renderSites()
    await screen.findByText("My own site")
    await user.click(screen.getByRole("button", { name: /^Start$/ }))
    await screen.findByText("Could not load static sites. Try Refresh.")
    expect(screen.queryByRole("button", { name: /^Start$/ })).toBeNull()
    expect(screen.queryByRole("button", { name: /^Stop$/ })).toBeNull()
    expect(calls.mock.calls.filter(([, options]) => options?.method === "POST")).toHaveLength(1)
  })

  it("keeps successful site start distinct from a failed post-action refresh", async () => {
    const user = userEvent.setup()
    let reloaded = false
    const calls = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url === "/api/v1/sites" && !init?.method) {
        if (reloaded) return { ok: false, status: 503 }
        return { ok: true, json: async () => ({ sites: [project("stopped", true)] }) }
      }
      if (url === "/api/v1/sites/" + ID && !init?.method)
        return { ok: true, json: async () => ({ site: project("running", true) }) }
      if (url === "/api/v1/sites/" + ID + "/start" && init?.method === "POST") {
        reloaded = true
        return { ok: true, json: async () => ({ site: project("running", true) }) }
      }
      return { ok: false, status: 404 }
    })
    vi.stubGlobal("fetch", calls)
    renderSites()
    await screen.findByText("My own site")
    await user.click(screen.getByRole("button", { name: /^Start$/ }))
    await screen.findByText("Could not load static sites. Try Refresh.")
    expect(screen.queryByText("My own site")).toBeNull()
    expect(calls.mock.calls.filter(call => call[1]?.method === "POST")).toHaveLength(1)
  })


  it("publishes selected ZIP bytes and confirms the new immutable release by readback", async () => {
    const user = userEvent.setup()
    const previous = project("stopped", false)
    const published = {
      ...project("stopped", true),
      activeRelease: RELEASE,
      fileCount: 1,
      bytes: 19,
      history: [{ at: "2026-11-22T00:00:00.000Z", action: "publish", from: null, to: RELEASE }],
    }
    let current = previous
    const requests = vi.fn(async (input: RequestInfo | URL, options?: RequestInit) => {
      const url = String(input)
      if (url === "/api/v1/sites" && !options?.method)
        return { ok: true, json: async () => ({ sites: [current] }) }
      if (url === "/api/v1/sites/" + ID && !options?.method)
        return { ok: true, json: async () => ({ site: current }) }
      if (url === "/api/v1/sites/" + ID + "/deploy" && options?.method === "PUT") {
        expect((options.headers as Record<string, string>)["X-PocketHost-Intent"]).toBe("owned-sites")
        expect((options.headers as Record<string, string>)["Content-Type"]).toBe("application/zip")
        const body = options.body as File
        expect(body.name).toBe("site.zip")
        expect(await body.text()).toBe("ZIP-FIXTURE-CONTENTS")
        current = published
        return { ok: true, json: async () => ({ site: published }) }
      }
      throw new Error("Unexpected static site request " + url)
    })
    vi.stubGlobal("fetch", requests)
    renderSites()
    await screen.findByText("My own site")
    const zip = new File(["ZIP-FIXTURE-CONTENTS"], "site.zip", { type: "application/zip" })
    await user.upload(screen.getByLabelText("Upload static ZIP"), zip)
    await screen.findByText("ZIP was published as a new immutable release.")
    expect(requests.mock.calls.filter(([, options]) => options?.method === "PUT")).toHaveLength(1)
    expect(requests.mock.calls.some(([url, options]) =>
      String(url) === "/api/v1/sites/" + ID && !options?.method)).toBe(true)
    expect(screen.getByText(/1 files/)).toBeTruthy()
  })

  it("refuses empty ZIP files before sending a mutation", async () => {
    const user = userEvent.setup()
    const requests = withSites([project("stopped", false)])
    await screen.findByText("My own site")
    await user.upload(screen.getByLabelText("Upload static ZIP"),
      new File([], "empty.zip", { type: "application/zip" }))
    await screen.findByText("The selected ZIP is empty.")
    expect(requests.mock.calls.every(([, options]) => options?.method !== "PUT")).toBe(true)
  })

  it("shows a definite ZIP format rejection distinctly from uncertain deployment", async () => {
    const user = userEvent.setup()
    const requests = vi.fn(async (input: RequestInfo | URL, options?: RequestInit) => {
      const url = String(input)
      if (url === "/api/v1/sites" && !options?.method)
        return { ok: true, json: async () => ({ sites: [project("stopped", false)] }) }
      if (url === "/api/v1/sites/" + ID + "/deploy" && options?.method === "PUT")
        return { ok: false, status: 400 }
      throw new Error("Unexpected request " + url)
    })
    vi.stubGlobal("fetch", requests)
    renderSites()
    await screen.findByText("My own site")
    await user.upload(screen.getByLabelText("Upload static ZIP"),
      new File(["bad archive"], "bad.zip", { type: "application/zip" }))
    await screen.findByText(/The site files were rejected/)
    expect(screen.queryByText(/Result unconfirmed/)).toBeNull()
    expect(requests.mock.calls.filter(([, options]) => options?.method === "PUT")).toHaveLength(1)
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

  it("ignores a late HTTP status after the owned inventory has refreshed", async () => {
    const user = userEvent.setup()
    let resolveHealth!: (result: unknown) => void
    const oldHealth = new Promise(resolve => { resolveHealth = resolve })
    const calls = vi.fn(async (input: RequestInfo | URL, _options?: RequestInit) => {
      const url = String(input)
      if (url === "/api/v1/sites")
        return { ok: true, json: async () => ({ sites: [project("running", true)] }) }
      if (url.endsWith("/health")) return oldHealth
      return { ok: false, status: 404 }
    })
    vi.stubGlobal("fetch", calls)
    renderSites()
    await screen.findByText("My own site")
    await user.click(screen.getByRole("button", { name: /Verify HTTP/ }))
    await user.click(screen.getByRole("button", { name: /Refresh/ }))
    await waitFor(() => expect(calls.mock.calls.filter(([url]) =>
      String(url) === "/api/v1/sites")).toHaveLength(2))
    await act(async () => {
      resolveHealth({ ok: true, json: async () => ({ healthy: true }) })
      await oldHealth
    })
    await waitFor(() => expect((screen.getByRole("button", { name: /Verify HTTP/ }) as HTMLButtonElement).disabled).toBe(false))
    expect(screen.queryByText("HTTP: healthy")).toBeNull()
    expect(screen.queryByText("HTTP check completed.")).toBeNull()
    expect(calls.mock.calls.every(([, options]) => !options?.method)).toBe(true)
  })

  it("discards old runtime log lines and a late read failure after a site refresh", async () => {
    const user = userEvent.setup()
    let rejectLogs!: (error: Error) => void
    const oldLogs = new Promise((_resolve, reject) => { rejectLogs = reject })
    const calls = vi.fn(async (input: RequestInfo | URL, _options?: RequestInit) => {
      const url = String(input)
      if (url === "/api/v1/sites")
        return { ok: true, json: async () => ({ sites: [project("running", true)] }) }
      if (url.endsWith("/logs")) return oldLogs
      return { ok: false, status: 404 }
    })
    vi.stubGlobal("fetch", calls)
    renderSites()
    await screen.findByText("My own site")
    await user.click(screen.getByRole("button", { name: /Read logs/ }))
    await user.click(screen.getByRole("button", { name: /Refresh/ }))
    await waitFor(() => expect(calls.mock.calls.filter(([url]) =>
      String(url) === "/api/v1/sites")).toHaveLength(2))
    await act(async () => {
      rejectLogs(new Error("stale log request failed"))
      await oldLogs.catch(() => {})
    })
    await waitFor(() => expect((screen.getByRole("button", { name: /Read logs/ }) as HTMLButtonElement).disabled).toBe(false))
    expect(screen.queryByText("stale log request failed")).toBeNull()
    expect(screen.queryByText("Owned logs refreshed.")).toBeNull()
    expect(screen.queryByRole("heading", { name: "Owned runtime logs" })).toBeNull()
    expect(calls.mock.calls.every(([, options]) => !options?.method)).toBe(true)
  })

  it("renders real owned PID and asynchronous HTTP verification result", async () => {
    const user = userEvent.setup()
    withSites([project("running", true)])
    await screen.findByText("PID 1234")
    expect(screen.getByText("Start ticks: 55555")).toBeTruthy()
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
