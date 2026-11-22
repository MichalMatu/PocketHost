import { afterEach, expect, it, vi } from "vitest"
import { act, cleanup, renderHook, waitFor } from "@testing-library/react"
import { useSiteAssets } from "@/app/sites/use-site-assets"
import type { FleetSite } from "@/lib/site-fleet-schema"

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

const site = {
  id: "site-" + "a".repeat(32), state: "stopped",
  activeRelease: "r-" + "b".repeat(32),
} as FleetSite
const files = (name: string) => ({
  ok: true,
  json: async () => ({ files: [{ name, bytes: 101 }] }),
})
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: Error) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

it("cancels a pending asset read without waiting and ignores its late response", async () => {
  const old = deferred<ReturnType<typeof files>>()
  const fetcher = vi.fn()
    .mockImplementationOnce(() => old.promise)
    .mockImplementationOnce(async () => files("css/current.css"))
  vi.stubGlobal("fetch", fetcher)
  const setError = vi.fn()
  const hook = renderHook(() => useSiteAssets(site, setError, false))
  act(() => { hook.result.current.toggleAssets() })
  expect(hook.result.current.assetsLoading).toBe(true)
  act(() => { hook.result.current.toggleAssets() })
  expect(hook.result.current.assetsLoading).toBe(false)
  expect(hook.result.current.assets).toBeNull()
  act(() => { hook.result.current.toggleAssets() })
  await waitFor(() => expect(hook.result.current.assets?.[0].name).toBe("css/current.css"))
  await act(async () => { old.resolve(files("css/stale.css")); await old.promise })
  expect(hook.result.current.assets?.[0].name).toBe("css/current.css")
  expect(setError).not.toHaveBeenCalledWith("Active site files are unavailable.")
  expect(fetcher).toHaveBeenCalledTimes(2)
})

it("does not surface a canceled read failure on a reopened asset list", async () => {
  const old = deferred<ReturnType<typeof files>>()
  const next = deferred<ReturnType<typeof files>>()
  const fetcher = vi.fn()
    .mockImplementationOnce(() => old.promise)
    .mockImplementationOnce(() => next.promise)
  vi.stubGlobal("fetch", fetcher)
  const setError = vi.fn()
  const hook = renderHook(() => useSiteAssets(site, setError, false))
  act(() => { hook.result.current.toggleAssets() })
  act(() => { hook.result.current.toggleAssets() })
  act(() => { hook.result.current.toggleAssets() })
  await act(async () => { old.reject(new Error("stale read failed")); await old.promise.catch(() => {}) })
  expect(hook.result.current.assetsLoading).toBe(true)
  expect(setError).not.toHaveBeenCalledWith("stale read failed")
  await act(async () => { next.resolve(files("index.html")); await next.promise })
  await waitFor(() => expect(hook.result.current.assets?.[0].name).toBe("index.html"))
  expect(hook.result.current.assetsLoading).toBe(false)
})

it("invalidates the old asset request when the site inventory revision changes", async () => {
  const old = deferred<ReturnType<typeof files>>()
  const fetcher = vi.fn().mockImplementationOnce(() => old.promise)
  vi.stubGlobal("fetch", fetcher)
  const hook = renderHook(({ entry }) => useSiteAssets(entry, vi.fn(), false), {
    initialProps: { entry: site },
  })
  act(() => { hook.result.current.toggleAssets() })
  hook.rerender({ entry: { ...site } })
  expect(hook.result.current.assetsLoading).toBe(false)
  await act(async () => { old.resolve(files("old/index.html")); await old.promise })
  expect(hook.result.current.assets).toBeNull()
  expect(fetcher).toHaveBeenCalledTimes(1)
})
