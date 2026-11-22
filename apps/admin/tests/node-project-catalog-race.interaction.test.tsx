import * as React from "react"
import { afterEach, expect, it, vi } from "vitest"
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"

vi.mock("@/components/layouts/base-layout", () => ({
  BaseLayout: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}))
import ProjectsPage from "@/app/projects/page"

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: Error) => void
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

const project = (letter: string, name: string) => ({
  id: "node-" + letter.repeat(32),
  name, kind: "node", state: "created", runtime: "not-provisioned",
  activeRelease: null, candidateRelease: null, previousCandidate: null,
  deploymentCount: 0, createdAt: "2026-11-22T10:00:00Z",
})
const response = (projects: ReturnType<typeof project>[]) => ({
  ok: true, status: 200, json: async () => ({ projects }),
})

it("ignores a late older catalog success after a newer Refresh", async () => {
  const older = deferred<ReturnType<typeof response>>()
  const newer = deferred<ReturnType<typeof response>>()
  const requests = vi.fn()
    .mockImplementationOnce(() => older.promise)
    .mockImplementationOnce(() => newer.promise)
  vi.stubGlobal("fetch", requests)

  render(<MemoryRouter><ProjectsPage /></MemoryRouter>)
  await waitFor(() => expect(requests).toHaveBeenCalledTimes(1))
  fireEvent.click(screen.getByRole("button", { name: "Refresh" }))
  await waitFor(() => expect(requests).toHaveBeenCalledTimes(2))
  await act(async () => { newer.resolve(response([project("a", "Newer project")])) })
  expect(screen.getByRole("button", { name: "Newer project" })).toBeTruthy()
  await act(async () => { older.resolve(response([project("b", "Older project")])) })
  expect(screen.getByRole("button", { name: "Newer project" })).toBeTruthy()
  expect(screen.queryByRole("button", { name: "Older project" })).toBeNull()
  expect(screen.queryByRole("alert")).toBeNull()
})

it("ignores an earlier failing catalog read after a newer valid Refresh", async () => {
  const older = deferred<ReturnType<typeof response>>()
  const newer = deferred<ReturnType<typeof response>>()
  const requests = vi.fn()
    .mockImplementationOnce(() => older.promise)
    .mockImplementationOnce(() => newer.promise)
  vi.stubGlobal("fetch", requests)

  render(<MemoryRouter><ProjectsPage /></MemoryRouter>)
  await waitFor(() => expect(requests).toHaveBeenCalledTimes(1))
  fireEvent.click(screen.getByRole("button", { name: "Refresh" }))
  await waitFor(() => expect(requests).toHaveBeenCalledTimes(2))
  await act(async () => { newer.resolve(response([project("a", "Verified project")])) })
  await act(async () => { older.reject(new Error("Old network failure")) })
  expect(screen.getByRole("button", { name: "Verified project" })).toBeTruthy()
  expect(screen.queryByRole("alert")).toBeNull()
})

it("rejects duplicate Node catalog ids before rendering ambiguous project buttons", async () => {
  const duplicate = project("a", "Same identity")
  const requests = vi.fn(async () => response([duplicate, { ...duplicate, name: "Conflicting identity" }]))
  vi.stubGlobal("fetch", requests)
  render(<MemoryRouter><ProjectsPage /></MemoryRouter>)
  expect(await screen.findByRole("alert")).toHaveTextContent("Invalid Node project registry response")
  expect(screen.queryByRole("button", { name: "Same identity" })).toBeNull()
  expect(screen.queryByRole("button", { name: "Conflicting identity" })).toBeNull()
  expect((screen.getByRole("button", { name: "Create project" }) as HTMLButtonElement).disabled).toBe(true)
  expect(requests).toHaveBeenCalledTimes(1)
})
