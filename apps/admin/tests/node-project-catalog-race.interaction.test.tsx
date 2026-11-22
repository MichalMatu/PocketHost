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
  expect((await screen.findByRole("alert")).textContent).toContain("Invalid Node project registry response")
  expect(screen.queryByRole("button", { name: "Same identity" })).toBeNull()
  expect(screen.queryByRole("button", { name: "Conflicting identity" })).toBeNull()
  expect((screen.getByRole("button", { name: "Create project" }) as HTMLButtonElement).disabled).toBe(true)
  expect(requests).toHaveBeenCalledTimes(1)
})

it("invalidates the removed Node selection and refuses late runtime after a valid refresh", async () => {
  const deleted = project("a", "Project removed remotely")
  let catalog = [deleted]
  const staleRuntime = deferred<{ ok: boolean; json: () => Promise<unknown> }>()
  let runtimeCalls = 0
  const requests = vi.fn(async (url: string, options?: RequestInit) => {
    if (url === "/api/v1/node-projects") return response(catalog)
    if (url.endsWith("/releases")) return {
      ok: true, json: async () => ({ releases: [] }),
    }
    if (url.endsWith("/runtime")) {
      runtimeCalls++
      return staleRuntime.promise
    }
    if (url.endsWith("/plan")) return {
      ok: true, json: async () => ({ plan: {
        reason: "waiting", dependencyCount: 0, missingTools: [], conflicts: [],
      }, executionEnabled: false }),
    }
    throw new Error("Unexpected Node request " + url + " " + String(options?.method))
  })
  vi.stubGlobal("fetch", requests)
  render(<MemoryRouter initialEntries={["/projects?project=" + deleted.id]}>
    <ProjectsPage />
  </MemoryRouter>)
  await screen.findByRole("button", { name: "Project removed remotely" })
  await waitFor(() => expect(runtimeCalls).toBe(1))
  expect(screen.getByLabelText("Node runtime summary")).toBeTruthy()

  catalog = []
  fireEvent.click(screen.getByRole("button", { name: "Refresh" }))
  expect(await screen.findByText("No Node projects yet.")).toBeTruthy()
  expect(screen.queryByLabelText("Node runtime summary")).toBeNull()

  await act(async () => {
    staleRuntime.resolve({
      ok: true, status: 200, json: async () => ({ runtime: {
        state: "running", desired: "running", port: 19099,
        activeRelease: "r-" + "b".repeat(32),
        lastGoodRelease: "r-" + "b".repeat(32),
        previousGoodRelease: null, history: [],
      }, executionEnabled: true }),
    })
  })
  expect(screen.queryByLabelText("Node runtime summary")).toBeNull()

  catalog = [deleted]
  fireEvent.click(screen.getByRole("button", { name: "Refresh" }))
  expect(await screen.findByText(/Select a project above to inspect its runtime/)).toBeTruthy()
  expect(screen.queryByLabelText("Node runtime summary")).toBeNull()
  expect(requests.mock.calls.every(([, options]) => options?.method !== "POST")).toBe(true)
})


it("invalidates a selected Node runtime when its verified candidate changes", async () => {
  const firstRelease = "r-" + "b".repeat(32)
  const nextRelease = "r-" + "c".repeat(32)
  const selected = {
    ...project("a", "Candidate changed remotely"),
    state: "source-staged", candidateRelease: firstRelease, deploymentCount: 1,
  }
  let catalog = [selected]
  let runtimeReads = 0
  const requests = vi.fn(async (url: string, options?: RequestInit) => {
    if (url === "/api/v1/node-projects")
      return { ok: true, status: 200, json: async () => ({ projects: catalog }) }
    if (url.endsWith("/releases"))
      return { ok: true, json: async () => ({ releases: [] }) }
    if (url.endsWith("/runtime")) {
      runtimeReads++
      return { ok: true, json: async () => ({ runtime: {
        state: "running", desired: "running", port: 19232,
        activeRelease: firstRelease, lastGoodRelease: firstRelease,
        previousGoodRelease: null, history: [],
      }, executionEnabled: false }) }
    }
    if (url.endsWith("/plan"))
      return { ok: true, json: async () => ({ plan: {
        release: firstRelease, allowed: false, reason: "not-approved",
        missingTools: [], conflicts: [], dependencyCount: 0,
      }, executionEnabled: false }) }
    if (url.endsWith("/health"))
      return { ok: true, json: async () => ({ health: {
        state: "running", release: firstRelease, ready: true,
      } }) }
    throw new Error("Unexpected Node request " + url + " " + String(options?.method))
  })
  vi.stubGlobal("fetch", requests)
  render(<MemoryRouter><ProjectsPage /></MemoryRouter>)
  fireEvent.click(await screen.findByRole("button", { name: "Candidate changed remotely" }))
  await waitFor(() => expect(screen.getByLabelText("Node runtime summary").textContent)
    .toContain("running"))
  fireEvent.click(screen.getByRole("button", { name: "Check live readiness" }))
  await waitFor(() => expect(screen.getByLabelText("Node runtime summary").textContent)
    .toContain("HTTP readiness: ready"))
  expect(runtimeReads).toBe(1)

  catalog = [{ ...selected, candidateRelease: nextRelease, deploymentCount: 2 }]
  fireEvent.click(screen.getByRole("button", { name: "Refresh" }))
  await waitFor(() => expect(screen.getByLabelText("Node runtime summary").textContent)
    .toContain("unverified"))
  expect(screen.getByLabelText("Node runtime summary").textContent)
    .toContain("HTTP readiness: not checked")
  expect(screen.getByLabelText("Node runtime summary").textContent)
    .toContain(nextRelease.slice(0, 12))
  expect(runtimeReads).toBe(1)
  expect(requests.mock.calls.every(([, options]) => options?.method !== "POST")).toBe(true)
})

