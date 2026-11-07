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
