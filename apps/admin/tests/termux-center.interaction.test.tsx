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
      url.includes("mode=services") ? { services: [
        { name: "cloudflared", registered: false, protected: true, state: "running", enabled: null },
        { name: "pockethost-panel", registered: false, protected: false, state: "running", enabled: true },
        { name: "pockethost-panel-watch", registered: false, protected: false, state: "running", enabled: true },
        { name: "cupsd", registered: false, protected: false, state: "stopped", enabled: false },
      ] } :
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
    for (const path of ["/packages", "/files", "/services", "/local-agent", "/backups", "/terminal", "/agents"]) {
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
    await user.click(screen.getByRole("button", { name: "Refresh" }))
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

  it("renders one general-purpose File Manager without a hardcoded workspace shortcut", async () => {
    const user = userEvent.setup()
    const calls = mount("files")
    await screen.findByRole("heading", { name: "Files" })
    expect(screen.getAllByRole("heading", { name: "Files" })).toHaveLength(1)
    const location = screen.getByRole("combobox", { name: "Location" })
    expect(screen.getByRole("option", { name: "Termux Home" })).toBeTruthy()
    expect(screen.getByRole("option", { name: "Termux System" })).toBeTruthy()
    expect(screen.getByRole("option", { name: "Phone Storage" })).toBeTruthy()
    expect(screen.queryByRole("button", { name: "Workspace" })).toBeNull()
    expect(screen.queryByRole("navigation", { name: "Quick locations" })).toBeNull()
    await user.selectOptions(location, "prefix")
    await waitFor(() => expect(calls.mock.calls.some(call =>
      String(call[0]).includes("mode=browse-root&root=prefix"))).toBe(true))
    expect(screen.queryByRole("button", { name: "Inspect files" })).toBeNull()
    expect(calls.mock.calls.some(call => String(call[0]) === "/api/v1/sites")).toBe(false)
    expect(calls.mock.calls.every(call => (call[1]?.method ?? "GET") === "GET")).toBe(true)
  })

  it("keeps system backups distinct from immutable Hosting release history", async () => {
    const calls = mount("backups")
    await screen.findByText("Backup readiness")
    expect(screen.getByRole("link", { name: /website versions/i }).getAttribute("href")).toBe("/sites")
    expect(screen.queryByText("View release history")).toBeNull()
    expect(calls.mock.calls.some(call => String(call[0]) === "/api/v1/sites")).toBe(false)
  })

  it("keeps only the runit inventory, without loading individual service diagnostics", async () => {
    const calls = mount("services")
    expect(await screen.findByText("Runit services")).toBeTruthy()
    expect(screen.getByText(/Select a service in the Services menu/)).toBeTruthy()
    expect(screen.queryByText("IleStoi / wreckscanner")).toBeNull()
    expect(screen.queryByText("Cloudflare Tunnel / cloudflared")).toBeNull()
    expect(screen.queryByText("SSH / sshd")).toBeNull()
    expect(screen.queryByText("Mosquitto / MQTT")).toBeNull()
    expect(screen.queryByText("IleStoi / healthwatch")).toBeNull()
    expect(screen.queryByText("Local Agent & PocketHost")).toBeNull()
    const user = userEvent.setup()
    const inventory = await screen.findByText(/Protected runit inventory \(3\)/)
    const details = inventory.closest("details")
    expect(details?.hasAttribute("open")).toBe(false)
    await user.click(inventory)
    expect(details?.hasAttribute("open")).toBe(true)
    expect(screen.getByText("pockethost-panel")).toBeTruthy()
    expect(screen.getAllByText("Panel · read-only")).toHaveLength(2)
    const registerButtons = screen.getAllByRole("button", { name: "Register" })
    expect(registerButtons).toHaveLength(1)
    expect(registerButtons[0].getAttribute("title")).toMatch(/does not start/)
    expect(calls.mock.calls.some(call => String(call[0]) === "/api/v1/observability")).toBe(false)
    expect(calls.mock.calls.some(call => String(call[0]).includes("diagnostics"))).toBe(false)
    expect(calls.mock.calls.some(call => String(call[0]) === "/api/v1/sites")).toBe(false)
  })
})
