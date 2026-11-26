import * as React from "react"
import { afterEach, expect, it, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import { MemoryRouter, useNavigate } from "react-router-dom"
import { readProjectLogLines } from "@/lib/hosting-observability-client"

vi.mock("@/components/layouts/base-layout", () => ({
  BaseLayout: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}))

import DeploymentsPage from "@/app/deployments/page"
import HostingPage from "@/app/hosting/page"
import RuntimeLogsPage from "@/app/runtime-logs/page"

const id = "node-" + "a".repeat(32)
const release = "r-" + "b".repeat(32)
const staticSite = {
  id: "site-" + "c".repeat(32),
  name: "Example static",
  kind: "static-site",
  state: "stopped",
  port: 19080,
  activeRelease: release,
  previousRelease: null,
  canRollback: false,
  pid: null,
  startTicks: null,
  fileCount: 1,
  bytes: 320,
  releases: 1,
  memoryBytes: null,
  uptimeSeconds: null,
  healthy: null,
  history: [{ at: "2026-11-10T02:00:00Z", action: "publish", from: null, to: release }],
}
afterEach(() => vi.unstubAllGlobals())

function setup(enabled: boolean, healthOverride?: {
  state: "not-provisioned" | "stopped" | "running" | "unknown"
  ready: boolean | null
  release: string | null
}) {
  const requests = vi.fn(async (input: RequestInfo | URL, options?: RequestInit) => {
    const url = String(input)
    expect(options?.method).toBeUndefined()
    if (url === "/api/v1/sites")
      return { ok: true, status: 200, json: async () => ({ sites: [staticSite] }) }
    if (url === "/api/v1/sites/" + staticSite.id + "/logs")
      return { ok: true, status: 200, json: async () => ({
        logs: ["static published", "Authorization: Bearer sensitive"],
      }) }
    if (url === "/api/v1/node-projects")
      return enabled
        ? { ok: true, status: 200, json: async () => ({
            projects: [{ id, name: "Example Node", kind: "node" }],
          }) }
        : { ok: false, status: 404 }
    if (url === "/api/v1/node-projects/" + id + "/runtime")
      return { ok: true, status: 200, json: async () => ({ runtime: {
        state: "running", desired: "running", port: 19090,
        healthDecision: { action: "none", reason: "ready", nextEligibleAtMs: null },
        activeRelease: release, lastGoodRelease: release,
        previousGoodRelease: null,
        history: [{ at: "2026-11-10T01:00:00Z", action: "start", release }],
      } }) }
    if (url === "/api/v1/node-projects/" + id + "/logs")
      return { ok: true, status: 200, json: async () => ({
        logs: { lines: ["node started"] },
      }) }
    if (url === "/api/v1/node-projects/" + id + "/health")
      return { ok: true, status: 200, json: async () => ({
        health: healthOverride ?? { state: "running", ready: true, release },
      }) }
    return { ok: false, status: 404 }
  })
  vi.stubGlobal("fetch", requests)
  return requests
}

it("Deployments shows only owned static and Node project histories", async () => {
  const requests = setup(true)
  render(<MemoryRouter><DeploymentsPage /></MemoryRouter>)
  await screen.findByText("Example static")
  await screen.findByText("Example Node")
  expect(screen.getByRole("heading", { level: 2, name: "Static sites" })).toBeTruthy()
  expect(screen.getByRole("heading", { level: 2, name: "Node.js applications" })).toBeTruthy()
  expect(screen.getByRole("heading", { level: 3, name: "Example static" })).toBeTruthy()
  expect(screen.getByRole("link", { name: "Manage static sites" }).getAttribute("href")).toBe("/sites")
  expect(screen.getByRole("link", { name: "Manage Node projects" }).getAttribute("href")).toBe("/projects")
  expect(screen.getAllByText("Active release")).toHaveLength(2)
  for (const active of screen.getAllByText(/^Active: r-/)) {
    expect(active.closest("details")?.open).toBe(false)
  }
  const links = [screen.getByRole("link", { name: "Open site settings" }), screen.getByRole("link", { name: "Open project" }), ...screen.getAllByRole("link", { name: "Logs", exact: true })]
  expect(links.every(link => link.classList.contains("h-8") && link.hasAttribute("href"))).toBe(true)
  const historyControls = screen.getAllByText("Deployment history (1)")
  expect(historyControls).toHaveLength(2)
  expect(historyControls.every(control => !control.closest("details")?.open)).toBe(true)
  historyControls.forEach(control => fireEvent.click(control))
  expect(screen.getByRole("list", { name: "Deployment history for Example static" }).textContent)
    .toMatch(/publish\s*·\s*new\s*→\s*r-/)
  expect(screen.getByRole("list", { name: "Deployment history for Example Node" }).textContent)
    .toMatch(/start\s*·\s*r-/)
  expect(screen.queryByText("PocketHost Demo")).toBeNull()
  expect(requests.mock.calls.some(([input]) => String(input) === "/api/v1/owned-site/project")).toBe(false)
  expect(requests.mock.calls.every((call) => call[1]?.method === undefined)).toBe(true)
})

it("unknown project deep links never fall back to another project's logs", async () => {
  const requests = setup(true)
  const unknown = "node:node-" + "f".repeat(32)
  render(<MemoryRouter initialEntries={["/runtime-logs?project=" + unknown]}>
    <RuntimeLogsPage />
  </MemoryRouter>)
  await screen.findByText("Requested project is not in the verified owned inventory.")
  expect(screen.queryByLabelText("Project log lines")).toBeNull()
  expect(requests.mock.calls.some(([url]) => String(url).endsWith("/logs"))).toBe(false)
  expect(screen.getByRole("button", { name: "Example Node (Node.js)" })).toBeTruthy()
})

it("navigating to an unknown project hides previously visible owned logs", async () => {
  const requests = setup(true)
  function UnknownLink() {
    const navigate = useNavigate()
    return <button onClick={() => navigate("/runtime-logs?project=static:site-" + "f".repeat(32))}>
      Unknown project link
    </button>
  }
  render(<MemoryRouter initialEntries={["/runtime-logs?project=static:" + staticSite.id]}>
    <UnknownLink />
    <RuntimeLogsPage />
  </MemoryRouter>)
  await screen.findByText(/static published/)
  fireEvent.click(screen.getByRole("button", { name: "Unknown project link" }))
  await screen.findByText("Requested project is not in the verified owned inventory.")
  expect(screen.queryByLabelText("Project log lines")).toBeNull()
  expect(screen.queryByText(/static published/)).toBeNull()
  expect(requests.mock.calls.some(([url]) => String(url) ===
    "/api/v1/node-projects/" + id + "/logs")).toBe(false)
})

it("Runtime logs reads only selected owned project, redacts secrets, and can switch to Node", async () => {
  const requests = setup(true)
  render(<MemoryRouter><RuntimeLogsPage /></MemoryRouter>)
  await screen.findByText(/static published/)
  expect(screen.getByRole("link", { name: "Open Sites manager" }).getAttribute("href"))
    .toBe("/sites/" + staticSite.id)
  expect(screen.getByText(/\[sensitive log line hidden\]/)).toBeTruthy()
  expect(screen.queryByText(/Bearer sensitive/)).toBeNull()
  fireEvent.click(screen.getByRole("button", { name: "Example Node (Node.js)" }))
  await screen.findByText("node started")
  expect(requests.mock.calls.some(([input]) =>
    String(input) === "/api/v1/sites/" + staticSite.id + "/logs")).toBe(true)
  expect(requests.mock.calls.some(([input]) =>
    String(input) === "/api/v1/node-projects/" + id + "/logs")).toBe(true)
  expect(requests.mock.calls.some(([input]) =>
    String(input).startsWith("/api/v1/owned-site"))).toBe(false)
})

it("Project logs follows the URL when navigating back between owned targets", async () => {
  const requests = setup(true)
  function BackControl() {
    const navigate = useNavigate()
    return <button type="button" onClick={() => navigate(-1)}>Browser back</button>
  }
  render(<MemoryRouter initialEntries={["/runtime-logs?project=static:" + staticSite.id]}>
    <BackControl />
    <RuntimeLogsPage />
  </MemoryRouter>)
  await screen.findByText(/static published/)
  fireEvent.click(screen.getByRole("button", { name: "Example Node (Node.js)" }))
  await screen.findByText("node started")
  fireEvent.click(screen.getByRole("button", { name: "Browser back" }))
  await screen.findByText(/static published/)
  expect(requests.mock.calls.filter(([url]) => String(url) ===
    "/api/v1/sites/" + staticSite.id + "/logs")).toHaveLength(2)
})

it("Project logs rejects a mismatched Node selector before any request", async () => {
  const requests = vi.fn()
  vi.stubGlobal("fetch", requests)
  await expect(readProjectLogLines({
    key: "static:" + id, id, name: "Mismatched", kind: "node",
  })).rejects.toThrow("Invalid owned Node project identity")
  expect(requests).not.toHaveBeenCalled()
})

it("Node feature disabled never requests foreign service runtime or logs", async () => {
  const requests = setup(false)
  render(<MemoryRouter><RuntimeLogsPage /></MemoryRouter>)
  await screen.findByText(/Node Hosting is disabled\./)
  expect(requests.mock.calls.some((call) =>
    String(call[0]).startsWith("/api/v1/node-projects/"))).toBe(false)
})


it("disabled log sources show an honest empty state without demo placeholders", async () => {
  const requests = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url === "/api/v1/node-projects" || url === "/api/v1/sites")
      return { ok: false, status: 404 }
    throw new Error("Unexpected endpoint " + url)
  })
  vi.stubGlobal("fetch", requests)
  render(<MemoryRouter><RuntimeLogsPage /></MemoryRouter>)
  await screen.findByText("No owned projects have been created.")
  expect(screen.getByText("Static hosting is disabled.")).toBeTruthy()
  expect(screen.getByText("Node Hosting is disabled.")).toBeTruthy()
  expect(screen.getByRole("link", { name: "Monitoring" }).getAttribute("href")).toBe("/observability")
  expect(screen.queryByText("PocketHost Demo")).toBeNull()
  expect(screen.queryByRole("alert")).toBeNull()
})

it("distinguishes both disabled Hosting modules from empty projects", async () => {
  const requests = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url === "/api/v1/sites" || url === "/api/v1/node-projects")
      return { ok: false, status: 404 }
    throw new Error("Unexpected endpoint " + url)
  })
  vi.stubGlobal("fetch", requests)
  render(<MemoryRouter><DeploymentsPage /></MemoryRouter>)
  await screen.findByText("Static hosting is not enabled on this panel.")
  await screen.findByText("Node Hosting is not enabled on this panel.")
  expect(screen.queryByText("No static sites yet.")).toBeNull()
  expect(screen.queryByText("No Node projects yet.")).toBeNull()
  expect(screen.queryByRole("alert")).toBeNull()
  expect(requests.mock.calls.some(([input]) => String(input).startsWith("/api/v1/owned-site"))).toBe(false)
})

it("shows independent empty states for enabled Hosting modules", async () => {
  const requests = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url === "/api/v1/sites") return { ok: true, status: 200, json: async () => ({ sites: [] }) }
    if (url === "/api/v1/node-projects") return { ok: true, status: 200, json: async () => ({ projects: [] }) }
    throw new Error("Unexpected endpoint " + url)
  })
  vi.stubGlobal("fetch", requests)
  render(<MemoryRouter><DeploymentsPage /></MemoryRouter>)
  await screen.findByText("No static sites yet.")
  await screen.findByText("No Node projects yet.")
  expect(screen.queryByRole("alert")).toBeNull()
  expect(requests.mock.calls.some(([input]) => String(input).startsWith("/api/v1/owned-site"))).toBe(false)
})

it("a failed static inventory does not hide the available Node catalog", async () => {
  const requests = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url === "/api/v1/sites") return { ok: false, status: 403 }
    if (url === "/api/v1/node-projects") return { ok: true, status: 200, json: async () => ({ projects: [] }) }
    throw new Error("Unexpected endpoint " + url)
  })
  vi.stubGlobal("fetch", requests)
  render(<MemoryRouter><DeploymentsPage /></MemoryRouter>)
  await screen.findByText("Static hosting access denied.")
  await screen.findByText("No Node projects yet.")
  expect(screen.queryByText("No static sites yet.")).toBeNull()
  expect(screen.getAllByRole("alert")).toHaveLength(1)
})

it("rejects malformed static inventory instead of treating it as empty", async () => {
  const requests = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url === "/api/v1/sites") return { ok: true, status: 200, json: async () => ({ sites: [{ id: "foreign" }] }) }
    if (url === "/api/v1/node-projects") return { ok: false, status: 404 }
    throw new Error("Unexpected endpoint " + url)
  })
  vi.stubGlobal("fetch", requests)
  render(<MemoryRouter><DeploymentsPage /></MemoryRouter>)
  await screen.findByText("Invalid static site inventory.")
  expect(screen.queryByText("No static sites yet.")).toBeNull()
  expect(screen.queryByText("PocketHost Demo")).toBeNull()
})

it("Hosting overview groups management and operations without duplicate instructional copy", async () => {
  setup(true)
  render(<MemoryRouter><HostingPage /></MemoryRouter>)
  await screen.findByText("Example Node")
  expect(screen.getByRole("heading", { level: 2, name: "Static Hosting" })).toBeTruthy()
  expect(screen.getByRole("heading", { level: 2, name: "Node.js Hosting" })).toBeTruthy()
  expect(screen.getByRole("link", { name: "Manage static websites" }).getAttribute("href")).toBe("/sites")
  expect(screen.getByRole("link", { name: "Manage Node.js projects" }).getAttribute("href")).toBe("/projects")
  expect(screen.getByRole("navigation", { name: "Hosting operations" })).toBeTruthy()
  expect(screen.getByRole("link", { name: "Deployment history" }).getAttribute("href")).toBe("/deployments")
  expect(screen.getByRole("link", { name: "Project logs" }).getAttribute("href")).toBe("/runtime-logs")
  expect(screen.queryByText(/Current inventory from PocketHost-owned/)).toBeNull()
})

it("Hosting overview checks HTTP readiness only after an explicit click", async () => {
  const calls = setup(true)
  render(<MemoryRouter><HostingPage /></MemoryRouter>)
  const button = await screen.findByRole("button", { name: "Check readiness for Example Node" })
  expect(calls.mock.calls.some(([url]) => String(url).endsWith("/health"))).toBe(false)
  expect(screen.getByText("HTTP: not checked")).toBeTruthy()
  fireEvent.click(button)
  await screen.findByText("HTTP: ready")
  expect(calls.mock.calls.filter(([url]) => String(url).endsWith("/health"))).toHaveLength(1)
})

it.each([
  [{ state: "running", ready: false, release: "r-" + "c".repeat(32) }, "unavailable"],
  [{ state: "stopped", ready: false, release }, "unavailable"],
  [{ state: "running", ready: false, release }, "not ready"],
] as const)("Hosting readiness validates inventory identity before reporting %s", async (health, expected) => {
  const calls = setup(true, health)
  render(<MemoryRouter><HostingPage /></MemoryRouter>)
  fireEvent.click(await screen.findByRole("button", { name: "Check readiness for Example Node" }))
  await screen.findByText("HTTP: " + expected)
  expect(calls.mock.calls.filter(([url]) => String(url).endsWith("/health"))).toHaveLength(1)
})
