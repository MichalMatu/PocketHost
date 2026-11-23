import type * as React from "react"
import { afterEach, expect, it, vi } from "vitest"
import { act, cleanup, renderHook } from "@testing-library/react"
import type { FleetSite } from "@/lib/site-fleet-schema"
import { useSiteReleaseImport } from "@/app/sites/use-site-release-import"

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks() })

const site = {
  id: "site-" + "a".repeat(32),
  name: "Test static site",
  state: "stopped",
  activeRelease: "r-" + "b".repeat(32),
} as FleetSite

function selected(files: File[]): React.ChangeEvent<HTMLInputElement> {
  const input = document.createElement("input")
  Object.defineProperty(input, "files", { configurable: true, value: files })
  return { currentTarget: input } as React.ChangeEvent<HTMLInputElement>
}

it("rejects an oversized update folder before any release mutation", () => {
  const execute = vi.fn(async () => {})
  const setError = vi.fn()
  const setMessage = vi.fn()
  const hook = renderHook(() => useSiteReleaseImport({
    site, busy: false, outcomeUnknown: false,
    html: "<h1>Hello</h1>", editorReady: true, execute, setError, setMessage,
  }))
  const event = selected([new File([new Uint8Array(2 * 1024 * 1024 + 1)], "large.html")])
  act(() => { hook.result.current.folder(event) })
  expect(execute).not.toHaveBeenCalled()
  expect(setError).toHaveBeenCalledWith("Folder exceeds 100 files, 2 MiB per file or 8 MiB total.")
  expect(setMessage).toHaveBeenCalledWith(null)
  expect(event.currentTarget.value).toBe("")
})

it.each([
  { label: "missing index.html", files: [new File(["assets"], "main.css")] },
  { label: "empty index.html", files: [new File([], "index.html")] },
])("rejects $label before confirming or publishing folder changes", ({ files }) => {
  const execute = vi.fn(async () => {})
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(true)
  const setError = vi.fn()
  const hook = renderHook(() => useSiteReleaseImport({
    site, busy: false, outcomeUnknown: false,
    html: "<h1>Hello</h1>", editorReady: true,
    execute, setError, setMessage: vi.fn(),
  }))
  const event = selected(files)
  act(() => { hook.result.current.folder(event) })
  expect(setError).toHaveBeenCalledWith(
    "Folder needs a nonempty index.html at the root or inside one top-level folder.",
  )
  expect(confirm).not.toHaveBeenCalled()
  expect(execute).not.toHaveBeenCalled()
  expect(event.currentTarget.value).toBe("")
})

it("accepts a directory picker selection with one shared parent folder", () => {
  const html = new File(["<h1>Page</h1>"], "index.html")
  const css = new File(["body {}"], "main.css")
  Object.defineProperty(html, "webkitRelativePath", { value: "homepage/index.html" })
  Object.defineProperty(css, "webkitRelativePath", { value: "homepage/main.css" })
  const execute = vi.fn(async () => {})
  const hook = renderHook(() => useSiteReleaseImport({
    site: { ...site, activeRelease: null }, busy: false, outcomeUnknown: false,
    html: "<h1>Hello</h1>", editorReady: true,
    execute, setError: vi.fn(), setMessage: vi.fn(),
  }))
  act(() => { hook.result.current.folder(selected([html, css])) })
  expect(execute).toHaveBeenCalledTimes(1)
})

it("requires nonempty host readback for a published folder release", () => {
  const execute = vi.fn(async (
    _job: () => Promise<unknown>, _success: string, _mutation?: boolean,
    _expected?: (observed: FleetSite) => boolean,
  ) => {})
  const hook = renderHook(() => useSiteReleaseImport({
    site, busy: false, outcomeUnknown: false,
    html: "<h1>Hello</h1>", editorReady: true,
    execute, setError: vi.fn(), setMessage: vi.fn(),
  }))
  const file = new File(["<h1>Page</h1>"], "index.html")
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(true)
  act(() => { hook.result.current.folder(selected([file])) })
  expect(confirm).toHaveBeenCalledTimes(1)
  expect(execute).toHaveBeenCalledTimes(1)
  const [, message, mutation, expected] = execute.mock.calls[0]
  expect(message).toBe("Folder was published as a new immutable release.")
  expect(mutation).toBe(true)
  const matches = expected as (observed: FleetSite) => boolean
  const next = "r-" + "c".repeat(32)
  expect(matches({ ...site, activeRelease: next, fileCount: 1, bytes: file.size }))
    .toBe(true)
  expect(matches({ ...site, activeRelease: next, fileCount: 0, bytes: 0 }))
    .toBe(false)
  expect(matches({ ...site, activeRelease: next, fileCount: 1, bytes: 0 }))
    .toBe(false)
  expect(matches({ ...site, activeRelease: site.activeRelease, fileCount: 1, bytes: file.size }))
    .toBe(false)
})

it("cancels a replacement ZIP before any write and clears the file picker", () => {
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(false)
  const execute = vi.fn(async () => {})
  const hook = renderHook(() => useSiteReleaseImport({
    site, busy: false, outcomeUnknown: false,
    html: "<h1>Hello</h1>", editorReady: true, execute,
    setError: vi.fn(), setMessage: vi.fn(),
  }))
  const event = selected([new File(["zip data"], "updated.zip", { type: "application/zip" })])
  act(() => { hook.result.current.zip(event) })
  expect(confirm).toHaveBeenCalledWith("Publish a new release of Test static site?")
  expect(execute).not.toHaveBeenCalled()
  expect(event.currentTarget.value).toBe("")
})

it.each(["ZIP", "folder"] as const)(
  "clears stale feedback after selecting a valid %s then canceling publication",
  kind => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false)
    const execute = vi.fn(async () => {})
    const setError = vi.fn()
    const setMessage = vi.fn()
    const hook = renderHook(() => useSiteReleaseImport({
      site, busy: false, outcomeUnknown: false,
      html: "<h1>Hello</h1>", editorReady: true, execute, setError, setMessage,
    }))
    act(() => {
      if (kind === "ZIP") {
        hook.result.current.zip(selected([new File(["invalid"], "wrong.txt")]))
        hook.result.current.zip(selected([new File(["zip bytes"], "updated.zip")]))
      } else {
        hook.result.current.folder(selected([
          new File([new Uint8Array(2 * 1024 * 1024 + 1)], "too-large.html"),
        ]))
        hook.result.current.folder(selected([new File(["hello"], "index.html")]))
      }
    })
    expect(setError.mock.calls.some(([value]) => typeof value === "string")).toBe(true)
    expect(setError).toHaveBeenLastCalledWith(null)
    expect(setMessage).toHaveBeenLastCalledWith(null)
    expect(confirm).toHaveBeenCalledTimes(1)
    expect(execute).not.toHaveBeenCalled()
  },
)

it("preserves first ZIP update readback requirements without starting any host action", () => {
  const execute = vi.fn(async (
    _job: () => Promise<unknown>, _success: string, _mutation?: boolean,
    _expected?: (observed: FleetSite) => boolean,
  ) => {})
  const hook = renderHook(() => useSiteReleaseImport({
    site: { ...site, activeRelease: null }, busy: false, outcomeUnknown: false,
    html: "<h1>Hello</h1>", editorReady: true,
    execute, setError: vi.fn(), setMessage: vi.fn(),
  }))
  act(() => {
    hook.result.current.zip(selected([new File(["zip payload"], "first.zip")]))
  })
  expect(execute).toHaveBeenCalledTimes(1)
  const [, success, mutation, matches] = execute.mock.calls[0]
  expect(success).toBe("ZIP was published as a new immutable release.")
  expect(mutation).toBe(true)
  const expected = matches as (observed: FleetSite) => boolean
  expect(expected({ ...site, activeRelease: "r-" + "c".repeat(32), fileCount: 1, bytes: 11 }))
    .toBe(true)
  expect(expected({ ...site, activeRelease: null, fileCount: 0, bytes: 0 }))
    .toBe(false)
})

it.each([
  { name: "unverified editor", editorReady: false, busy: false, outcomeUnknown: false },
  { name: "busy operation", editorReady: true, busy: true, outcomeUnknown: false },
  { name: "unconfirmed prior write", editorReady: true, busy: false, outcomeUnknown: true },
])("does not publish HTML when $name blocks the action", scenario => {
  const execute = vi.fn(async () => {})
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(true)
  const hook = renderHook(() => useSiteReleaseImport({
    site: { ...site, fileCount: 1 }, html: "<h1>Updated</h1>",
    ...scenario, execute, setError: vi.fn(), setMessage: vi.fn(),
  }))
  act(() => { hook.result.current.publishHtml() })
  expect(execute).not.toHaveBeenCalled()
  expect(confirm).not.toHaveBeenCalled()
})

it("rejects oversized multibyte HTML without scheduling a release", () => {
  const execute = vi.fn(async () => {})
  const setError = vi.fn()
  const hook = renderHook(() => useSiteReleaseImport({
    site: { ...site, fileCount: 1 }, busy: false, outcomeUnknown: false,
    html: "🦊".repeat(9000), editorReady: true, execute,
    setError, setMessage: vi.fn(),
  }))
  act(() => { hook.result.current.publishHtml() })
  expect(setError).toHaveBeenCalledWith(
    "HTML is larger than 32 KiB. Use Upload folder or ZIP instead.",
  )
  expect(execute).not.toHaveBeenCalled()
})

it("keeps HTML publication canceled while clearing obsolete feedback", () => {
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(false)
  const execute = vi.fn(async () => {})
  const setError = vi.fn()
  const setMessage = vi.fn()
  const hook = renderHook(() => useSiteReleaseImport({
    site: { ...site, fileCount: 1 }, busy: false, outcomeUnknown: false,
    html: "<h1>Updated</h1>", editorReady: true, execute,
    setError, setMessage,
  }))
  act(() => { hook.result.current.publishHtml() })
  expect(setError).toHaveBeenCalledWith(null)
  expect(setMessage).toHaveBeenCalledWith(null)
  expect(confirm).toHaveBeenCalledWith(
    "Publish new index.html release of Test static site?",
  )
  expect(execute).not.toHaveBeenCalled()
})

it("keeps HTML first-release readback conditions without starting a service", () => {
  const execute = vi.fn(async (
    _job: () => Promise<unknown>, _success: string, _mutation?: boolean,
    _expected?: (observed: FleetSite) => boolean,
  ) => {})
  const initial = { ...site, activeRelease: null, fileCount: 0 }
  const hook = renderHook(() => useSiteReleaseImport({
    site: initial, busy: false, outcomeUnknown: false,
    html: "<h1>Initial page</h1>", editorReady: true,
    execute, setError: vi.fn(), setMessage: vi.fn(),
  }))
  act(() => { hook.result.current.publishHtml() })
  expect(execute).toHaveBeenCalledTimes(1)
  const [, message, mutation, expected] = execute.mock.calls[0]
  expect(message).toBe(
    "HTML was published as a new immutable release. Press Start if the site is stopped.",
  )
  expect(mutation).toBe(true)
  const matches = expected as (observed: FleetSite) => boolean
  expect(matches({ ...initial, activeRelease: "r-" + "c".repeat(32), fileCount: 1, bytes: 19 }))
    .toBe(true)
  expect(matches({ ...initial, activeRelease: null, fileCount: 0, bytes: 0 })).toBe(false)
  expect(matches({ ...initial, activeRelease: "r-" + "c".repeat(32), fileCount: 2, bytes: 19 }))
    .toBe(false)
  expect(matches({ ...initial, activeRelease: "r-" + "c".repeat(32), fileCount: 1, bytes: 0 }))
    .toBe(false)
})

it("does not import from a site with unverified process identity", () => {
  const execute = vi.fn(async () => {})
  const hook = renderHook(() => useSiteReleaseImport({
    site: { ...site, state: "unknown" }, busy: false, outcomeUnknown: false,
    html: "<h1>Hello</h1>", editorReady: true,
    execute, setError: vi.fn(), setMessage: vi.fn(),
  }))
  act(() => {
    hook.result.current.folder(selected([new File(["<h1>Hello</h1>"], "index.html")]))
    hook.result.current.zip(selected([new File(["zip"], "index.zip")]))
  })
  expect(execute).not.toHaveBeenCalled()
})
