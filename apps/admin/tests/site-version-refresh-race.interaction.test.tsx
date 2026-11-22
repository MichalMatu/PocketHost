import { afterEach, expect, it, vi } from "vitest"
import { act, cleanup, renderHook, waitFor } from "@testing-library/react"
import { useSiteVersions } from "@/app/sites/use-site-versions"
import type { FleetSite } from "@/lib/site-fleet-schema"

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

const id = "site-" + "a".repeat(32)
const first = "r-" + "b".repeat(32)
const second = "r-" + "c".repeat(32)
const site = { id } as FleetSite
const makeResponse = (release: string) => ({
  ok: true,
  json: async () => ({ releases: [{
    id: release, createdAt: "2026-11-22T16:00:00.000Z",
    fileCount: 1, bytes: 100, active: false, rollbackTarget: false,
  }] }),
})

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: Error) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

it("closing a pending version history lets the owner reopen immediately", async () => {
  const old = deferred<ReturnType<typeof makeResponse>>()
  const get = vi.fn()
    .mockImplementationOnce(() => old.promise)
    .mockImplementationOnce(async () => makeResponse(second))
  vi.stubGlobal("fetch", get)
  const setError = vi.fn()
  const epoch = { current: 0 }
  const hook = renderHook(() => useSiteVersions(site, epoch, setError, false))
  act(() => { hook.result.current.toggleVersions() })
  expect(hook.result.current.versionsLoading).toBe(true)
  act(() => { hook.result.current.toggleVersions() })
  expect(hook.result.current.versionsLoading).toBe(false)

  act(() => { hook.result.current.toggleVersions() })
  await waitFor(() => expect(hook.result.current.versions?.[0].id).toBe(second))
  expect(get).toHaveBeenCalledTimes(2)
  await act(async () => { old.resolve(makeResponse(first)); await old.promise })
  expect(hook.result.current.versions?.[0].id).toBe(second)
  expect(hook.result.current.versionsLoading).toBe(false)
  expect(setError).not.toHaveBeenCalled()
})

it("a late failure from a closed request cannot close a newly opened version history", async () => {
  const old = deferred<ReturnType<typeof makeResponse>>()
  const newer = deferred<ReturnType<typeof makeResponse>>()
  const get = vi.fn()
    .mockImplementationOnce(() => old.promise)
    .mockImplementationOnce(() => newer.promise)
  vi.stubGlobal("fetch", get)
  const setError = vi.fn()
  const hook = renderHook(() => useSiteVersions(site, { current: 0 }, setError, false))
  act(() => { hook.result.current.toggleVersions() })
  act(() => { hook.result.current.toggleVersions() })
  act(() => { hook.result.current.toggleVersions() })
  await act(async () => { old.reject(new Error("stale failed request")); await old.promise.catch(() => {}) })
  expect(hook.result.current.versionsLoading).toBe(true)
  expect(setError).not.toHaveBeenCalled()
  await act(async () => { newer.resolve(makeResponse(second)); await newer.promise })
  await waitFor(() => expect(hook.result.current.versions?.[0].id).toBe(second))
  expect(hook.result.current.versionsLoading).toBe(false)
  expect(setError).not.toHaveBeenCalled()
})

it("a fresh site revision supersedes an older version GET", async () => {
  const old = deferred<ReturnType<typeof makeResponse>>()
  const get = vi.fn()
    .mockImplementationOnce(() => old.promise)
    .mockImplementationOnce(async () => makeResponse(second))
  vi.stubGlobal("fetch", get)
  const epoch = { current: 0 }
  const hook = renderHook(({ entry }) =>
    useSiteVersions(entry, epoch, vi.fn(), false), {
    initialProps: { entry: site },
  })
  act(() => { hook.result.current.toggleVersions() })
  epoch.current += 1
  hook.rerender({ entry: { ...site } })
  await waitFor(() => expect(hook.result.current.versions?.[0].id).toBe(second))
  await act(async () => { old.resolve(makeResponse(first)); await old.promise })
  expect(hook.result.current.versions?.[0].id).toBe(second)
})

it("rejects duplicate release identities and allows a clean retry", async () => {
  const release = {
    id: first, createdAt: "2026-11-22T16:00:00.000Z",
    fileCount: 1, bytes: 100, active: false, rollbackTarget: false,
  }
  const get = vi.fn()
    .mockImplementationOnce(async () => ({
      ok: true, json: async () => ({ releases: [release, { ...release }] }),
    }))
    .mockImplementationOnce(async () => makeResponse(second))
  vi.stubGlobal("fetch", get)
  const setError = vi.fn()
  const hook = renderHook(() => useSiteVersions(site, { current: 0 }, setError, false))
  act(() => { hook.result.current.toggleVersions() })
  await waitFor(() => expect(setError).toHaveBeenCalledWith(
    "Inconsistent version inventory",
  ))
  expect(hook.result.current.versions).toBeNull()
  expect(hook.result.current.versionsLoading).toBe(false)

  act(() => { hook.result.current.toggleVersions() })
  await waitFor(() => expect(hook.result.current.versions?.[0].id).toBe(second))
  expect(hook.result.current.versions).toHaveLength(1)
  expect(get).toHaveBeenCalledTimes(2)
})

it.each([
  { label: "an old active release", active: second, rollback: first },
  { label: "a missing quick rollback", active: first, rollback: null },
])("rejects $label when history disagrees with the site and permits retry", async ({
  active, rollback,
}) => {
  const verified = { ...site, activeRelease: first, previousRelease: second } as FleetSite
  const response = (current: string | null, previous: string | null) => ({
    ok: true,
    json: async () => ({ releases: [first, second].map(release => ({
      id: release, createdAt: "2026-11-22T16:00:00.000Z",
      fileCount: 1, bytes: 100,
      active: current === release, rollbackTarget: previous === release,
    })) }),
  })
  const get = vi.fn()
    .mockImplementationOnce(async () => response(active, rollback))
    .mockImplementationOnce(async () => response(first, second))
  vi.stubGlobal("fetch", get)
  const setError = vi.fn()
  const hook = renderHook(() => useSiteVersions(verified, { current: 0 }, setError, false))
  act(() => { hook.result.current.toggleVersions() })
  await waitFor(() => expect(setError).toHaveBeenCalledWith(
    "Version history does not match the current site. Refresh and retry.",
  ))
  expect(hook.result.current.versions).toBeNull()
  expect(hook.result.current.versionsLoading).toBe(false)
  act(() => { hook.result.current.toggleVersions() })
  await waitFor(() => expect(hook.result.current.versions).toHaveLength(2))
  expect(hook.result.current.versions?.find(release => release.active)?.id).toBe(first)
  expect(hook.result.current.versions?.find(release => release.rollbackTarget)?.id).toBe(second)
  expect(get).toHaveBeenCalledTimes(2)
  expect(get.mock.calls.every(([, options]) => !options?.method)).toBe(true)
})
