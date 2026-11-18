import * as React from "react"
import { expect, it, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
vi.mock("@/components/layouts/base-layout", () => ({
  BaseLayout: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}))
import ProjectsPage from "@/app/projects/page"
import { NodeBackupPanel } from "@/app/projects/node-backup-panel"

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
  expect(await screen.findByText(/Select a project above to inspect its runtime/)).toBeTruthy()
  await user.click(await screen.findByRole("button", { name: "Sample app" }))
  expect(await screen.findByRole("link", { name: "Unlock owner access" })).toBeTruthy()
  const technical = document.querySelector<HTMLDetailsElement>('details[data-testid="node-runtime-details"]')
  expect(technical?.open).toBe(false)
  fireEvent.click(screen.getByText("Technical details"))
  expect(await screen.findByText(/Staged candidate plan:/)).toBeTruthy()
  const runtimeSection = document.getElementById("node-runtime")
  const createPanel = document.querySelector('[data-testid="node-create-panel"]')
  const backupPanel = document.querySelector('[data-testid="node-backup-panel"]')
  expect(runtimeSection && createPanel && backupPanel).toBeTruthy()
  expect(Boolean(runtimeSection!.compareDocumentPosition(createPanel!) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true)
  expect(Boolean(runtimeSection!.compareDocumentPosition(backupPanel!) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true)
  expect(screen.queryByText(/Select a project above to inspect its runtime/)).toBeNull()
  for (const id of ["node-advanced-setup", "node-recovery", "node-source-editors"]) {
    const section = document.querySelector<HTMLDetailsElement>(`details[data-testid="${id}"]`)
    expect(section?.open).toBe(false)
  }
  expect(screen.getByText(/Example template — not deployed/)).toBeTruthy()
})

it("invalidates inspected Node backup permissions when the catalog becomes unavailable", async () => {
  const getJson = vi.fn(async () => ({
    backup: { initialized: true, repositoryPresent: true, keyPresent: true },
    backupsEnabled: true,
  }))
  const action = (fn: () => Promise<void>) => { void fn() }
  const props = { ownerAuthorized: true, busy: false, getJson, action, onMessage: vi.fn() }
  const view = render(<NodeBackupPanel {...props} catalogReady />)
  fireEvent.click(screen.getByText("Scoped Node project backups"))
  fireEvent.click(screen.getByRole("button", { name: "Inspect Node backups" }))
  await screen.findByText(/Restic: ready\. Mutations: owner-gated\./)
  fireEvent.click(screen.getByLabelText("Approve Node Restic operation"))
  expect((screen.getByRole("button", { name: "Create Node backup" }) as HTMLButtonElement).disabled).toBe(false)
  view.rerender(<NodeBackupPanel {...props} catalogReady={false} />)
  expect((screen.getByRole("button", { name: "Inspect Node backups" }) as HTMLButtonElement).disabled).toBe(true)
  expect(screen.queryByLabelText("Node backup state")).toBeNull()
  expect(screen.queryByRole("button", { name: "Create Node backup" })).toBeNull()
  expect(getJson).toHaveBeenCalledTimes(1)
})
