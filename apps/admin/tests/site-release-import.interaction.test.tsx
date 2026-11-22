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
    site, busy: false, outcomeUnknown: false, execute, setError, setMessage,
  }))
  const event = selected([new File([new Uint8Array(2 * 1024 * 1024 + 1)], "large.html")])
  act(() => { hook.result.current.folder(event) })
  expect(execute).not.toHaveBeenCalled()
  expect(setError).toHaveBeenCalledWith("Folder exceeds 100 files, 2 MiB per file or 8 MiB total.")
  expect(setMessage).toHaveBeenCalledWith(null)
  expect(event.currentTarget.value).toBe("")
})

it("cancels a replacement ZIP before any write and clears the file picker", () => {
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(false)
  const execute = vi.fn(async () => {})
  const hook = renderHook(() => useSiteReleaseImport({
    site, busy: false, outcomeUnknown: false, execute,
    setError: vi.fn(), setMessage: vi.fn(),
  }))
  const event = selected([new File(["zip data"], "updated.zip", { type: "application/zip" })])
  act(() => { hook.result.current.zip(event) })
  expect(confirm).toHaveBeenCalledWith("Publish a new release of Test static site?")
  expect(execute).not.toHaveBeenCalled()
  expect(event.currentTarget.value).toBe("")
})

it("does not import from a site with unverified process identity", () => {
  const execute = vi.fn(async () => {})
  const hook = renderHook(() => useSiteReleaseImport({
    site: { ...site, state: "unknown" }, busy: false, outcomeUnknown: false,
    execute, setError: vi.fn(), setMessage: vi.fn(),
  }))
  act(() => {
    hook.result.current.folder(selected([new File(["<h1>Hello</h1>"], "index.html")]))
    hook.result.current.zip(selected([new File(["zip"], "index.zip")]))
  })
  expect(execute).not.toHaveBeenCalled()
})
