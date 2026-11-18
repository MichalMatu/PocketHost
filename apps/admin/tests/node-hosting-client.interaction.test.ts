import { afterEach, expect, it, vi } from "vitest"
import {
  readNodeCatalog, readNodeRuntimeCatalog, readNodeLogs, readNodeHealth,
} from "@/lib/node-hosting-client"

const id = "node-" + "a".repeat(32)
const release = "r-" + "b".repeat(32)
afterEach(() => vi.unstubAllGlobals())

it("read-only Node catalog, runtime journal and logs preserve explicit owned identities", async () => {
  const fetchMock = vi.fn(async (url: string) => {
    if (url === "/api/v1/node-projects")
      return { ok: true, status: 200, json: async () => ({
        projects: [{ id, name: "Example Node", kind: "node" }],
      }) }
    if (url === "/api/v1/node-projects/" + id + "/runtime")
      return { ok: true, status: 200, json: async () => ({
        runtime: { state: "running", desired: "running", port: 19090,
          healthDecision: { action: "none", reason: "ready", nextEligibleAtMs: null },
          activeRelease: release, lastGoodRelease: release, previousGoodRelease: null,
          history: [{ at: "2026-11-10T01:00:00Z", action: "start", release }] },
      }) }
    if (url === "/api/v1/node-projects/" + id + "/logs")
      return { ok: true, status: 200, json: async () => ({ logs: { lines: ["started"] } }) }
    return { ok: false, status: 404 }
  })
  vi.stubGlobal("fetch", fetchMock)
  const catalog = await readNodeRuntimeCatalog()
  expect(catalog.enabled).toBe(true)
  expect(catalog.projects[0]?.name).toBe("Example Node")
  expect(catalog.projects[0]?.history[0]?.action).toBe("start")
  expect(await readNodeLogs(id)).toEqual(["started"])
  expect(fetchMock).toHaveBeenCalledTimes(3)
})

it("disabled Node Hosting never tries to inspect external services", async () => {
  const fetchMock = vi.fn(async () => ({ ok: false, status: 404 }))
  vi.stubGlobal("fetch", fetchMock)
  expect(await readNodeCatalog()).toEqual({ enabled: false, projects: [] })
  expect((await readNodeRuntimeCatalog()).projects).toEqual([])
  expect(fetchMock).toHaveBeenCalledTimes(2)
})
it("malformed identities, deployment records and logs are rejected", async () => {
  const fetchMock = vi.fn(async (url: string) => ({
    ok: true, status: 200, json: async () => url.endsWith("/runtime")
      ? { runtime: { state: "running", desired: "running", port: 19090,
          healthDecision: { action: "none", reason: "ready", nextEligibleAtMs: null },
          activeRelease: "invalid", lastGoodRelease: null, previousGoodRelease: null,
          history: [] } }
      : url.endsWith("/logs") ? { logs: { lines: ["x".repeat(300)] } }
        : { projects: [{ id: "foreign", kind: "node", name: "Fake" }] },
  }))
  vi.stubGlobal("fetch", fetchMock)
  await expect(readNodeCatalog()).rejects.toThrow(/identity/)
  await expect(readNodeRuntimeCatalog()).rejects.toThrow(/identity/)
  await expect(readNodeLogs(id)).rejects.toThrow(/logs/)
  await expect(import("@/lib/node-hosting-client").then(({ readNodeRuntime }) =>
    readNodeRuntime(id))).rejects.toThrow(/runtime/)
})

it("readiness is fetched only on explicit request and validates owned release identity", async () => {
  const calls = vi.fn(async (url: string) => ({
    ok: true, status: 200, json: async () => ({ health: {
      state: "running", ready: true, release,
    } }),
  }))
  vi.stubGlobal("fetch", calls)
  expect(await readNodeHealth(id)).toEqual({ state: "running", ready: true, release })
  expect(calls).toHaveBeenCalledTimes(1)
  expect(String(calls.mock.calls[0]?.[0])).toBe("/api/v1/node-projects/" + id + "/health")
  await expect(readNodeHealth("foreign")).rejects.toThrow(/ID/)
  expect(calls).toHaveBeenCalledTimes(1)
})

it("rejects inconsistent readiness rather than treating malformed health as ready", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => ({
    ok: true, status: 200, json: async () => ({ health: {
      state: "stopped", ready: true, release,
    } }),
  })))
  await expect(readNodeHealth(id)).rejects.toThrow(/health/)
})
