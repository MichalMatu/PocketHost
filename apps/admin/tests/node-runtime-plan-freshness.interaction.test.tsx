import * as React from "react"
import { afterEach, expect, it, vi } from "vitest"
import { act, cleanup, renderHook } from "@testing-library/react"
import { useNodeProjectInspection } from "@/app/projects/use-node-project-inspection"

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
