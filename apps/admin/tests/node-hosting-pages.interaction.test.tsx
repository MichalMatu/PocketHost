import * as React from "react"
import { afterEach, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
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
afterEach(() => vi.unstubAllGlobals())

function setup(enabled: boolean) {
  const requests = vi.fn(async (input: RequestInfo | URL, options?: RequestInit) => {
    const url = String(input)
    expect(options?.method).toBeUndefined()
    if (url === "/api/v1/owned-site/project")
      return { ok: true, status: 200, json: async () => ({ project: demo }) }
    if (url === "/api/v1/owned-site/logs")
      return { ok: true, status: 200, json: async () => ({ logs: ["demo log"] }) }
    if (url === "/api/v1/node-projects")
      return enabled
        ? { ok: true, status: 200, json: async () => ({
            projects: [{ id, name: "Example Node", kind: "node" }],
          }) }
        : { ok: false, status: 404 }
    if (url === "/api/v1/node-projects/" + id + "/runtime")
      return { ok: true, status: 200, json: async () => ({ runtime: {
        state: "running", activeRelease: release, lastGoodRelease: release,
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

it("Deployments combines existing H1 demo with owned Node runtime journal", async () => {
  const requests = setup(true)
  render(<MemoryRouter><DeploymentsPage /></MemoryRouter>)
  await screen.findByText("Example Node")
  expect(screen.getByText("PocketHost Demo")).toBeTruthy()
  expect(screen.getByText(/start · r-/)).toBeTruthy()
  expect(requests.mock.calls.every((call) => call[1]?.method === undefined)).toBe(true)
})

it("Runtime logs reads only selected owned Node service and preserves H1 demo", async () => {
  const requests = setup(true)
  render(<MemoryRouter><RuntimeLogsPage /></MemoryRouter>)
  await screen.findByText("node started")
  expect(screen.getByText("demo log")).toBeTruthy()
  expect(screen.getByRole("button", { name: "Example Node" })).toBeTruthy()
  expect(requests.mock.calls.some((call) => String(call[0]).endsWith("/logs"))).toBe(true)
})

it("Node feature disabled never requests foreign service runtime or logs", async () => {
  const requests = setup(false)
  render(<MemoryRouter><RuntimeLogsPage /></MemoryRouter>)
  await screen.findByText(/Node Hosting is disabled\./)
  expect(requests.mock.calls.some((call) =>
    String(call[0]).startsWith("/api/v1/node-projects/"))).toBe(false)
})


it("missing optional demo logs is a neutral empty state with a monitoring link", async () => {
  const requests = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url === "/api/v1/node-projects" || url === "/api/v1/owned-site/logs")
      return { ok: false, status: 404 }
    throw new Error("Unexpected endpoint " + url)
  })
  vi.stubGlobal("fetch", requests)
  render(<MemoryRouter><RuntimeLogsPage /></MemoryRouter>)
  await screen.findByText("Optional demo logs are not enabled on this panel.")
  expect(screen.getByRole("link", { name: "Monitoring" }).getAttribute("href")).toBe("/observability")
  expect(screen.getByRole("link", { name: "Services" }).getAttribute("href")).toBe("/services")
  expect(screen.queryByText("PocketHost Demo")).toBeNull()
  expect(screen.queryByRole("alert")).toBeNull()
})
