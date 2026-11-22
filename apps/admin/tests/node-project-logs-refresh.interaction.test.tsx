import { afterEach, expect, it, vi } from "vitest"
import { act, cleanup, renderHook } from "@testing-library/react"
import { useNodeProjectLogs } from "@/app/projects/use-node-project-logs"

afterEach(() => cleanup())

const id = "node-" + "a".repeat(32)
const first = "2026-11-22_15:05:00.123456 first original line"
const second = "2026-11-22_15:05:01.000001 second original line"

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: Error) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

it("clears prior Node lines immediately on refresh and retains verbatim new lines", async () => {
  const next = deferred<Record<string, unknown>>()
  const read = vi.fn(async (_url: string): Promise<Record<string, unknown>> =>
    ({ logs: { lines: [first] } }))
  const hook = renderHook(() => useNodeProjectLogs(read))
  await act(async () => { expect(await hook.result.current.loadLogs(id)).toBe(true) })
  expect(hook.result.current.logLines).toEqual([first])
  expect(hook.result.current.logsChecked).toBe(true)

  read.mockImplementationOnce(async () => next.promise)
  let pending!: Promise<boolean>
  act(() => { pending = hook.result.current.loadLogs(id) })
  expect(hook.result.current.logsLoading).toBe(true)
  expect(hook.result.current.logsChecked).toBe(false)
  expect(hook.result.current.logLines).toEqual([])
  await act(async () => {
    next.resolve({ logs: { lines: [first, second] } })
    expect(await pending).toBe(true)
  })
  expect(hook.result.current.logsLoading).toBe(false)
  expect(hook.result.current.logLines).toEqual([first, second])
  expect(hook.result.current.logsChecked).toBe(true)
  expect(read).toHaveBeenCalledWith("/api/v1/node-projects/" + id + "/logs")
})

it.each([
  { name: "too many lines", lines: Array.from({ length: 101 }, () => first) },
  { name: "oversized line", lines: ["X".repeat(241)] },
  { name: "invalid entry", lines: [first, 123] },
])("rejects $name without displaying partial or previous Node logs", async scenario => {
  const read = vi.fn(async (_url: string): Promise<Record<string, unknown>> =>
    ({ logs: { lines: [first] } }))
  const hook = renderHook(() => useNodeProjectLogs(read))
  await act(async () => { await hook.result.current.loadLogs(id) })
  expect(hook.result.current.logLines).toEqual([first])

  read.mockImplementationOnce(async () => ({ logs: { lines: scenario.lines } }))
  await act(async () => {
    await expect(hook.result.current.loadLogs(id)).rejects.toThrow("Invalid bounded service logs")
  })
  expect(hook.result.current.logLines).toEqual([])
  expect(hook.result.current.logsLoading).toBe(false)
  expect(hook.result.current.logsChecked).toBe(false)
  expect(hook.result.current.logsError).toMatch(/logs unavailable/)
})

it("does not keep old lines when the fresh read fails", async () => {
  const next = deferred<Record<string, unknown>>()
  const read = vi.fn(async (_url: string): Promise<Record<string, unknown>> =>
    ({ logs: { lines: [first] } }))
  const hook = renderHook(() => useNodeProjectLogs(read))
  await act(async () => { await hook.result.current.loadLogs(id) })
  read.mockImplementationOnce(async () => next.promise)
  let pending!: Promise<boolean>
  act(() => { pending = hook.result.current.loadLogs(id) })
  expect(hook.result.current.logLines).toEqual([])
  await act(async () => {
    next.reject(new Error("log read failed"))
    await expect(pending).rejects.toThrow("log read failed")
  })
  expect(hook.result.current.logLines).toEqual([])
  expect(hook.result.current.logsLoading).toBe(false)
  expect(hook.result.current.logsError).toMatch(/logs unavailable/)
})

it("ignores an older late response after a newer successful read", async () => {
  const old = deferred<Record<string, unknown>>()
  const read = vi.fn(async (_url: string): Promise<Record<string, unknown>> => old.promise)
  const hook = renderHook(() => useNodeProjectLogs(read))
  let firstRead!: Promise<boolean>
  act(() => { firstRead = hook.result.current.loadLogs(id) })
  read.mockImplementationOnce(async () => ({ logs: { lines: [second] } }))
  await act(async () => { expect(await hook.result.current.loadLogs(id)).toBe(true) })
  expect(hook.result.current.logLines).toEqual([second])
  await act(async () => {
    old.resolve({ logs: { lines: [first] } })
    expect(await firstRead).toBe(false)
  })
  expect(hook.result.current.logLines).toEqual([second])
  expect(hook.result.current.logsError).toBeNull()
})
