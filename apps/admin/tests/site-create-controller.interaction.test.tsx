import type * as React from "react"
import { afterEach, expect, it, vi } from "vitest"
import { act, cleanup, renderHook } from "@testing-library/react"
import { useOwnedSiteCreation } from "@/app/sites/use-owned-site-creation"

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

it("sends at most one create POST if submit fires twice before the React busy render", async () => {
  let rejectWrite!: (cause: Error) => void
  const stalledWrite = new Promise<never>((_resolve, reject) => { rejectWrite = reject })
  const fetcher = vi.fn((_url: string, options?: RequestInit) => {
    if (options?.method !== "POST") throw new Error("Unexpected read during pending POST")
    return stalledWrite
  })
  vi.stubGlobal("fetch", fetcher)
  const setSites = vi.fn()
  const setError = vi.fn()
  const hook = renderHook(() => useOwnedSiteCreation({
    sitesCount: 0, loading: false, error: null, setSites, setError,
  }))
  act(() => { hook.result.current.setName("New static site") })
  const event = { preventDefault: vi.fn() } as unknown as React.FormEvent<HTMLFormElement>
  let first!: Promise<void>
  let duplicate!: Promise<void>
  act(() => {
    first = hook.result.current.createSite(event)
    duplicate = hook.result.current.createSite(event)
  })
  expect(event.preventDefault).toHaveBeenCalledTimes(2)
  expect(fetcher).toHaveBeenCalledTimes(1)
  expect(fetcher.mock.calls[0][0]).toBe("/api/v1/sites/")
  await act(async () => {
    rejectWrite(new Error("transport unavailable"))
    await Promise.all([first, duplicate])
  })
  expect(hook.result.current.creating).toBe(false)
  expect(setSites).toHaveBeenCalledWith([])
  expect(setError).toHaveBeenCalledWith("Create result unconfirmed. Refresh before retrying.")
})

it("rejects a folder without a nonempty index.html before creating a site", async () => {
  const fetcher = vi.fn()
  vi.stubGlobal("fetch", fetcher)
  const hook = renderHook(() => useOwnedSiteCreation({
    sitesCount: 0, loading: false, error: null,
    setSites: vi.fn(), setError: vi.fn(),
  }))
  act(() => {
    hook.result.current.setName("My static site")
    hook.result.current.setInitialFolder([new File(["body {}"], "main.css")])
  })
  await act(async () => {
    await hook.result.current.createSite({
      preventDefault: vi.fn(),
    } as unknown as React.FormEvent<HTMLFormElement>)
  })
  expect(hook.result.current.inputError).toBe(
    "Folder needs a nonempty index.html at the root or inside one top-level folder.",
  )
  expect(fetcher).not.toHaveBeenCalled()
})

it.each(["root", "wrapped"] as const)(
  "explains hidden %s folder files before creating a site",
  async scope => {
    const homepage = new File(["<h1>Site</h1>"], "index.html")
    const sidecar = new File(["metadata"], ".DS_Store")
    if (scope === "wrapped") {
      Object.defineProperty(homepage, "webkitRelativePath", { value: "homepage/index.html" })
      Object.defineProperty(sidecar, "webkitRelativePath", { value: "homepage/.DS_Store" })
    }
    const fetcher = vi.fn()
    vi.stubGlobal("fetch", fetcher)
    const hook = renderHook(() => useOwnedSiteCreation({
      sitesCount: 0, loading: false, error: null,
      setSites: vi.fn(), setError: vi.fn(),
    }))
    act(() => {
      hook.result.current.setName("My static site")
      hook.result.current.setInitialFolder([homepage, sidecar])
    })
    await act(async () => {
      await hook.result.current.createSite({
        preventDefault: vi.fn(),
      } as unknown as React.FormEvent<HTMLFormElement>)
    })
    expect(hook.result.current.inputError).toBe(
      "Folder contains hidden files (such as .DS_Store). Remove them before importing.",
    )
    expect(hook.result.current.creating).toBe(false)
    expect(fetcher).not.toHaveBeenCalled()
  },
)

it.each(["root", "wrapped"] as const)(
  "rejects a new site folder with case-insensitive duplicate %s paths before POST",
  async scope => {
    const first = new File(["<h1>Page</h1>"], "index.html")
    const duplicate = new File(["other"], "INDEX.HTML")
    if (scope === "wrapped") {
      Object.defineProperty(first, "webkitRelativePath", { value: "homepage/index.html" })
      Object.defineProperty(duplicate, "webkitRelativePath", { value: "homepage/INDEX.HTML" })
    }
    const fetcher = vi.fn()
    vi.stubGlobal("fetch", fetcher)
    const hook = renderHook(() => useOwnedSiteCreation({
      sitesCount: 0, loading: false, error: null,
      setSites: vi.fn(), setError: vi.fn(),
    }))
    act(() => {
      hook.result.current.setName("New static site")
      hook.result.current.setInitialFolder([first, duplicate])
    })
    await act(async () => {
      await hook.result.current.createSite({
        preventDefault: vi.fn(),
      } as unknown as React.FormEvent<HTMLFormElement>)
    })
    expect(hook.result.current.inputError).toBe(
      "Folder contains duplicate file paths. Rename files that differ only by case.",
    )
    expect(hook.result.current.creating).toBe(false)
    expect(fetcher).not.toHaveBeenCalled()
  },
)

it("rejects empty starter HTML locally before a create request", async () => {
  const fetcher = vi.fn()
  vi.stubGlobal("fetch", fetcher)
  const hook = renderHook(() => useOwnedSiteCreation({
    sitesCount: 0, loading: false, error: null,
    setSites: vi.fn(), setError: vi.fn(),
  }))
  act(() => {
    hook.result.current.setName("New static site")
    hook.result.current.setPublishStarter(true)
    hook.result.current.setInitialHtml("   ")
  })
  await act(async () => {
    await hook.result.current.createSite({
      preventDefault: vi.fn(),
    } as unknown as React.FormEvent<HTMLFormElement>)
  })
  expect(hook.result.current.inputError).toBe("Initial index.html cannot be empty.")
  expect(fetcher).not.toHaveBeenCalled()
})
