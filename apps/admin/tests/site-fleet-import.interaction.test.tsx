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


function renderSites(route = "/sites/new") {
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

function withSites(initial: ReturnType<typeof project>[] = [], route = "/sites/new") {
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

describe("H2 browser site-manager lifecycle", () => {
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
      new File(["<h1>Rejected by host</h1>"], "index.html"))
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
    expect(screen.queryByRole("button", { name: "Create site" })).toBeNull()
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
    await screen.findByText("1 of 8 sites registered.")
    await user.type(screen.getByLabelText("Site name"), "My own site")
    await user.upload(screen.getByLabelText("Initial ZIP (optional)"), makeStaticZip())
    await user.click(screen.getByRole("button", { name: "Create and import ZIP" }))
    await screen.findByText(/Create and ZIP import result unconfirmed/)
    expect(screen.queryByText("1 of 8 sites registered.")).toBeNull()
    expect(screen.queryByRole("button", { name: /^Start$/ })).toBeNull()
    expect(requests.mock.calls.filter(([, opts]) => opts?.method === "POST")).toHaveLength(1)
  })

  it("sends exactly one Start POST when two clicks arrive before React rerenders", async () => {
    let completeStart!: (response: unknown) => void
    const firstPost = new Promise<unknown>(resolve => { completeStart = resolve })
    const calls = vi.fn(async (input: RequestInfo | URL, options?: RequestInit) => {
      const url = String(input)
      if (url === "/api/v1/sites" && !options?.method)
        return { ok: true, json: async () => ({ sites: [project("stopped", true)] }) }
      if (url === "/api/v1/sites/" + ID + "/start" && options?.method === "POST")
        return firstPost
      throw new Error("Unexpected endpoint " + url)
    })
    vi.stubGlobal("fetch", calls)
    renderSites("/sites/" + ID)
    await screen.findByText("My own site")
    const start = screen.getByRole("button", { name: /^Start$/ })
    act(() => {
      fireEvent.click(start)
      fireEvent.click(start)
    })
    expect(calls.mock.calls.filter(([, options]) => options?.method === "POST")).toHaveLength(1)
    await act(async () => {
      completeStart({ ok: false, status: 503 })
      await firstPost
    })
    expect(await screen.findByText(/Write actions are paused for this site/)).toBeTruthy()
    expect(calls.mock.calls.filter(([, options]) => options?.method === "POST")).toHaveLength(1)
    expect((screen.getByRole("button", { name: /^Start$/ }) as HTMLButtonElement).disabled).toBe(true)
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
    renderSites("/sites/" + ID)
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
    renderSites("/sites/" + ID)
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

})
