import * as React from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { act, render, screen, waitFor } from "@testing-library/react"
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

function withSites(initial: ReturnType<typeof project>[] = [], route = "/sites/" + ID) {
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
  it.each(["fileCount", "bytes"] as const)(
    "blocks new mutations when the write receipt disagrees on %s with exact-site readback",
    async field => {
      const user = userEvent.setup()
      const expected = project("running", true)
      const acknowledged = { ...expected, [field]: expected[field] + 1 }
      const requests = vi.fn(async (input: RequestInfo | URL, options?: RequestInit) => {
        const url = String(input)
        if (url === "/api/v1/sites" && !options?.method)
          return { ok: true, json: async () => ({ sites: [project("stopped", true)] }) }
        if (url === "/api/v1/sites/" + ID + "/start" && options?.method === "POST")
          return { ok: true, json: async () => ({ site: acknowledged }) }
        if (url === "/api/v1/sites/" + ID && !options?.method)
          return { ok: true, json: async () => ({ site: expected }) }
        throw new Error("Unexpected endpoint " + url)
      })
      vi.stubGlobal("fetch", requests)
      renderSites()
      await screen.findByText("My own site")
      await user.click(screen.getByRole("button", { name: /^Start$/ }))
      await screen.findByText(/Site action result unconfirmed/)
      expect(screen.getByText(/Write actions are paused for this site/)).toBeTruthy()
      expect((screen.getByRole("button", { name: /^Start$/ }) as HTMLButtonElement).disabled).toBe(true)
      expect((screen.getByLabelText("Upload static ZIP") as HTMLInputElement).disabled).toBe(true)
      expect(screen.queryByText("Start completed.")).toBeNull()
      expect(requests.mock.calls.filter(([, options]) => options?.method === "POST")).toHaveLength(1)
      expect(requests.mock.calls.filter(([url]) => String(url) === "/api/v1/sites")).toHaveLength(1)
    },
  )

  it.each([
    { label: "PID", drift: { pid: 2345 } },
    { label: "start ticks", drift: { startTicks: "99999" } },
    { label: "host port", drift: { port: 19081 } },
  ])("blocks a site write when its acknowledged $label differs from exact readback", async ({
    drift,
  }) => {
    const user = userEvent.setup()
    const exact = project("running", true)
    const acknowledged = { ...exact, ...drift }
    const requests = vi.fn(async (input: RequestInfo | URL, options?: RequestInit) => {
      const url = String(input)
      if (url === "/api/v1/sites" && !options?.method)
        return { ok: true, json: async () => ({ sites: [project("stopped", true)] }) }
      if (url === "/api/v1/sites/" + ID + "/start" && options?.method === "POST")
        return { ok: true, json: async () => ({ site: acknowledged }) }
      if (url === "/api/v1/sites/" + ID && !options?.method)
        return { ok: true, json: async () => ({ site: exact }) }
      throw new Error("Unexpected endpoint " + url)
    })
    vi.stubGlobal("fetch", requests)
    renderSites()
    await screen.findByText("My own site")
    await user.click(screen.getByRole("button", { name: /^Start$/ }))
    await screen.findByText(/Site action result unconfirmed/)
    expect(screen.getByText(/Write actions are paused for this site/)).toBeTruthy()
    expect((screen.getByRole("button", { name: /^Start$/ }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByLabelText("Upload static ZIP") as HTMLInputElement).disabled).toBe(true)
    expect(screen.queryByText("Start completed.")).toBeNull()
    expect(requests.mock.calls.filter(([, options]) => options?.method === "POST")).toHaveLength(1)
    expect(requests.mock.calls.filter(([url]) => String(url) === "/api/v1/sites")).toHaveLength(1)
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
      void _options
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
    await user.click(screen.getByRole("button", { name: "Refresh", exact: true }))
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
      void _options
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
    await user.click(screen.getByRole("button", { name: "Refresh", exact: true }))
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
