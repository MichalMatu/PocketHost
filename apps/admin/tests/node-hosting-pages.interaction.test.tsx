import * as React from "react"
import { afterEach, expect, it, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"

vi.mock("@/components/layouts/base-layout", () => ({
  BaseLayout: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}))

import DeploymentsPage from "@/app/deployments/page"
import RuntimeLogsPage from "@/app/runtime-logs/page"

const id = "node-" + "a".repeat(32)
const release = "r-" + "b".repeat(32)
const demo = {
  id: "pockethost-demo",
  name: "PocketHost Demo",
  description: "Private owned demo",
  type: "static-html",
  dataDirectory: "PocketHost-OwnedSites/pockethost-demo",
  state: "stopped",
  port: 18787,
  url: "http://127.0.0.1:18787/",
  contentVersion: 1,
  previousVersion: null,
  pid: null,
  startTicks: null,
  history: [{ at: "2026-11-09T10:00:00Z", action: "create", from: null, to: 1 }],
}
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

function setup(enabled: boolean) {
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
  expect(screen.getByText(/publish · new → r-/)).toBeTruthy()
  expect(screen.getByText(/start · r-/)).toBeTruthy()
  expect(screen.queryByText("PocketHost Demo")).toBeNull()
  expect(requests.mock.calls.some(([input]) => String(input) === "/api/v1/owned-site/project")).toBe(false)
  expect(requests.mock.calls.every((call) => call[1]?.method === undefined)).toBe(true)
})

it("Runtime logs reads only selected owned project, redacts secrets, and can switch to Node", async () => {
  const requests = setup(true)
  render(<MemoryRouter><RuntimeLogsPage /></MemoryRouter>)
  await screen.findByText(/static published/)
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
