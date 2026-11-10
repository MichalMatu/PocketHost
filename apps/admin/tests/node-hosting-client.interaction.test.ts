import { afterEach, expect, it, vi } from "vitest"
import {
  readNodeCatalog, readNodeRuntimeCatalog, readNodeLogs,
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
        runtime: { state: "running", activeRelease: release, lastGoodRelease: release,
          previousGoodRelease: null,
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
      ? { runtime: { state: "running", activeRelease: "invalid",
          lastGoodRelease: null, previousGoodRelease: null, history: [] } }
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
