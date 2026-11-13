import * as React from "react"
import { afterEach, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
vi.mock("@/components/layouts/base-layout", () => ({
  BaseLayout: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}))
import ProjectsPage from "@/app/projects/page"
const ID = "node-" + "a".repeat(32)
const RELEASE = "r-" + "b".repeat(32)
afterEach(() => vi.unstubAllGlobals())

it("keeps a disabled Node API distinct from an empty project list", async () => {
  const requests = vi.fn(async () => ({ ok: false, status: 404 }))
  vi.stubGlobal("fetch", requests)
  render(<ProjectsPage />)
  await screen.findByText("Node Hosting is not enabled on this panel.")
  expect(screen.queryByRole("alert")).toBeNull()
  expect(screen.queryByText("No Node projects yet.")).toBeNull()
  expect((screen.getByRole("button", { name: "Create project" }) as HTMLButtonElement).disabled).toBe(true)
  expect((screen.getByRole("button", { name: "Inspect hosting registries" }) as HTMLButtonElement).disabled).toBe(true)
  expect((screen.getByRole("button", { name: "Inspect Node backups" }) as HTMLButtonElement).disabled).toBe(true)
  expect(requests.mock.calls).toHaveLength(1)
})

it.each([
  [403, "Node Hosting access denied."],
  [503, "Could not load Node projects. Try Refresh."],
])("displays API error %i without claiming that Node projects are empty", async (status, message) => {
  const requests = vi.fn(async () => ({ ok: false, status }))
  vi.stubGlobal("fetch", requests)
  render(<ProjectsPage />)
  expect((await screen.findByRole("alert")).textContent).toBe(message)
  expect(screen.queryByText("No Node projects yet.")).toBeNull()
  expect((screen.getByRole("button", { name: "Create project" }) as HTMLButtonElement).disabled).toBe(true)
  expect(requests.mock.calls).toHaveLength(1)
})

it("rejects invalid Node project inventory without hiding an error as an empty catalog", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => ({
    ok: true, status: 200, json: async () => ({ projects: [{ id: "foreign" }] }),
  })))
  render(<ProjectsPage />)
  await screen.findByText("Invalid Node project registry response")
  expect(screen.queryByText("No Node projects yet.")).toBeNull()
  expect((screen.getByRole("button", { name: "Create project" }) as HTMLButtonElement).disabled).toBe(true)
})
it("M3 browser creates and stages a real API-backed Node source candidate without running it", async () => {
  const user = userEvent.setup()
  let projects: unknown[] = []
  let releases: unknown[] = []
  const calls = vi.fn(async (url: RequestInfo | URL, options?: RequestInit) => {
    const path = String(url)
    if (path === "/api/v1/node-projects" && !options?.method)
      return { ok: true, json: async () => ({ projects }) }
    if (path === "/api/v1/node-projects/" && options?.method === "POST") {
      expect((options.headers as Record<string, string>)["X-PocketHost-Intent"]).toBe("owned-node-project")
      const project = { id: ID, name: "My node", kind: "node", state: "created",
        runtime: "not-provisioned", activeRelease: null, candidateRelease: null,
        previousCandidate: null, deploymentCount: 0, createdAt: "2026-11-09T12:00:00Z" }
      projects = [project]
      return { ok: true, json: async () => ({ project }) }
    }
    if (path === "/api/v1/node-projects/" + ID + "/stage" && options?.method === "POST") {
      const envelope = JSON.parse(String(options.body))
      expect(envelope.expectedCandidate).toBeNull()
      expect(envelope.expectedRevision).toBe(0)
      expect(envelope.packageJson.scripts.start).toBe("node server.mjs")
      expect(envelope.packageJson.name).toBe("imported-node")
      expect(envelope.serverSource).toBe("console.log('uploaded Node')")
      const project = { ...(projects[0] as Record<string, unknown>), state: "source-staged",
        candidateRelease: RELEASE, deploymentCount: 1 }
      projects = [project]
      releases = [{ id: RELEASE, active: false, candidate: true, previousCandidate: false,
        dependencyPlan: { packageName: "my-node-site", packageVersion: "1.0.0", dependencyCount: 0, status: "review-required" } }]
      return { ok: true, json: async () => ({ project }) }
    }
    if (path === "/api/v1/node-projects/toolchain" && !options?.method)
      return { ok: true, json: async () => ({ toolchain: {
        nodeVersion: "v26.13.0", npmVersion: "11.6.2",
      } }) }
    if (path === "/api/v1/node-projects/backup" && !options?.method)
      return { ok: true, json: async () => ({ backup: {
        initialized: false, repositoryPresent: false, keyPresent: false,
      } }) }
    if (path === "/api/v1/node-projects/registry" && !options?.method)
      return { ok: true, json: async () => ({ registries: {
        schemaVersion: 1,
        modules: [{ id: "nodejs" }],
        services: [],
        projects: [{ id: ID }],
      } }) }
    if (path === "/api/v1/node-projects/" + ID + "/source" && !options?.method)
      return { ok: true, json: async () => ({ source: {
        release: RELEASE,
        manifest: JSON.stringify({ name: "restored-node", version: "2.0.0", scripts: { start: "node server.mjs" } }),
        lockfile: JSON.stringify({ name: "restored-node", version: "2.0.0", lockfileVersion: 3,
          packages: { "": { name: "restored-node", version: "2.0.0" } } }),
        serverSource: "console.log('verified release')",
      } }) }
    if (path === "/api/v1/node-projects/" + ID + "/health" && !options?.method)
      return { ok: true, json: async () => ({ health: {
        state: "not-provisioned", release: null, ready: null,
      } }) }
    if (path === "/api/v1/node-projects/" + ID + "/check-build" && options?.method === "POST")
      return { ok: true, json: async () => ({ buildCheck: {
        release: RELEASE, status: "syntax-valid", executed: false,
      } }) }
    if (path === "/api/v1/node-projects/" + ID + "/runtime" && !options?.method)
      return { ok: true, json: async () => ({ runtime: {
        state: "not-provisioned", port: null, desired: "stopped", activeRelease: null,
        lastGoodRelease: null, previousGoodRelease: null, history: [] }, executionEnabled: false }) }
    if (path === "/api/v1/node-projects/" + ID + "/plan" && !options?.method)
      return { ok: true, json: async () => ({ plan: {
        release: RELEASE, port: null, missingTools: [], conflicts: [],
        dependencyCount: 0, allowed: true, reason: "ready-for-explicit-local-deploy"
      }, executionEnabled: false }) }
    if (path === "/api/v1/node-projects/" + ID + "/releases" && !options?.method)
      return { ok: true, json: async () => ({ releases }) }
    return { ok: false, status: 404 }
  })
  vi.stubGlobal("fetch", calls)
  render(<ProjectsPage />)
  await screen.findByText("No Node projects yet.")
  await user.click(screen.getByRole("button", { name: "Check Node tools" }))
  await screen.findByText("Installed tools: Node v26.13.0 · npm 11.6.2")
  await user.type(screen.getByLabelText("Project name"), "My node")
  await user.click(screen.getByRole("button", { name: "Create project" }))
  await screen.findByText("Private Node project created.")
  const previousManifest = (screen.getByLabelText("package.json") as HTMLTextAreaElement).value
  await user.upload(screen.getByLabelText("Load local Node files"), [
    new File(["{}"], "package.json"),
    new File(["{}"], "package-lock.json"),
  ])
  await screen.findByText("Select exactly package.json, package-lock.json and server.mjs.")
  expect((screen.getByLabelText("package.json") as HTMLTextAreaElement).value).toBe(previousManifest)
  expect(calls.mock.calls.filter(call => String(call[0]).endsWith("/stage"))).toHaveLength(0)
  const importedPackage = {
    name: "imported-node", version: "1.2.3", scripts: { start: "node server.mjs" },
  }
  const importedLock = {
    name: "imported-node", version: "1.2.3", lockfileVersion: 3,
    packages: { "": { name: "imported-node", version: "1.2.3" } },
  }
  await user.upload(screen.getByLabelText("Load local Node files"), [
    new File([JSON.stringify(importedPackage)], "package.json"),
    new File([JSON.stringify(importedLock)], "package-lock.json"),
    new File(["console.log('uploaded Node')"], "server.mjs"),
  ])
  await screen.findByText("Three Node files loaded into the editor. Validate and stage to save a candidate.")
  expect((screen.getByLabelText("package.json") as HTMLTextAreaElement).value).toContain("imported-node")
  expect((screen.getByLabelText("server.mjs") as HTMLTextAreaElement).value).toBe("console.log('uploaded Node')")
  expect(calls.mock.calls.filter(call => String(call[0]).endsWith("/stage"))).toHaveLength(0)
  await user.click(screen.getByRole("button", { name: "Validate and stage source" }))
  await screen.findByText("Source candidate staged. Review the execution plan before deploying.")
  await user.click(screen.getByRole("button", { name: "Load staged source" }))
  await screen.findByText("Verified staged source loaded into editor; no process changed.")
  expect((screen.getByLabelText("package.json") as HTMLTextAreaElement).value).toContain('restored-node')
  expect((screen.getByLabelText("server.mjs") as HTMLTextAreaElement).value).toContain('verified release')
  expect(screen.getByText(/Runtime: not-provisioned/)).toBeTruthy()
  await user.click(screen.getByRole("button", { name: "Inspect hosting registries" }))
  await screen.findByText(/Modules: 1 · Services: 0 · Projects: 1/)
  await user.click(screen.getByRole("button", { name: "Inspect Node backups" }))
  await screen.findByText(/Scoped Node Restic: not initialized/)
  expect(screen.getByRole("button", { name: "Create Node backup" }).hasAttribute("disabled")).toBe(true)
  expect(screen.getByRole("button", { name: "Restore Node snapshot to staging" }).hasAttribute("disabled")).toBe(true)

  expect(screen.getByRole("button", { name: "Deploy selected release" }).hasAttribute("disabled")).toBe(true)
  await user.click(screen.getByRole("button", { name: "Check live readiness" }))
  await screen.findByText(/Live health: not-provisioned · HTTP readiness: not probed/)
  await user.click(screen.getByRole("button", { name: "Check Node build syntax" }))
  await screen.findByText(/Candidate syntax: syntax-valid/)
  expect(screen.getByRole("button", { name: "Rollback active release" }).hasAttribute("disabled")).toBe(true)
  expect(screen.getByRole("button", { name: "Preview local response" }).hasAttribute("disabled")).toBe(true)
  expect(calls.mock.calls.some(call => String(call[0]).includes("/start"))).toBe(false)
})

it("treats a malformed installed-tool report as an error without claiming versions", async () => {
  const requests = vi.fn(async (url: RequestInfo | URL) => {
    if (String(url) === "/api/v1/node-projects")
      return { ok: true, status: 200, json: async () => ({ projects: [] }) }
    if (String(url) === "/api/v1/node-projects/toolchain")
      return { ok: true, status: 200, json: async () => ({
        toolchain: { nodeVersion: "not a version", npmVersion: null },
      }) }
    throw new Error("Unexpected endpoint " + String(url))
  })
  vi.stubGlobal("fetch", requests)
  render(<ProjectsPage />)
  await screen.findByText("No Node projects yet.")
  const user = userEvent.setup()
  await user.click(screen.getByRole("button", { name: "Check Node tools" }))
  await screen.findByText("Invalid Node toolchain report")
  expect(screen.queryByText(/Installed tools:/)).toBeNull()
  expect(requests.mock.calls.every(([url]) => String(url).startsWith("/api/v1/node-projects"))).toBe(true)
})

it("starts and restarts only an explicitly approved, verified Node release", async () => {
  const user = userEvent.setup()
  let running = false
  const project = {
    id: ID, name: "Resume Node", kind: "node", state: "source-staged",
    runtime: "not-provisioned", activeRelease: null, candidateRelease: RELEASE,
    previousCandidate: null, deploymentCount: 1, createdAt: "2026-11-09T12:00:00Z",
  }
  const calls = vi.fn(async (input: RequestInfo | URL, options?: RequestInit) => {
    const url = String(input)
    if (url === "/api/v1/node-projects" && !options?.method)
      return { ok: true, json: async () => ({ projects: [project] }) }
    if (url === "/api/v1/node-projects/" + ID + "/releases" && !options?.method)
      return { ok: true, json: async () => ({ releases: [] }) }
    if (url === "/api/v1/node-projects/" + ID + "/runtime" && !options?.method)
      return { ok: true, json: async () => ({
        runtime: {
          state: running ? "running" : "stopped", port: 19301,
          desired: running ? "running" : "stopped",
          activeRelease: RELEASE, lastGoodRelease: RELEASE,
          previousGoodRelease: null, history: [],
        },
        executionEnabled: true,
      }) }
    if (url === "/api/v1/node-projects/" + ID + "/plan" && !options?.method)
      return { ok: true, json: async () => ({
        plan: {
          release: RELEASE, port: 19301, missingTools: [], conflicts: [],
          dependencyCount: 0, allowed: true, reason: "ready-for-explicit-local-deploy",
        },
        executionEnabled: true,
      }) }
    if (url === "/api/v1/node-projects/" + ID + "/health")
      return { ok: true, json: async () => ({ health: {
        state: "running", release: RELEASE, ready: true,
      } }) }
    if ((url === "/api/v1/node-projects/" + ID + "/start" ||
         url === "/api/v1/node-projects/" + ID + "/restart") && options?.method === "POST") {
      expect((options.headers as Record<string, string>)["X-PocketHost-Intent"]).toBe("owned-node-project")
      expect(JSON.parse(String(options.body))).toEqual({ approved: true })
      running = true
      return { ok: true, json: async () => ({ runtime: { state: "running", activeRelease: RELEASE } }) }
    }
    throw new Error("Unexpected request " + url)
  })
  vi.stubGlobal("fetch", calls)
  render(<ProjectsPage />)
  await screen.findByRole("button", { name: "Resume Node" })
  await user.click(screen.getByRole("button", { name: "Resume Node" }))
  await screen.findByText(/Runtime: stopped/)
  const start = screen.getByRole("button", { name: "Start stopped service" }) as HTMLButtonElement
  expect(start.disabled).toBe(true)
  await user.click(screen.getByLabelText("Approve local Node execution"))
  expect(start.disabled).toBe(false)
  await user.click(start)
  await screen.findByText("Previously verified Node release started and readiness confirmed.")
  expect((screen.getByRole("button", { name: "Start stopped service" }) as HTMLButtonElement).disabled).toBe(true)
  const restart = screen.getByRole("button", { name: "Restart service" }) as HTMLButtonElement
  expect(restart.disabled).toBe(true)
  await user.click(screen.getByLabelText("Approve local Node execution"))
  expect(restart.disabled).toBe(false)
  await user.click(restart)
  await screen.findByText("Owned Node service restarted and readiness verified.")
  expect(restart.disabled).toBe(true)
  expect(calls.mock.calls.filter(([url]) => String(url).endsWith("/start"))).toHaveLength(1)
  expect(calls.mock.calls.filter(([url]) => String(url).endsWith("/restart"))).toHaveLength(1)
  expect(calls.mock.calls.filter(([url]) => String(url).endsWith("/deploy"))).toHaveLength(0)
})

it.each(["refresh-failed", "mutation-unconfirmed"] as const)(
  "disables repeat Node actions when %s",
  async (scenario) => {
    const user = userEvent.setup()
    let submitted = false
    const project = {
      id: ID, name: "Safe Node", kind: "node", state: "source-staged",
      runtime: "not-provisioned", activeRelease: null, candidateRelease: RELEASE,
      previousCandidate: null, deploymentCount: 1, createdAt: "2026-11-09T12:00:00Z",
    }
    const calls = vi.fn(async (input: RequestInfo | URL, options?: RequestInit) => {
      const url = String(input)
      if (url === "/api/v1/node-projects")
        return { ok: true, json: async () => ({ projects: [project] }) }
      if (url === "/api/v1/node-projects/" + ID + "/releases")
        return { ok: true, json: async () => ({ releases: [] }) }
      if (url.endsWith("/runtime") && !options?.method) {
        if (submitted && scenario === "refresh-failed") return { ok: false, status: 503 }
        return { ok: true, json: async () => ({
          runtime: {
            state: "running", port: 19301, desired: "running",
            activeRelease: RELEASE, lastGoodRelease: RELEASE,
            previousGoodRelease: null, history: [],
          }, executionEnabled: true,
        }) }
      }
      if (url.endsWith("/plan") && !options?.method)
        return { ok: true, json: async () => ({
          plan: { release: RELEASE, port: 19301, missingTools: [],
            conflicts: [], dependencyCount: 0, allowed: true,
            reason: "ready-for-explicit-local-deploy" },
          executionEnabled: true,
        }) }
      if (url.endsWith("/restart") && options?.method === "POST") {
        submitted = true
        if (scenario === "mutation-unconfirmed") throw new Error("connection lost")
        return { ok: true, json: async () => ({ runtime: { state: "running", activeRelease: RELEASE } }) }
      }
      throw new Error("Unexpected request " + url)
    })
    vi.stubGlobal("fetch", calls)
    render(<ProjectsPage />)
    await screen.findByRole("button", { name: "Safe Node" })
    await user.click(screen.getByRole("button", { name: "Safe Node" }))
    await screen.findByText(/Runtime: running/)
    await user.click(screen.getByLabelText("Approve local Node execution"))
    await user.click(screen.getByRole("button", { name: "Restart service" }))
    await screen.findByText(scenario === "refresh-failed"
      ? "Node action acknowledged, but runtime refresh failed. Review plan before retrying."
      : "Node action result unconfirmed. Refresh runtime status before retrying.")
    expect((screen.getByRole("button", { name: "Restart service" }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole("button", { name: "Stop owned service" }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByLabelText("Approve local Node execution") as HTMLInputElement).checked).toBe(false)
    expect(screen.queryByText("Owned Node service restarted and readiness verified.")).toBeNull()
    expect(calls.mock.calls.filter(([url]) => String(url).endsWith("/restart"))).toHaveLength(1)
  },
)

it.each(["response-mismatch", "refresh-mismatch"] as const)(
  "blocks repeat Node action when %s",
  async (scenario) => {
    const user = userEvent.setup()
    let submitted = false
    const project = {
      id: ID, name: "Verified Node", kind: "node", state: "source-staged",
      runtime: "not-provisioned", activeRelease: null, candidateRelease: RELEASE,
      previousCandidate: null, deploymentCount: 1, createdAt: "2026-11-09T12:00:00Z",
    }
    const calls = vi.fn(async (input: RequestInfo | URL, options?: RequestInit) => {
      const url = String(input)
      if (url === "/api/v1/node-projects")
        return { ok: true, json: async () => ({ projects: [project] }) }
      if (url.endsWith("/releases")) return { ok: true, json: async () => ({ releases: [] }) }
      if (url.endsWith("/runtime")) return { ok: true, json: async () => ({
        runtime: {
          state: submitted && scenario === "refresh-mismatch" ? "stopped" : "running",
          port: 19301, desired: "running", activeRelease: RELEASE,
          lastGoodRelease: RELEASE, previousGoodRelease: null, history: [],
        }, executionEnabled: true,
      }) }
      if (url.endsWith("/plan")) return { ok: true, json: async () => ({
        plan: { release: RELEASE, port: 19301, missingTools: [], conflicts: [],
          dependencyCount: 0, allowed: true, reason: "ready-for-explicit-local-deploy" },
        executionEnabled: true,
      }) }
      if (url.endsWith("/restart") && options?.method === "POST") {
        submitted = true
        return { ok: true, json: async () => ({
          runtime: { state: scenario === "response-mismatch" ? "stopped" : "running",
            activeRelease: RELEASE },
        }) }
      }
      throw new Error("Unexpected request " + url)
    })
    vi.stubGlobal("fetch", calls)
    render(<ProjectsPage />)
    await screen.findByRole("button", { name: "Verified Node" })
    await user.click(screen.getByRole("button", { name: "Verified Node" }))
    await screen.findByText(/Runtime: running/)
    await user.click(screen.getByLabelText("Approve local Node execution"))
    await user.click(screen.getByRole("button", { name: "Restart service" }))
    await screen.findByText(scenario === "response-mismatch"
      ? "Node action response unverified. Refresh runtime status before retrying."
      : "Node action acknowledged, but runtime state differs. Review plan before retrying.")
    expect((screen.getByRole("button", { name: "Restart service" }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.queryByText("Owned Node service restarted and readiness verified.")).toBeNull()
    expect(calls.mock.calls.filter(([url]) => String(url).endsWith("/restart"))).toHaveLength(1)
  },
)

it("blocks follow-up Node execution if the owned HTTP readiness proof fails", async () => {
  const user = userEvent.setup()
  const project = {
    id: ID, name: "Unready Node", kind: "node", state: "source-staged",
    runtime: "not-provisioned", activeRelease: null, candidateRelease: RELEASE,
    previousCandidate: null, deploymentCount: 1, createdAt: "2026-11-09T12:00:00Z",
  }
  const calls = vi.fn(async (input: RequestInfo | URL, options?: RequestInit) => {
    const url = String(input)
    if (url === "/api/v1/node-projects")
      return { ok: true, json: async () => ({ projects: [project] }) }
    if (url.endsWith("/releases"))
      return { ok: true, json: async () => ({ releases: [] }) }
    if (url.endsWith("/runtime"))
      return { ok: true, json: async () => ({ runtime: {
        state: "running", desired: "running", port: 19301,
        activeRelease: RELEASE, lastGoodRelease: RELEASE,
        previousGoodRelease: null, history: [],
      }, executionEnabled: true }) }
    if (url.endsWith("/plan"))
      return { ok: true, json: async () => ({ plan: {
        release: RELEASE, port: 19301, missingTools: [], conflicts: [],
        dependencyCount: 0, allowed: true, reason: "ready-for-explicit-local-deploy",
      }, executionEnabled: true }) }
    if (url.endsWith("/restart") && options?.method === "POST")
      return { ok: true, json: async () => ({ runtime: {
        state: "running", activeRelease: RELEASE,
      } }) }
    if (url.endsWith("/health"))
      return { ok: true, json: async () => ({ health: {
        state: "running", release: RELEASE, ready: false,
      } }) }
    throw new Error("Unexpected request " + url)
  })
  vi.stubGlobal("fetch", calls)
  render(<ProjectsPage />)
  await screen.findByRole("button", { name: "Unready Node" })
  await user.click(screen.getByRole("button", { name: "Unready Node" }))
  await screen.findByText(/Runtime: running/)
  await user.click(screen.getByLabelText("Approve local Node execution"))
  await user.click(screen.getByRole("button", { name: "Restart service" }))
  await screen.findByText(
    "Node process acknowledged, but HTTP readiness was not verified. Review plan before retrying.",
  )
  expect((screen.getByRole("button", { name: "Restart service" }) as HTMLButtonElement).disabled)
    .toBe(true)
  expect((screen.getByRole("button", { name: "Stop owned service" }) as HTMLButtonElement).disabled)
    .toBe(true)
  expect(screen.queryByText("Owned Node service restarted and readiness verified.")).toBeNull()
  expect(calls.mock.calls.filter(([url]) => String(url).endsWith("/health"))).toHaveLength(1)
  expect(calls.mock.calls.filter(([url]) => String(url).endsWith("/restart"))).toHaveLength(1)
})

it.each(["unchanged", "updated", "candidate-unavailable"] as const)(
  "compares GitHub Node source and preserves previous candidate when %s",
  async (scenario) => {
    const user = userEvent.setup()
    const next = "r-" + "c".repeat(32)
    const remoteManifest = {
      name: "github-node", version: "2.0.0", scripts: { start: "node server.mjs" },
    }
    const remoteLock = {
      name: "github-node", version: "2.0.0", lockfileVersion: 3,
      packages: { "": { name: "github-node", version: "2.0.0" } },
    }
    const remoteSource = "console.log('from GitHub')"
    let published = false
    let rolledBack = false
    let project: Record<string, unknown> = {
      id: ID, name: "GitHub Node", kind: "node", state: "source-staged",
      runtime: "not-provisioned", activeRelease: null, candidateRelease: RELEASE,
      previousCandidate: null, deploymentCount: 1, createdAt: "2026-11-09T12:00:00Z",
    }
    const calls = vi.fn(async (input: RequestInfo | URL, options?: RequestInit) => {
      const url = String(input)
      if (url === "/api/v1/node-projects")
        return { ok: true, json: async () => ({ projects: [project] }) }
      if (url.endsWith("/releases"))
        return { ok: true, json: async () => ({ releases: [] }) }
      if (url.endsWith("/runtime"))
        return { ok: true, json: async () => ({ runtime: {
          state: "running", desired: "running", port: 19301,
          activeRelease: rolledBack ? RELEASE : published ? next : RELEASE,
          lastGoodRelease: rolledBack ? RELEASE : published ? next : RELEASE,
          previousGoodRelease: rolledBack ? next : published ? RELEASE : null, history: [],
        }, executionEnabled: true }) }
      if (url.endsWith("/plan"))
        return { ok: true, json: async () => ({ plan: {
          release: project.candidateRelease, port: 19301, missingTools: [], conflicts: [],
          dependencyCount: 0, allowed: true, reason: "ready-for-explicit-local-deploy",
        }, executionEnabled: true }) }
      if (url.endsWith("/health"))
        return { ok: true, json: async () => ({ health: {
          state: "running", release: rolledBack ? RELEASE : next, ready: true,
        } }) }
      if (url.endsWith("/source") && scenario === "candidate-unavailable")
        return { ok: false, status: 503 }
      if (url.endsWith("/source"))
        return { ok: true, json: async () => ({ source: {
          release: RELEASE,
          manifest: JSON.stringify(remoteManifest),
          lockfile: JSON.stringify(remoteLock),
          serverSource: scenario === "unchanged" ? remoteSource : "console.log('older')",
        } }) }
      if (url === "/api/v1/node-projects/github/preview" && options?.method === "POST") {
        expect((options.headers as Record<string, string>)["X-PocketHost-Intent"])
          .toBe("owned-node-project")
        expect(JSON.parse(String(options.body))).toEqual({ repository: "example/safe-node" })
        return { ok: true, json: async () => ({ preview: {
          repository: "example/safe-node", commit: "a".repeat(40),
          source: { packageJson: remoteManifest, packageLock: remoteLock, serverSource: remoteSource },
          plan: { dependencyCount: 0, commands: { build: null } },
        } }) }
      }
      if (url.endsWith("/stage") && options?.method === "POST") {
        expect(JSON.parse(String(options.body))).toEqual({
          packageJson: remoteManifest, packageLock: remoteLock, serverSource: remoteSource,
          expectedCandidate: RELEASE, expectedRevision: 1,
        })
        project = { ...project, candidateRelease: next, previousCandidate: RELEASE, deploymentCount: 2 }
        return { ok: true, json: async () => ({ project }) }
      }
      if (url.endsWith("/deploy") && options?.method === "POST") {
        expect(JSON.parse(String(options.body))).toEqual({ approved: true, release: next })
        published = true
        return { ok: true, json: async () => ({ runtime: {
          state: "running", activeRelease: next,
        } }) }
      }
      if (url.endsWith("/rollback") && options?.method === "POST") {
        expect(JSON.parse(String(options.body))).toEqual({ approved: true })
        rolledBack = true
        return { ok: true, json: async () => ({ runtime: {
          state: "running", activeRelease: RELEASE,
        } }) }
      }
      throw new Error("Unexpected request " + url)
    })
    vi.stubGlobal("fetch", calls)
    render(<ProjectsPage />)
    await screen.findByRole("button", { name: "GitHub Node" })
    await user.click(screen.getByRole("button", { name: "GitHub Node" }))
    await screen.findByText(/Runtime: running/)
    const editor = screen.getByLabelText("server.mjs") as HTMLTextAreaElement
    const priorEditor = editor.value
    const stage = screen.getByRole("button", { name: "Validate and stage source" }) as HTMLButtonElement
    expect(stage.disabled).toBe(true)
    await user.type(screen.getByLabelText("Public GitHub repository"), "example/safe-node")
    await user.click(screen.getByRole("button", { name: "Check GitHub updates" }))
    if (scenario === "unchanged") {
      await screen.findByText(/matches the current staged source. No update needed/)
      expect(screen.queryByLabelText("GitHub source changes")).toBeNull()
      expect(editor.value).toBe(priorEditor)
      expect(stage.disabled).toBe(true)
      expect(calls.mock.calls.filter(([url]) => String(url).endsWith("/stage"))).toHaveLength(0)
    } else if (scenario === "candidate-unavailable") {
      await screen.findByText("Could not load Node projects. Try Refresh.")
      expect(screen.queryByLabelText("GitHub source changes")).toBeNull()
      expect(editor.value).toBe(priorEditor)
      expect(stage.disabled).toBe(true)
      expect(calls.mock.calls.filter(([url]) => String(url).endsWith("/stage"))).toHaveLength(0)
    } else {
      await screen.findByText(/contains changes. Review and stage/)
      expect(screen.getByLabelText("GitHub source changes").textContent).toContain(
        "example/safe-node @ " + "a".repeat(12) +
          " · Changed: server.mjs · Dependencies: 0 · Build: none",
      )
      expect(editor.value).toBe(remoteSource)
      expect(stage.disabled).toBe(false)
      expect((screen.getByRole("button", { name: "Publish update" }) as HTMLButtonElement).disabled)
        .toBe(true)
      expect(calls.mock.calls.filter(([url]) => String(url).endsWith("/stage"))).toHaveLength(0)
      await user.click(stage)
      await screen.findByText("Source candidate staged. Review the execution plan before deploying.")
      expect(screen.queryByLabelText("GitHub source changes")).toBeNull()
      expect(project.candidateRelease).toBe(next)
      expect(project.previousCandidate).toBe(RELEASE)
      expect(calls.mock.calls.filter(([url]) => String(url).endsWith("/stage"))).toHaveLength(1)
      const publish = screen.getByRole("button", { name: "Publish update" }) as HTMLButtonElement
      expect(publish.disabled).toBe(true)
      await user.click(screen.getByLabelText("Approve local Node execution"))
      expect(publish.disabled).toBe(false)
      await user.click(publish)
      await screen.findByText("Owned Node release started and readiness verified by host.")
      expect(published).toBe(true)
      expect((screen.getByRole("button", { name: "Publish update" }) as HTMLButtonElement).disabled)
        .toBe(true)
      const rollback = screen.getByRole("button", { name: "Rollback active release" }) as HTMLButtonElement
      expect(rollback.disabled).toBe(true)
      await user.click(screen.getByLabelText("Approve local Node execution"))
      expect(rollback.disabled).toBe(false)
      await user.click(rollback)
      await screen.findByText("Previous verified Node release restored by host.")
      expect(rolledBack).toBe(true)
    }
    expect(calls.mock.calls.filter(([url]) => String(url).endsWith("/source"))).toHaveLength(1)
    expect(calls.mock.calls.filter(([url]) => String(url).endsWith("/deploy")))
      .toHaveLength(scenario === "updated" ? 1 : 0)
    expect(calls.mock.calls.filter(([url]) => String(url).endsWith("/rollback")))
      .toHaveLength(scenario === "updated" ? 1 : 0)
  },
)

it("previews GitHub dependencies and required build without installing or staging", async () => {
  const user = userEvent.setup()
  const project = {
    id: ID, name: "Dependency preview", kind: "node", state: "created",
    runtime: "not-provisioned", activeRelease: null, candidateRelease: null,
    previousCandidate: null, deploymentCount: 0, createdAt: "2026-11-09T12:00:00Z",
  }
  const calls = vi.fn(async (input: RequestInfo | URL, options?: RequestInit) => {
    const url = String(input)
    if (url === "/api/v1/node-projects")
      return { ok: true, json: async () => ({ projects: [project] }) }
    if (url.endsWith("/releases"))
      return { ok: true, json: async () => ({ releases: [] }) }
    if (url.endsWith("/runtime"))
      return { ok: true, json: async () => ({ runtime: {
        state: "not-provisioned", desired: "stopped", port: null,
        activeRelease: null, lastGoodRelease: null, previousGoodRelease: null, history: [],
      }, executionEnabled: false }) }
    if (url.endsWith("/plan"))
      return { ok: true, json: async () => ({ plan: {
        release: null, port: null, missingTools: [], conflicts: [],
        dependencyCount: null, allowed: false, reason: "stage-source-first",
      }, executionEnabled: false }) }
    if (url.endsWith("/github/preview") && options?.method === "POST")
      return { ok: true, json: async () => ({ preview: {
        repository: "example/with-packages", commit: "a".repeat(40),
        source: {
          packageJson: { name: "with-packages", version: "1.0.0",
            scripts: { start: "node server.mjs", build: "node build.mjs" } },
          packageLock: { name: "with-packages", version: "1.0.0", lockfileVersion: 3,
            packages: { "": { name: "with-packages", version: "1.0.0" } } },
          serverSource: "console.log('preview only')",
        },
        plan: { dependencyCount: 2, commands: { build: ["npm", "run", "build"] } },
      } }) }
    throw new Error("Unexpected request " + url)
  })
  vi.stubGlobal("fetch", calls)
  render(<ProjectsPage />)
  await screen.findByRole("button", { name: "Dependency preview" })
  await user.click(screen.getByRole("button", { name: "Dependency preview" }))
  await screen.findByText(/Runtime: not-provisioned/)
  await user.type(screen.getByLabelText("Public GitHub repository"), "example/with-packages")
  await user.click(screen.getByRole("button", { name: "Load GitHub source" }))
  await screen.findByText(/GitHub commit a{12} contains changes/)
  const review = screen.getByLabelText("GitHub source changes").textContent ?? ""
  expect(review).toContain("Changed: package.json, package-lock.json, server.mjs")
  expect(review).toContain("Dependencies: 2 · Build: required")
  expect(review).toContain("Staging only; package installation/build requires separate approval.")
  expect(calls.mock.calls.filter(([url]) => String(url).endsWith("/stage"))).toHaveLength(0)
  expect(calls.mock.calls.filter(([url]) => String(url).endsWith("/deploy"))).toHaveLength(0)
})

it.each(["review-required", "blocked", "malformed"] as const)(
  "dependency setup review remains read-only with %s response",
  async (scenario) => {
    const user = userEvent.setup()
    const project = {
      id: ID, name: "Dependency plan Node", kind: "node", state: "source-staged",
      runtime: "not-provisioned", activeRelease: null, candidateRelease: RELEASE,
      previousCandidate: null, deploymentCount: 1, createdAt: "2026-11-09T12:00:00Z",
    }
    const calls = vi.fn(async (input: RequestInfo | URL, options?: RequestInit) => {
      const url = String(input)
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
          release: RELEASE, port: null, nodeVersion: "v26.0.0", npmVersion: "11.0.0",
          missingTools: [], conflicts: [], dependencyCount: 1,
          allowed: false, reason: "dependencies-or-build-need-separate-approval",
        }, executionEnabled: false }) }
      if (url.endsWith("/dependency-review") && !options?.method)
        return { ok: true, json: async () => ({ review: {
          release: scenario === "malformed" ? "wrong-release" : RELEASE,
          status: scenario === "blocked" ? "blocked" : "review-required",
          dependencyCount: 1, installRequired: true, buildRequired: false,
          installCommand: ["npm", "ci", "--ignore-scripts", "--no-audit", "--no-fund"],
          buildCommand: null,
          blockers: scenario === "blocked" ? ["unreviewed-source:node_modules/untrusted"] : [],
          executed: false,
        } }) }
      throw new Error("Unexpected request " + url)
    })
    vi.stubGlobal("fetch", calls)
    render(<ProjectsPage />)
    await screen.findByRole("button", { name: "Dependency plan Node" })
    await user.click(screen.getByRole("button", { name: "Dependency plan Node" }))
    await screen.findByText(/Runtime: not-provisioned/)
    await user.click(screen.getByRole("button", { name: "Review dependency setup" }))
    if (scenario === "malformed") {
      await screen.findByText("Invalid Node dependency review")
      expect(screen.queryByLabelText("Node dependency setup")).toBeNull()
    } else {
      await screen.findByText("Dependency setup reviewed without running npm or build.")
      const details = screen.getByLabelText("Node dependency setup").textContent ?? ""
      expect(details).toContain("Setup: " + scenario)
      expect(details).toContain("npm ci --ignore-scripts --no-audit --no-fund")
      expect(details).toContain("Not executed; installation/build requires separate approval.")
      if (scenario === "blocked")
        expect(details).toContain("unreviewed-source:node_modules/untrusted")
    }
    expect(calls.mock.calls.filter(([url]) => String(url).endsWith("/dependency-review")))
      .toHaveLength(1)
    expect(calls.mock.calls.filter(([url]) => /\/(stage|deploy|start|install|build)$/.test(String(url))))
      .toHaveLength(0)
  },
)

it("rejects malformed GitHub preview without changing the Node source editor", async () => {
  const user = userEvent.setup()
  const project = {
    id: ID, name: "Rejected GitHub", kind: "node", state: "created",
    runtime: "not-provisioned", activeRelease: null, candidateRelease: null,
    previousCandidate: null, deploymentCount: 0, createdAt: "2026-11-09T12:00:00Z",
  }
  const calls = vi.fn(async (input: RequestInfo | URL, options?: RequestInit) => {
    const url = String(input)
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
        release: null, port: null, missingTools: [], conflicts: [],
        dependencyCount: null, allowed: false, reason: "stage-source-first",
      }, executionEnabled: false }) }
    if (url === "/api/v1/node-projects/github/preview")
      return { ok: true, json: async () => ({ preview: {
        repository: "example/safe-node", commit: "wrong",
        source: { packageJson: {}, packageLock: {}, serverSource: "untrusted" },
      } }) }
    throw new Error("Unexpected request " + url)
  })
  vi.stubGlobal("fetch", calls)
  render(<ProjectsPage />)
  await screen.findByRole("button", { name: "Rejected GitHub" })
  await user.click(screen.getByRole("button", { name: "Rejected GitHub" }))
  await screen.findByText(/Runtime: not-provisioned/)
  const originalSource = (screen.getByLabelText("server.mjs") as HTMLTextAreaElement).value
  await user.type(screen.getByLabelText("Public GitHub repository"), "example/safe-node")
  await user.click(screen.getByRole("button", { name: "Load GitHub source" }))
  await screen.findByText("Invalid GitHub Node source preview")
  expect((screen.getByLabelText("server.mjs") as HTMLTextAreaElement).value).toBe(originalSource)
  expect(calls.mock.calls.filter(([url]) => String(url).endsWith("/stage"))).toHaveLength(0)
})

it("rejects a stale Node editor save and never retries the conflicting stage request", async () => {
  const user = userEvent.setup()
  const project = {
    id: ID, name: "Concurrent Node", kind: "node", state: "source-staged",
    runtime: "not-provisioned", activeRelease: null, candidateRelease: RELEASE,
    previousCandidate: null, deploymentCount: 1, createdAt: "2026-11-09T12:00:00Z",
  }
  const calls = vi.fn(async (input: RequestInfo | URL, options?: RequestInit) => {
    const url = String(input)
    if (url === "/api/v1/node-projects")
      return { ok: true, json: async () => ({ projects: [project] }) }
    if (url.endsWith("/releases"))
      return { ok: true, json: async () => ({ releases: [] }) }
    if (url.endsWith("/runtime"))
      return { ok: true, json: async () => ({ runtime: {
        state: "not-provisioned", desired: "stopped", port: null,
        activeRelease: null, lastGoodRelease: null, previousGoodRelease: null, history: [],
      }, executionEnabled: false }) }
    if (url.endsWith("/plan"))
      return { ok: true, json: async () => ({ plan: {
        release: RELEASE, port: null, missingTools: [], conflicts: [],
        dependencyCount: 0, allowed: true, reason: "ready-for-explicit-local-deploy",
      }, executionEnabled: false }) }
    if (url.endsWith("/stage") && options?.method === "POST") {
      expect(JSON.parse(String(options.body))).toMatchObject({
        expectedCandidate: RELEASE, expectedRevision: 1,
      })
      return { ok: false, status: 409 }
    }
    throw new Error("Unexpected request " + url)
  })
  vi.stubGlobal("fetch", calls)
  render(<ProjectsPage />)
  await screen.findByRole("button", { name: "Concurrent Node" })
  await user.click(screen.getByRole("button", { name: "Concurrent Node" }))
  await screen.findByText(/Runtime: not-provisioned/)
  await user.type(screen.getByLabelText("server.mjs"), "x")
  await user.click(screen.getByRole("button", { name: "Validate and stage source" }))
  await screen.findByText("Node source save refused. Refresh project and review the current candidate.")
  expect(calls.mock.calls.filter(([url]) => String(url).endsWith("/stage"))).toHaveLength(1)
  expect(calls.mock.calls.filter(([url]) => String(url).endsWith("/deploy"))).toHaveLength(0)
})

it.each(["restored", "conflict"] as const)(
  "restores previous Node source only at the observed revision: %s",
  async (scenario) => {
    const user = userEvent.setup()
    const current = "r-" + "c".repeat(32)
    let project = {
      id: ID, name: "Versioned Node", kind: "node" as const, state: "source-staged" as const,
      runtime: "not-provisioned" as const, activeRelease: null,
      candidateRelease: current, previousCandidate: RELEASE,
      deploymentCount: 2, createdAt: "2026-11-09T12:00:00Z",
    }
    const calls = vi.fn(async (input: RequestInfo | URL, options?: RequestInit) => {
      const url = String(input)
      if (url === "/api/v1/node-projects")
        return { ok: true, json: async () => ({ projects: [project] }) }
      if (url.endsWith("/releases"))
        return { ok: true, json: async () => ({ releases: [] }) }
      if (url.endsWith("/runtime"))
        return { ok: true, json: async () => ({ runtime: {
          state: "not-provisioned", desired: "stopped", port: null,
          activeRelease: null, lastGoodRelease: null, previousGoodRelease: null, history: [],
        }, executionEnabled: false }) }
      if (url.endsWith("/plan"))
        return { ok: true, json: async () => ({ plan: {
          release: project.candidateRelease, port: null, missingTools: [],
          conflicts: [], dependencyCount: 0, allowed: false, reason: "no-owned-service",
        }, executionEnabled: false }) }
      if (url.endsWith("/restore-candidate") && options?.method === "POST") {
        expect((options.headers as Record<string, string>)["X-PocketHost-Intent"])
          .toBe("owned-node-project")
        expect(JSON.parse(String(options.body))).toEqual({
          expectedCandidate: current, expectedRevision: 2,
        })
        if (scenario === "conflict") return { ok: false, status: 409 }
        project = {
          ...project, candidateRelease: RELEASE,
          previousCandidate: current, deploymentCount: 3,
        }
        return { ok: true, json: async () => ({ project }) }
      }
      throw new Error("Unexpected request " + url)
    })
    vi.stubGlobal("fetch", calls)
    render(<ProjectsPage />)
    await screen.findByRole("button", { name: "Versioned Node" })
    await user.click(screen.getByRole("button", { name: "Versioned Node" }))
    await screen.findByText(/Runtime: not-provisioned/)
    await user.click(screen.getByRole("button", { name: "Restore previous candidate" }))
    if (scenario === "restored") {
      await screen.findByText("Previous source candidate restored. No live process was changed.")
      expect(project.candidateRelease).toBe(RELEASE)
      expect(project.previousCandidate).toBe(current)
      expect(project.deploymentCount).toBe(3)
    } else {
      await screen.findByText("Node source save refused. Refresh project and review the current candidate.")
      expect(project.candidateRelease).toBe(current)
      expect(project.previousCandidate).toBe(RELEASE)
      expect(project.deploymentCount).toBe(2)
    }
    expect(calls.mock.calls.filter(([url]) => String(url).endsWith("/restore-candidate")))
      .toHaveLength(1)
    expect(calls.mock.calls.filter(([url]) => String(url).endsWith("/deploy")))
      .toHaveLength(0)
  },
)
