import * as React from "react"
import { expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
vi.mock("@/components/layouts/base-layout", () => ({
  BaseLayout: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}))
import ProjectsPage from "@/app/projects/page"

it("keeps advanced Node actions and all source editors closed by default", async () => {
  const id = "node-" + "a".repeat(32)
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    if (url === "/api/v1/node-projects") return { ok: true, json: async () => ({ projects: [{
      id, name: "Sample app", kind: "node", state: "created", runtime: "not-provisioned",
      activeRelease: null, candidateRelease: null, previousCandidate: null,
      deploymentCount: 0, createdAt: "2026-11-09T12:00:00Z",
    }] }) }
    if (url.endsWith("/releases")) return { ok: true, json: async () => ({ releases: [] }) }
    if (url.endsWith("/runtime")) return { ok: true, json: async () => ({ runtime: {
      state: "not-provisioned", desired: "stopped", port: null,
      activeRelease: null, lastGoodRelease: null, previousGoodRelease: null, history: [],
    }, executionEnabled: false }) }
    if (url.endsWith("/plan")) return { ok: true, json: async () => ({ plan: {
      reason: "not-staged", dependencyCount: 0, missingTools: [], conflicts: [],
    }, executionEnabled: false }) }
    return { ok: false, status: 404 }
  }))
  render(<MemoryRouter><ProjectsPage /></MemoryRouter>)
  const user = (await import("@testing-library/user-event")).default.setup()
  await user.click(await screen.findByRole("button", { name: "Sample app" }))
  for (const id of ["node-advanced-setup", "node-recovery", "node-source-editors"]) {
    const section = document.querySelector<HTMLDetailsElement>(`details[data-testid="${id}"]`)
    expect(section?.open).toBe(false)
  }
  expect(screen.getByText(/Example template — not deployed/)).toBeTruthy()
})
