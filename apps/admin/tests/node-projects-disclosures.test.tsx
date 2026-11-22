import * as React from "react"
import { expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter, useNavigate } from "react-router-dom"
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
  const source = document.querySelector<HTMLDetailsElement>('details[data-testid="node-source-panel"]')
  expect(source?.open).toBe(false)
  expect(screen.getByText(/Example — not deployed/)).toBeTruthy()
  for (const id of ["node-advanced-setup", "node-recovery", "node-source-editors"]) {
    const section = document.querySelector<HTMLDetailsElement>(`details[data-testid="${id}"]`)
    expect(section?.open).toBe(false)
  }
  fireEvent.click(source!.querySelector("summary")!)
  expect(source?.open).toBe(true)
})

it("ignores stale Node releases and runtime after switching deep-linked projects", async () => {
  const first = "node-" + "a".repeat(32)
  const second = "node-" + "c".repeat(32)
  const firstRelease = "r-" + "b".repeat(32)
  const secondRelease = "r-" + "d".repeat(32)
  const projects = [first, second].map((id, index) => ({
    id, name: index === 0 ? "First app" : "Second app",
    kind: "node", state: "source-staged", runtime: "not-provisioned",
    activeRelease: null, candidateRelease: index === 0 ? firstRelease : secondRelease,
    previousCandidate: null, deploymentCount: 1, createdAt: "2026-11-09T12:00:00Z",
  }))
  let finishFirstReleases: ((response: unknown) => void) | undefined
  let finishFirstRuntime: ((response: unknown) => void) | undefined
  const requests = vi.fn(async (url: string, options?: RequestInit) => {
    if (url === "/api/v1/node-projects")
      return { ok: true, json: async () => ({ projects }) }
    if (url === "/api/v1/node-projects/" + first + "/releases")
      return new Promise(resolve => { finishFirstReleases = resolve })
    if (url === "/api/v1/node-projects/" + first + "/runtime")
      return new Promise(resolve => { finishFirstRuntime = resolve })
    if (url.endsWith("/releases"))
      return { ok: true, json: async () => ({ releases: [{
        id: secondRelease, active: false, candidate: true, previousCandidate: false,
        sourceIntegrity: "verified",
        dependencyPlan: { packageName: "second", packageVersion: "1.0.0",
          dependencyCount: 0, status: "review-required" },
      }] }) }
    if (url.endsWith("/runtime"))
      return { ok: true, json: async () => ({ runtime: {
        state: "stopped", desired: "stopped", port: null, activeRelease: secondRelease,
        lastGoodRelease: secondRelease, previousGoodRelease: null, history: [],
      }, executionEnabled: false }) }
    if (url.endsWith("/plan"))
      return { ok: true, json: async () => ({ plan: {
        release: secondRelease, port: null, missingTools: [], conflicts: [],
        dependencyCount: 0, allowed: false, reason: "second-current",
      }, executionEnabled: false }) }
    throw new Error("Unexpected endpoint " + url)
  })
  vi.stubGlobal("fetch", requests)
  const NavigateToSecond = () => {
    const navigate = useNavigate()
    return <button onClick={() => navigate("/projects?project=" + second)}>Choose second link</button>
  }
  render(<MemoryRouter initialEntries={["/projects?project=" + first]}>
    <NavigateToSecond /><ProjectsPage />
  </MemoryRouter>)
  expect(await screen.findByRole("button", { name: "First app" })).toBeTruthy()
  await waitFor(() => expect(finishFirstReleases).toBeTypeOf("function"))
  await waitFor(() => expect(finishFirstRuntime).toBeTypeOf("function"))
  fireEvent.click(screen.getByRole("button", { name: "Choose second link" }))
  fireEvent.click(screen.getByText("Technical details"))
  expect(await screen.findByText(/Staged candidate plan: second-current/)).toBeTruthy()
  const outdatedRelease = {
    id: firstRelease, active: false, candidate: true, previousCandidate: false,
    sourceIntegrity: "verified", dependencyPlan: {
      packageName: "first", packageVersion: "1.0.0",
      dependencyCount: 0, status: "review-required",
    },
  }
  finishFirstReleases?.({ ok: true, json: async () => ({ releases: [outdatedRelease] }) })
  finishFirstRuntime?.({ ok: true, json: async () => ({ runtime: {
    state: "running", desired: "running", port: 19777, activeRelease: firstRelease,
    lastGoodRelease: firstRelease, previousGoodRelease: null, history: [],
  }, executionEnabled: false }) })
  await waitFor(() => expect(screen.getByLabelText("Node runtime summary").textContent)
    .toContain("stopped"))
  expect(screen.getByLabelText("Node runtime summary").textContent).not.toContain("running")
  expect(screen.queryByText("first@1.0.0")).toBeNull()
  expect(screen.getByText(/second@1.0.0/)).toBeTruthy()
  expect(requests.mock.calls.every(([, options]) => options?.method !== "POST")).toBe(true)
})

it("does not display stale Node log lines after a deep-link project switch", async () => {
  const first = "node-" + "a".repeat(32)
  const second = "node-" + "c".repeat(32)
  const projects = [first, second].map((id, index) => ({
    id, name: index === 0 ? "First logs app" : "Second logs app",
    kind: "node", state: "created", runtime: "not-provisioned",
    activeRelease: null, candidateRelease: null, previousCandidate: null,
    deploymentCount: 0, createdAt: "2026-11-09T12:00:00Z",
  }))
  let finishFirst: ((response: unknown) => void) | undefined
  const fetcher = vi.fn(async (url: string, options?: RequestInit) => {
    if (url === "/api/v1/node-projects")
      return { ok: true, json: async () => ({ projects }) }
    if (url.endsWith("/releases"))
      return { ok: true, json: async () => ({ releases: [] }) }
    if (url.endsWith("/runtime"))
      return { ok: true, json: async () => ({ runtime: {
        state: "not-provisioned", desired: "stopped", port: null,
        activeRelease: null, lastGoodRelease: null, previousGoodRelease: null, history: [],
      }, executionEnabled: false }) }
    if (url.endsWith("/plan"))
      return { ok: true, json: async () => ({ plan: {
        reason: url.includes(second) ? "second-current" : "first-current",
        dependencyCount: 0, missingTools: [], conflicts: [],
      }, executionEnabled: false }) }
    if (url === "/api/v1/node-projects/" + first + "/logs")
      return new Promise(resolve => { finishFirst = resolve })
    if (url === "/api/v1/node-projects/" + second + "/logs")
      return { ok: true, json: async () => ({ logs: {
        lines: ["2026-11-22_05:01:00.000000 original second log"],
      } }) }
    throw new Error("Unexpected endpoint " + url + " " + String(options?.method))
  })
  vi.stubGlobal("fetch", fetcher)
  const Jump = () => {
    const navigate = useNavigate()
    return <button onClick={() => navigate("/projects?project=" + second)}>Choose second logs app</button>
  }
  render(<MemoryRouter initialEntries={["/projects?project=" + first]}>
    <Jump /><ProjectsPage />
  </MemoryRouter>)
  await screen.findByRole("button", { name: "View logs" })
  fireEvent.click(screen.getByRole("button", { name: "View logs" }))
  await waitFor(() => expect(finishFirst).toBeTypeOf("function"))
  expect(screen.getByText("Reading Node logs for selected project…")).toBeTruthy()
  fireEvent.click(screen.getByRole("button", { name: "Choose second logs app" }))
  fireEvent.click(screen.getByText("Technical details"))
  expect(await screen.findByText(/Staged candidate plan: second-current/)).toBeTruthy()
  finishFirst?.({ ok: true, json: async () => ({ logs: {
    lines: ["2026-11-22_05:00:00.000000 original first log"],
  } }) })
  await waitFor(() => expect((screen.getByRole("button", { name: "View logs" }) as HTMLButtonElement)
    .disabled).toBe(false))
  expect(screen.queryByLabelText("Node runit logs")).toBeNull()
  fireEvent.click(screen.getByRole("button", { name: "View logs" }))
  expect(await screen.findByText(/original second log/)).toBeTruthy()
  expect(screen.queryByText(/original first log/)).toBeNull()
  expect(fetcher.mock.calls.every(([, options]) => options?.method !== "POST")).toBe(true)
})

it("distinguishes an empty Node release list from a failed read and retries safely", async () => {
  const id = "node-" + "a".repeat(32)
  let releaseReads = 0
  const fetcher = vi.fn(async (url: string, options?: RequestInit) => {
    if (url === "/api/v1/node-projects")
      return { ok: true, json: async () => ({ projects: [{
        id, name: "Empty releases app", kind: "node", state: "created",
        runtime: "not-provisioned", activeRelease: null, candidateRelease: null,
        previousCandidate: null, deploymentCount: 0, createdAt: "2026-11-09T12:00:00Z",
      }] }) }
    if (url.endsWith("/releases")) {
      releaseReads++
      if (releaseReads === 1) return { ok: false, status: 503 }
      return { ok: true, json: async () => ({ releases: [] }) }
    }
    if (url.endsWith("/runtime"))
      return { ok: true, json: async () => ({ runtime: {
        state: "not-provisioned", desired: "stopped", port: null,
        activeRelease: null, lastGoodRelease: null, previousGoodRelease: null, history: [],
      }, executionEnabled: false }) }
    if (url.endsWith("/plan"))
      return { ok: true, json: async () => ({ plan: {
        reason: "not-staged", dependencyCount: 0, missingTools: [], conflicts: [],
      }, executionEnabled: false }) }
    throw new Error("Unexpected endpoint " + url + " " + String(options?.method))
  })
  vi.stubGlobal("fetch", fetcher)
  render(<MemoryRouter><ProjectsPage /></MemoryRouter>)
  fireEvent.click(await screen.findByRole("button", { name: "Empty releases app" }))
  expect(await screen.findByText("Could not read source releases for this project.")).toBeTruthy()
  expect(screen.queryByText(/No source releases yet/)).toBeNull()
  fireEvent.click(screen.getByRole("button", { name: "Retry releases" }))
  expect(await screen.findByText(/No source releases yet/)).toBeTruthy()
  expect(screen.queryByText("Could not read source releases for this project.")).toBeNull()
  expect(releaseReads).toBe(2)
  expect(fetcher.mock.calls.every(([, options]) => options?.method !== "POST")).toBe(true)
})

it("refreshes a previously empty Node release list with GET only", async () => {
  const id = "node-" + "a".repeat(32)
  const release = "r-" + "b".repeat(32)
  let reads = 0
  const fetcher = vi.fn(async (url: string, options?: RequestInit) => {
    if (url === "/api/v1/node-projects")
      return { ok: true, json: async () => ({ projects: [{
        id, name: "Refreshed app", kind: "node", state: "source-staged",
        runtime: "not-provisioned", activeRelease: null, candidateRelease: release,
        previousCandidate: null, deploymentCount: 1, createdAt: "2026-11-09T12:00:00Z",
      }] }) }
    if (url.endsWith("/releases")) {
      reads++
      return { ok: true, json: async () => ({ releases: reads === 1 ? [] : [{
        id: release, active: false, candidate: true, previousCandidate: false,
        sourceIntegrity: "verified", dependencyPlan: {
          packageName: "refreshed-node", packageVersion: "1.0.0",
          dependencyCount: 0, status: "review-required",
        },
      }] }) }
    }
    if (url.endsWith("/runtime"))
      return { ok: true, json: async () => ({ runtime: {
        state: "not-provisioned", desired: "stopped", port: null,
        activeRelease: null, lastGoodRelease: null, previousGoodRelease: null, history: [],
      }, executionEnabled: false }) }
    if (url.endsWith("/plan"))
      return { ok: true, json: async () => ({ plan: {
        reason: "not-staged", dependencyCount: 0, missingTools: [], conflicts: [],
      }, executionEnabled: false }) }
    throw new Error("Unexpected endpoint " + url + " " + String(options?.method))
  })
  vi.stubGlobal("fetch", fetcher)
  render(<MemoryRouter><ProjectsPage /></MemoryRouter>)
  fireEvent.click(await screen.findByRole("button", { name: "Refreshed app" }))
  expect(await screen.findByText(/No source releases yet/)).toBeTruthy()
  fireEvent.click(screen.getByRole("button", { name: "Refresh releases" }))
  expect(await screen.findByText("Prepared update — not running")).toBeTruthy()
  expect(screen.queryByText(/No source releases yet/)).toBeNull()
  expect(reads).toBe(2)
  expect(fetcher.mock.calls.every(([, options]) => options?.method !== "POST")).toBe(true)
})

it("ignores a late Node readiness result after switching the selected project", async () => {
  const first = "node-" + "a".repeat(32)
  const second = "node-" + "c".repeat(32)
  const release = "r-" + "b".repeat(32)
  const projects = [first, second].map((id, index) => ({
    id, name: index ? "Second probe app" : "First probe app",
    kind: "node", state: "created", runtime: "not-provisioned",
    activeRelease: null, candidateRelease: null, previousCandidate: null,
    deploymentCount: 0, createdAt: "2026-11-09T12:00:00Z",
  }))
  let finishFirst: ((response: unknown) => void) | undefined
  const requests = vi.fn(async (url: string, options?: RequestInit) => {
    if (url === "/api/v1/node-projects")
      return { ok: true, json: async () => ({ projects }) }
    if (url.endsWith("/releases"))
      return { ok: true, json: async () => ({ releases: [] }) }
    if (url.endsWith("/runtime"))
      return { ok: true, json: async () => ({ runtime: {
        state: "not-provisioned", desired: "stopped", port: null,
        activeRelease: null, lastGoodRelease: null, previousGoodRelease: null, history: [],
      }, executionEnabled: false }) }
    if (url.endsWith("/plan"))
      return { ok: true, json: async () => ({ plan: {
        reason: url.includes(second) ? "second-current" : "first-current",
        dependencyCount: 0, missingTools: [], conflicts: [],
      }, executionEnabled: false }) }
    if (url === "/api/v1/node-projects/" + first + "/health")
      return new Promise(resolve => { finishFirst = resolve })
    if (url === "/api/v1/node-projects/" + second + "/health")
      return { ok: true, json: async () => ({ health: {
        state: "not-provisioned", release: null, ready: null,
      } }) }
    throw new Error("Unexpected endpoint " + url + " " + String(options?.method))
  })
  vi.stubGlobal("fetch", requests)
  const Jump = () => {
    const navigate = useNavigate()
    return <button onClick={() => navigate("/projects?project=" + second)}>Choose second probe</button>
  }
  render(<MemoryRouter initialEntries={["/projects?project=" + first]}>
    <Jump /><ProjectsPage />
  </MemoryRouter>)
  await screen.findByRole("button", { name: "Check live readiness" })
  fireEvent.click(screen.getByRole("button", { name: "Check live readiness" }))
  await waitFor(() => expect(finishFirst).toBeTypeOf("function"))
  fireEvent.click(screen.getByRole("button", { name: "Choose second probe" }))
  fireEvent.click(screen.getByText("Technical details"))
  expect(await screen.findByText(/Staged candidate plan: second-current/)).toBeTruthy()
  finishFirst?.({ ok: true, json: async () => ({ health: {
    state: "running", release, ready: true,
  } }) })
  await waitFor(() => expect((screen.getByRole("button", { name: "Check live readiness" }) as HTMLButtonElement)
    .disabled).toBe(false))
  expect(screen.getByLabelText("Node runtime summary").textContent).toContain("not checked")
  fireEvent.click(screen.getByRole("button", { name: "Check live readiness" }))
  await waitFor(() => expect(screen.getByLabelText("Node runtime summary").textContent)
    .toContain("not probed"))
  expect(requests.mock.calls.every(([, options]) => options?.method !== "POST")).toBe(true)
})

it("fails closed on a lost owned registry after selecting a Node project", async () => {
  const id = "node-" + "a".repeat(32)
  let catalogUnavailable = false
  const requests = vi.fn(async (url: string, options?: RequestInit) => {
    if (url === "/api/v1/node-projects") {
      if (catalogUnavailable) return { ok: false, status: 503 }
      return { ok: true, json: async () => ({ projects: [{
        id, name: "Owned app", kind: "node", state: "created", runtime: "not-provisioned",
        activeRelease: null, candidateRelease: null, previousCandidate: null,
        deploymentCount: 0, createdAt: "2026-11-09T12:00:00Z",
      }] }) }
    }
    if (url.endsWith("/releases")) return { ok: true, json: async () => ({ releases: [] }) }
    if (url.endsWith("/runtime")) return { ok: true, json: async () => ({
      runtime: { state: "not-provisioned", desired: "stopped", port: null,
        activeRelease: null, lastGoodRelease: null, previousGoodRelease: null, history: [] },
      executionEnabled: false,
    }) }
    if (url.endsWith("/plan")) return { ok: true, json: async () => ({
      plan: { reason: "not-staged", dependencyCount: 0, missingTools: [], conflicts: [] },
      executionEnabled: false,
    }) }
    throw new Error("Unexpected endpoint " + url + " " + String(options?.method))
  })
  vi.stubGlobal("fetch", requests)
  render(<MemoryRouter><ProjectsPage /></MemoryRouter>)
  const user = (await import("@testing-library/user-event")).default.setup()
  await user.click(await screen.findByRole("button", { name: "Owned app" }))
  expect(await screen.findByRole("link", { name: "Unlock owner access" })).toBeTruthy()
  catalogUnavailable = true
  await user.click(screen.getByRole("button", { name: "Refresh" }))
  expect((await screen.findByRole("alert")).textContent).toBe("Could not load Node projects. Try Refresh.")
  expect(screen.queryByRole("button", { name: "Owned app" })).toBeNull()
  expect(screen.queryByRole("button", { name: "Publish update" })).toBeNull()
  expect(requests.mock.calls.every(([, opts]) => opts?.method !== "POST")).toBe(true)
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
