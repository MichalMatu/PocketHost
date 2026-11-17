import { afterEach, describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import HostingPage from "@/app/hosting/page"

afterEach(() => vi.unstubAllGlobals())

describe("Hosting selection", () => {
  it("distinguishes enabled static hosting from disabled Node hosting", async () => {
    const requests = vi.fn(async (url: string) => ({
      ok: url === "/api/v1/sites",
      status: url === "/api/v1/sites" ? 200 : 404,
      json: async () => ({ sites: [] }),
    }))
    vi.stubGlobal("fetch", requests)
    render(<MemoryRouter><HostingPage /></MemoryRouter>)
    expect(await screen.findByText("Static hosting: 0 running · 0 total")).toBeTruthy()
    expect(await screen.findByText("Node hosting: Not enabled on this panel")).toBeTruthy()
    expect(screen.getByRole("link", { name: "Manage static websites" }).getAttribute("href"))
      .toBe("/sites")
    expect(screen.getByRole("link", { name: "Manage Node.js projects" }).getAttribute("href"))
      .toBe("/projects")
    expect(screen.getByRole("link", { name: "Deployment history" }).getAttribute("href")).toBe("/deployments")
    expect(screen.getByRole("link", { name: "Project logs" }).getAttribute("href")).toBe("/runtime-logs")
    expect(requests.mock.calls.every(call => call[1]?.method !== "POST")).toBe(true)
  })

  it("does not claim availability when an inventory cannot be trusted", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true, status: 200,
      json: async () => ({ sites: [{ id: "foreign", kind: "static-site" }] }),
    })))
    render(<MemoryRouter><HostingPage /></MemoryRouter>)
    expect(await screen.findByText("Static hosting: Status unavailable — retry Refresh")).toBeTruthy()
  })
  it("shows actual running and stopped static sites and verified Node runtime", async () => {
    const release = "r-" + "b".repeat(32)
    const nodeId = "node-" + "a".repeat(32)
    const site = {
      id: "site-" + "c".repeat(32), name: "My site", kind: "static-site",
      state: "running", port: 19080, activeRelease: release,
      previousRelease: null, canRollback: false,
      pid: 1234, startTicks: "5678", fileCount: 1, bytes: 320, releases: 1,
      memoryBytes: null, uptimeSeconds: null, healthy: true, history: [],
    }
    const requests = vi.fn(async (url: string) => {
      if (url === "/api/v1/sites") return { ok: true, status: 200,
        json: async () => ({ sites: [site, {
          ...site, id: "site-" + "d".repeat(32), name: "Draft",
          state: "stopped", pid: null, startTicks: null, activeRelease: null, healthy: null,
        }] }) }
      if (url === "/api/v1/node-projects") return { ok: true, status: 200,
        json: async () => ({ projects: [{ id: nodeId, name: "My Node", kind: "node" }] }) }
      if (url === "/api/v1/node-projects/" + nodeId + "/runtime") return {
        ok: true, status: 200, json: async () => ({ runtime: {
          state: "running", desired: "running", port: 19090,
          healthDecision: { action: "none", reason: "ready", nextEligibleAtMs: null },
          activeRelease: release, lastGoodRelease: release, previousGoodRelease: null, history: [],
        } }),
      }
      throw new Error("Unexpected endpoint " + url)
    })
    vi.stubGlobal("fetch", requests)
    render(<MemoryRouter><HostingPage /></MemoryRouter>)
    expect(await screen.findByText("Static hosting: 1 running · 2 total")).toBeTruthy()
    expect(await screen.findByText("Node hosting: 1 running · 1 total")).toBeTruthy()
    expect(screen.getByText("My site")).toBeTruthy()
    expect(screen.getByText("Draft")).toBeTruthy()
    expect(screen.getByText("My Node")).toBeTruthy()
    expect(screen.getByText("HTTP: healthy")).toBeTruthy()
    expect(screen.getByText("Port: 19090")).toBeTruthy()
    expect(requests.mock.calls.every(call => call[1]?.method !== "POST")).toBe(true)
  })

})
