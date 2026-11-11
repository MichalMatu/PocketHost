import * as React from "react"
import { MemoryRouter } from "react-router-dom"
import { afterEach, describe, expect, it, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { parseH3Files, parseH3Tools } from "@/lib/termux-center-schema"
import { navGroups } from "@/config/navigation"
import { routes } from "@/config/routes"

vi.mock("@/components/layouts/base-layout", () => ({
  BaseLayout: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}))
import TermuxCenterPage from "@/app/termux/page"

const time = "2026-11-07T13:00:00.000Z"
const siteId = "site-" + "a".repeat(32)
const releaseId = "r-" + "b".repeat(32)
const observation = {
  version: 1, mode: "read-only", observedAt: time,
  host: {
    version: 1, mode: "read-only", platform: "termux", observedAt: time,
    runtime: { nodeVersion: "v26.0.0", architecture: "arm64", systemUptimeSeconds: 1,
      totalMemoryMiB: 4000, freeMemoryMiB: 1200, storage: null },
    services: ["ilestoi","tunnel","ssh","mqtt","healthwatch","local-agent"].map(id => ({
      id, label: id, ownership: "external", state: "running",
    })),
  },
  metrics: {
    cpuPercent: { state: "unavailable", observedAt: time, value: null },
    batteryPercent: { state: "unavailable", observedAt: time, value: null },
    network: { state: "unavailable", observedAt: time, value: null },
  },
  packages: { state: "ok", observedAt: time, truncated: false,
    installed: [{ ecosystem: "termux", name: "curl", version: "8.0" }],
    updates: { state: "unknown", candidates: [] } },
  processes: { state: "ok", observedAt: time, partial: true, truncated: false, processes: [] },
  history: [], diagnostics: { state: "unavailable", events: [] }, alerts: [],
}
const site = {
  id: siteId, name: "H3 fixture site", kind: "static-site", state: "stopped",
  port: 19080, activeRelease: releaseId, previousRelease: null,
  canRollback: false, pid: null, startTicks: null, fileCount: 2, bytes: 80,
  releases: 1, memoryBytes: null, uptimeSeconds: null, healthy: null, history: [],
}
const tools = {
  version: 1, mode: "read-only",
  tools: [
    { id: "restic", purpose: "backup", state: "not-detected" },
    { id: "ttyd", purpose: "terminal", state: "not-detected" },
    { id: "cloudcmd", purpose: "files", state: "not-detected" },
    { id: "termux-api", purpose: "android", state: "unavailable" },
  ],
}
function mount(section: "packages" | "files" | "services" | "backups" | "terminal" | "agents" = "packages") {
  const mock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    expect(init?.method ?? "GET").toBe("GET")
    const url = String(input)
    const output = url.includes("mode=packages") ? { packages: [
        { name: "curl", version: "8.0" },
      ], truncated: false } :
      url === "/api/v1/observability" ? observation :
      url === "/api/v1/sites" ? { sites: [site] } :
      url === "/api/v1/termux-tools" ? tools :
      url.includes("mode=file-roots") ? { roots: [
        { id: "home", available: true }, { id: "prefix", available: true },
        { id: "shared", available: false },
      ] } :
      url.includes("mode=browse-root") ? { path: "", entries: [
        { name: "note.md", kind: "file", bytes: 8 },
      ], truncated: false } :
      url.includes("mode=agent-capabilities") ? {
        version: 1, loginRequired: false, transport: "local-http",
        actions: ["package-preview"], path: "/api/v1/termux-admin", headers: {},
      } :
      url === "/api/v1/sites/" + siteId + "/files" ? { files: [
        { name: "index.html", bytes: 30 }, { name: "css/main.css", bytes: 50 },
      ] } : url === "/api/v1/sites/" + siteId + "/releases" ? { releases: [
        { id: releaseId, createdAt: time, fileCount: 2, bytes: 80, active: true, rollbackTarget: false },
      ] } : null
    return { ok: output !== null, json: async () => output }
  })
  vi.stubGlobal("fetch", mock)
  render(<MemoryRouter><TermuxCenterPage section={section} /></MemoryRouter>)
  return mock
}
afterEach(() => vi.unstubAllGlobals())

describe("H3 strict read-only contracts", () => {
  it("requires bounded fixed tool states, not shell commands", () => {
    expect(parseH3Tools(tools).tools).toHaveLength(4)
    expect(() => parseH3Tools({ ...tools, command: "rm -rf" })).toThrow()
    expect(() => parseH3Files({ files: [{ name: "../token", bytes: 1 }] })).toThrow()
    expect(() => parseH3Files({ files: Array(101).fill({ name: "index.html", bytes: 1 }) })).toThrow()
    expect(parseH3Files({ files: [{ name: "index.html", bytes: 1 }] })).toHaveLength(1)
  })
  it("promotes six real Termux routes and preserves upstream examples", () => {
    const mainItems = navGroups.flatMap(group => group.items)
    for (const path of ["/packages", "/files", "/services", "/backups", "/terminal", "/agents"]) {
      expect(mainItems.some(item => item.url === path)).toBe(true)
      expect(routes.some(route => route.path === path)).toBe(true)
    }
    // /system is an intentional compatibility redirect to Dashboard, not a second menu item.
    expect(routes.some(route => route.path === "/system")).toBe(true)
    expect(mainItems.some(item => item.url === "/system")).toBe(false)
    expect(mainItems.filter(item => item.url === "/dashboard")).toHaveLength(1)
    expect(mainItems.some(item => item.title === "Termux Control Center")).toBe(false)
    for (const path of ["/termux", "/dashboard", "/mail", "/auth/sign-in", "/errors/forbidden"]) {
      expect(routes.some(route => route.path === path)).toBe(true)
    }
  })

  it("loads packages without fetching unrelated module inventories", async () => {
    const calls = mount("packages")
    await screen.findByText("curl")
    expect(screen.getByLabelText("Search packages")).toBeTruthy()
    expect(screen.queryByText("Full Termux file manager")).toBeNull()
    expect(calls.mock.calls.some(call => String(call[0]) === "/api/v1/sites")).toBe(false)
  })

  it("Refresh reloads the full Termux package inventory", async () => {
    const user = userEvent.setup()
    const calls = mount("packages")
    await screen.findByRole("button", { name: "curl" })
    await user.click(screen.getByRole("button", { name: /Refresh/ }))
    await waitFor(() => expect(calls.mock.calls.filter(call =>
      String(call[0]).includes("mode=packages"))).toHaveLength(2))
  })

  it("keeps one compact LAN warning linked to full network safety guidance", async () => {
    mount("packages")
    await screen.findByText("curl")
    const link = screen.getByRole("link", { name: "LAN only · no login" })
    expect(link.getAttribute("href")).toBe("/settings/network")
    expect(screen.queryByText(/This trusted-LAN development panel has no login/)).toBeNull()
  })

  it("renders exactly one File Manager with the workspace shortcut", async () => {
    const user = userEvent.setup()
    const calls = mount("files")
    await screen.findByRole("heading", { name: "Files" })
    expect(screen.queryByText("Termux workspace files")).toBeNull()
    expect(screen.getAllByRole("heading", { name: "Files" })).toHaveLength(1)
    await user.click(screen.getByRole("button", { name: "Workspace" }))
    expect(calls.mock.calls.some(call => String(call[0]).includes("Projects%2FPocketHost-H3-Workspace"))).toBe(true)
    expect(screen.queryByRole("button", { name: "Inspect files" })).toBeNull()
    expect(screen.queryByText(/This File Manager remains for Termux system paths/)).toBeNull()
    expect(calls.mock.calls.some(call => String(call[0]) === "/api/v1/sites")).toBe(false)
    expect(calls.mock.calls.every(call => (call[1]?.method ?? "GET") === "GET")).toBe(true)
  })

  it("keeps system backups distinct from immutable Hosting release history", async () => {
    const calls = mount("backups")
    await screen.findByText("Backup readiness")
    expect(screen.getByRole("link", { name: "Website versions" }).getAttribute("href")).toBe("/sites")
    expect(screen.queryByText("View release history")).toBeNull()
    expect(calls.mock.calls.some(call => String(call[0]) === "/api/v1/sites")).toBe(false)
  })

  it("keeps foreign runit observations separate from Hosting site controls", async () => {
    const calls = mount("services")
    const observed = await screen.findByText(/Observed external services · read-only/)
    expect(observed).toBeTruthy()
    await userEvent.setup().click(observed)
    await screen.findByText("ilestoi")
    expect(screen.queryByText("Manage owned services")).toBeNull()
    expect(screen.queryByText(/PocketHost-owned websites are managed/)).toBeNull()
    expect(calls.mock.calls.some(call => String(call[0]) === "/api/v1/sites")).toBe(false)
  })
})
