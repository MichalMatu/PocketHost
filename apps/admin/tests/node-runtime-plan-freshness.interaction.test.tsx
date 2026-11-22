import * as React from "react"
import { afterEach, expect, it, vi } from "vitest"
import { act, cleanup, renderHook } from "@testing-library/react"
import { useNodeProjectInspection } from "@/app/projects/use-node-project-inspection"
import { NodeRuntimeDetails } from "@/app/projects/node-runtime-details"
import { renderToStaticMarkup } from "react-dom/server"

afterEach(() => cleanup())

const ID = "node-" + "a".repeat(32)
const release = "r-" + "b".repeat(32)
const runtime = {
  state: "stopped", desired: "stopped", port: 19090,
  activeRelease: release, lastGoodRelease: release,
  previousGoodRelease: null, history: [],
}
const plan = {
  release, allowed: true, reason: "verified", port: 19090,
  missingTools: [], conflicts: [], dependencyCount: 0,
  nodeVersion: "22.0.0", npmVersion: "10.0.0",
}
const status = { runtime, executionEnabled: true }
const preview = { plan, executionEnabled: true }

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: Error) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

const reader = () => vi.fn(async (url: string): Promise<Record<string, unknown>> =>
  url.endsWith("/runtime") ? status : preview)

it("invalidates a previously approved runtime plan while the next read is pending and fails", async () => {
  const getJson = reader()
  const resetReviews = vi.fn()
  const hook = renderHook(() => useNodeProjectInspection(getJson, resetReviews))
  await act(async () => { await hook.result.current.loadRuntime(ID) })
  expect(hook.result.current.plan?.allowed).toBe(true)
  expect(hook.result.current.executionEnabled).toBe(true)
  const pending = deferred<Record<string, unknown>>()
  getJson.mockImplementation(async url =>
    url.endsWith("/runtime") ? pending.promise : preview)
  let request!: Promise<unknown>
  act(() => { request = hook.result.current.loadRuntime(ID) })
  expect(hook.result.current.runtime).toBeNull()
  expect(hook.result.current.plan).toBeNull()
  expect(hook.result.current.executionEnabled).toBe(false)
  await act(async () => {
    pending.reject(new Error("runtime read failed"))
    await expect(request).rejects.toThrow("runtime read failed")
  })
  expect(hook.result.current.plan).toBeNull()
  expect(hook.result.current.executionEnabled).toBe(false)
  expect(resetReviews).toHaveBeenCalledTimes(2)
})

it("leaves execution unavailable when a new host report fails validation", async () => {
  const getJson = reader()
  const hook = renderHook(() => useNodeProjectInspection(getJson, vi.fn()))
  await act(async () => { await hook.result.current.loadRuntime(ID) })
  expect(hook.result.current.runtime?.state).toBe("stopped")
  getJson.mockImplementation(async url => url.endsWith("/runtime")
    ? { runtime: { ...runtime, state: "not-a-runtime" }, executionEnabled: true }
    : preview)
  await act(async () => {
    await expect(hook.result.current.loadRuntime(ID))
      .rejects.toThrow("Invalid Node runtime state")
  })
  expect(hook.result.current.runtime).toBeNull()
  expect(hook.result.current.plan).toBeNull()
  expect(hook.result.current.executionEnabled).toBe(false)
})

it("does not let a superseded response restore an older plan", async () => {
  const old = deferred<Record<string, unknown>>()
  const getJson = reader()
  const hook = renderHook(() => useNodeProjectInspection(getJson, vi.fn()))
  getJson.mockImplementation(async url =>
    url.endsWith("/runtime") ? old.promise : preview)
  let first!: Promise<unknown>
  act(() => { first = hook.result.current.loadRuntime(ID) })
  getJson.mockImplementation(async url =>
    url.endsWith("/runtime") ? status : { plan: { ...plan, allowed: false }, executionEnabled: false })
  await act(async () => { await hook.result.current.loadRuntime(ID) })
  expect(hook.result.current.plan?.allowed).toBe(false)
  await act(async () => { old.resolve(status); await first })
  expect(hook.result.current.plan?.allowed).toBe(false)
  expect(hook.result.current.executionEnabled).toBe(false)
})

it.each([
  [{ ...plan, allowed: "true" }, "Invalid Node runtime plan"],
  [{ ...plan, release: { id: release } }, "Invalid Node runtime plan"],
  [{ ...plan, missingTools: "node" }, "Invalid Node runtime plan"],
  [[{ ...plan }], "Invalid Node runtime report"],
] as const)("rejects malformed plan claims instead of exposing them as approvals", async (badPlan, reason) => {
  const getJson = reader()
  const hook = renderHook(() => useNodeProjectInspection(getJson, vi.fn()))
  await act(async () => { await hook.result.current.loadRuntime(ID) })
  expect(hook.result.current.plan?.allowed).toBe(true)
  getJson.mockImplementation(async url =>
    url.endsWith("/runtime") ? status : { plan: badPlan, executionEnabled: true })
  await act(async () => {
    await expect(hook.result.current.loadRuntime(ID)).rejects.toThrow(reason)
  })
  expect(hook.result.current.plan).toBeNull()
  expect(hook.result.current.runtime).toBeNull()
  expect(hook.result.current.executionEnabled).toBe(false)
})

it("treats legacy plan reports without an allowed flag as non-actionable", async () => {
  const getJson = reader()
  getJson.mockImplementation(async url =>
    url.endsWith("/runtime") ? status :
      { plan: { release, reason: "legacy read only" }, executionEnabled: true })
  const hook = renderHook(() => useNodeProjectInspection(getJson, vi.fn()))
  await act(async () => { await hook.result.current.loadRuntime(ID) })
  expect(hook.result.current.plan?.allowed).toBe(false)
  expect(hook.result.current.plan?.reason).toBe("legacy read only")
  expect(hook.result.current.plan?.missingTools).toEqual([])
  expect(hook.result.current.plan?.conflicts).toEqual([])
  expect(hook.result.current.plan?.dependencyIssues).toEqual([])
  expect(renderToStaticMarkup(
    <NodeRuntimeDetails runtime={hook.result.current.runtime}
      plan={hook.result.current.plan} buildReview={null} dependencyReview={null} />,
  )).toContain("legacy read only")
})

it.each([
  { dependencyIssues: { bad: true } },
  { reason: { bad: true } },
  { dependencyCount: { bad: true } },
  { nodeVersion: { bad: true } },
  { port: "19090" },
  { allowed: true, missingTools: undefined },
] as const)("rejects invalid display fields without breaking the project screen", async invalid => {
  const getJson = reader()
  const hook = renderHook(() => useNodeProjectInspection(getJson, vi.fn()))
  getJson.mockImplementation(async url =>
    url.endsWith("/runtime") ? status :
      { plan: { ...plan, ...invalid }, executionEnabled: true })
  await act(async () => {
    await expect(hook.result.current.loadRuntime(ID)).rejects.toThrow("Invalid Node runtime plan")
  })
  expect(hook.result.current.plan).toBeNull()
  expect(hook.result.current.executionEnabled).toBe(false)
})

it.each([
  { history: { length: 1 } },
  { history: [{ at: "broken", action: "start", release }] },
  { history: [{ at: "2026-11-22T16:00:00.000Z", action: { name: "start" }, release }] },
  { port: "19300" },
  // String(...) may stringify an object to a valid status; reject non-primitives.
  { state: Object("stopped") },
  { state: { toString: () => "running" } },
  { desired: Object("stopped") },
  { desired: { toString: () => "running" } },
  { lastGoodRelease: { id: release } },
  { previousGoodRelease: "not-a-release" },
  { healthDecision: { action: "none", reason: { broken: true }, nextEligibleAtMs: null } },
] as const)("rejects invalid runit runtime fields before enabling any action", async invalid => {
  const getJson = reader()
  const hook = renderHook(() => useNodeProjectInspection(getJson, vi.fn()))
  await act(async () => { await hook.result.current.loadRuntime(ID) })
  expect(hook.result.current.executionEnabled).toBe(true)
  getJson.mockImplementation(async url => url.endsWith("/runtime")
    ? { runtime: { ...runtime, ...invalid }, executionEnabled: true } : preview)
  await act(async () => {
    await expect(hook.result.current.loadRuntime(ID))
      .rejects.toThrow("Invalid Node runtime state")
  })
  expect(hook.result.current.runtime).toBeNull()
  expect(hook.result.current.plan).toBeNull()
  expect(hook.result.current.executionEnabled).toBe(false)
})

it("keeps a valid runit history in order and normalizes missing legacy history", async () => {
  const getJson = reader()
  const hook = renderHook(() => useNodeProjectInspection(getJson, vi.fn()))
  const event = { at: "2026-11-22T16:00:00.000Z", action: "stop", release }
  getJson.mockImplementation(async url => url.endsWith("/runtime")
    ? { runtime: { ...runtime, history: [event] }, executionEnabled: true } : preview)
  await act(async () => { await hook.result.current.loadRuntime(ID) })
  expect(hook.result.current.runtime?.history).toEqual([event])
  getJson.mockImplementation(async url => url.endsWith("/runtime")
    ? { runtime: { ...runtime, history: undefined }, executionEnabled: false } : preview)
  await act(async () => { await hook.result.current.loadRuntime(ID) })
  expect(hook.result.current.runtime?.history).toEqual([])
})
