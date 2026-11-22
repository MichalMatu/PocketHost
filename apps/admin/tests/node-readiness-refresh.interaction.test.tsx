import * as React from "react"
import { afterEach, expect, it, vi } from "vitest"
import { act, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
import ProjectsPage from "@/app/projects/page"

vi.mock("@/components/layouts/base-layout", () => ({
  BaseLayout: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}))

afterEach(() => vi.unstubAllGlobals())

it("clears an earlier ready state while a second probe is pending and after it fails", async () => {
  const id = "node-" + "a".repeat(32)
  const release = "r-" + "b".repeat(32)
  const project = {
    id, name: "Readiness fixture", kind: "node", state: "created",
    runtime: "not-provisioned", activeRelease: null,
    candidateRelease: null, previousCandidate: null,
    deploymentCount: 0, createdAt: "2026-11-22T10:00:00Z",
  }
  let finishSecond!: (response: { ok: boolean; status: number }) => void
  const second = new Promise<{ ok: boolean; status: number }>(
    resolve => { finishSecond = resolve },
  )
  let healthReads = 0
  const requests = vi.fn(async (url: string, options?: RequestInit) => {
    if (url === "/api/v1/node-projects")
      return { ok: true, json: async () => ({ projects: [project] }) }
    if (url.endsWith("/releases"))
      return { ok: true, json: async () => ({ releases: [] }) }
    if (url.endsWith("/runtime"))
      return { ok: true, json: async () => ({ runtime: {
        state: "not-provisioned", desired: "stopped", port: null,
        activeRelease: null, lastGoodRelease: null,
        previousGoodRelease: null, history: [],
      }, executionEnabled: false }) }
    if (url.endsWith("/plan"))
      return { ok: true, json: async () => ({ plan: {
        reason: "not-staged", dependencyCount: 0,
        missingTools: [], conflicts: [],
      }, executionEnabled: false }) }
    if (url === "/api/v1/node-projects/" + id + "/health") {
      healthReads++
      if (healthReads === 2) return second
      return { ok: true, json: async () => ({ health: {
        state: "running", release, ready: true,
      } }) }
    }
    throw new Error("Unexpected request: " + url + " " + String(options?.method))
  })
  vi.stubGlobal("fetch", requests)
  const user = userEvent.setup()
  render(<MemoryRouter><ProjectsPage /></MemoryRouter>)
  await user.click(await screen.findByRole("button", { name: "Readiness fixture" }))
  await waitFor(() =>
    expect((screen.getByRole("button", { name: "Check live readiness" }) as HTMLButtonElement)
      .disabled).toBe(false))
  await user.click(screen.getByRole("button", { name: "Check live readiness" }))
  await waitFor(() =>
    expect(screen.getByLabelText("Node runtime summary").textContent)
      .toContain("HTTP readiness: ready"))
  await user.click(screen.getByRole("button", { name: "Check live readiness" }))
  await waitFor(() => expect(healthReads).toBe(2))
  expect(screen.getByLabelText("Node runtime summary").textContent)
    .toContain("HTTP readiness: not checked")
  await act(async () => { finishSecond({ ok: false, status: 503 }) })
  expect(await screen.findByText("Could not load Node projects. Try Refresh.")).toBeTruthy()
  expect(screen.getByLabelText("Node runtime summary").textContent)
    .toContain("HTTP readiness: not checked")
  expect(requests.mock.calls.every(([, options]) => options?.method !== "POST")).toBe(true)
})
