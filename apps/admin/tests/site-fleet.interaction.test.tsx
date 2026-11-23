import * as React from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
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

  it("rejects duplicate site identities before showing ambiguous site controls", async () => {
    const calls = vi.fn(async () => ({
      ok: true, status: 200,
      json: async () => ({ sites: [
        project("stopped", true),
        { ...project("stopped", true), name: "Conflicting site name" },
      ] }),
    }))
    vi.stubGlobal("fetch", calls)
    renderSites()
    await screen.findByText("Invalid static site inventory. No changes were made.")
    expect(screen.queryByText("My own site")).toBeNull()
    expect(screen.queryByText("Conflicting site name")).toBeNull()
    expect(screen.queryByRole("button", { name: /^Start$/ })).toBeNull()
    expect((screen.getByRole("button", { name: "Create site" }) as HTMLButtonElement).disabled).toBe(true)
    expect(calls.mock.calls).toHaveLength(1)
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

})
