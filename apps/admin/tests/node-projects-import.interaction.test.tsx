import * as React from "react"
import { afterEach, expect, it, vi } from "vitest"
import { render as renderBase, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
vi.mock("@/components/layouts/base-layout", () => ({
  BaseLayout: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}))
import ProjectsPage from "./helpers/node-project-workflow-harness"
const ID = "node-" + "a".repeat(32)
const RELEASE = "r-" + "b".repeat(32)
const OWNER_TOKEN = "A".repeat(40)
afterEach(() => { vi.unstubAllGlobals(); observers.splice(0).forEach(x => x.disconnect()) })

const observers: MutationObserver[] = []
function render(ui: React.ReactElement) {
  const view = renderBase(ui)
  const expand = () => view.container.querySelectorAll<HTMLDetailsElement>(
    'details[data-testid^="node-"]',
  ).forEach(section => { section.open = true })
  const watcher = new MutationObserver(expand)
  watcher.observe(view.container, { childList: true, subtree: true })
  observers.push(watcher)
  expand()
  return view
}

// The owner session is a separate, private contract from each tested endpoint.
// Do not weaken production authorization just to satisfy old source-flow mocks.
async function unlockNodeOwner() {
  const fetchOriginal = globalThis.fetch
  vi.stubGlobal("fetch", (url: RequestInfo | URL, options?: RequestInit) => {
    if (String(url) === "/api/v1/node-projects/owner-session") {
      expect((options?.headers as Record<string, string>)["X-PocketHost-Node-Owner"])
        .toBe(OWNER_TOKEN)
      return Promise.resolve({ ok: true, json: async () => ({
        configured: true, authorized: true,
      }) })
    }
    return fetchOriginal(url, options)
  })
  const user = userEvent.setup()
  await user.type(screen.getByLabelText("Node owner token"), OWNER_TOKEN)
  await user.click(screen.getByRole("button", { name: "Unlock management" }))
  await screen.findByText("Owner authenticated for Node management.")
}

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
    render(<MemoryRouter><ProjectsPage /></MemoryRouter>)
  await unlockNodeOwner()
    await screen.findByRole("button", { name: "GitHub Node" })
    await user.click(screen.getByRole("button", { name: "GitHub Node" }))
    await screen.findByText(/running · Live:/)
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
  render(<MemoryRouter><ProjectsPage /></MemoryRouter>)
  await unlockNodeOwner()
  await screen.findByRole("button", { name: "Dependency preview" })
  await user.click(screen.getByRole("button", { name: "Dependency preview" }))
  await screen.findByText(/not-provisioned · Live:/)
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
          installCommand: ["npm", "ci", "--ignore-scripts", "--no-bin-links", "--no-audit", "--no-fund", "--omit=dev"],
          buildCommand: null,
          blockers: scenario === "blocked" ? ["unreviewed-source:node_modules/untrusted"] : [],
          executed: false,
        } }) }
      throw new Error("Unexpected request " + url)
    })
    vi.stubGlobal("fetch", calls)
    render(<MemoryRouter><ProjectsPage /></MemoryRouter>)
  await unlockNodeOwner()
    await screen.findByRole("button", { name: "Dependency plan Node" })
    await user.click(screen.getByRole("button", { name: "Dependency plan Node" }))
    await screen.findByText(/not-provisioned · Live:/)
    await user.click(screen.getByRole("button", { name: "Review dependency setup" }))
    if (scenario === "malformed") {
      await screen.findByText("Invalid Node dependency review")
      expect(screen.queryByLabelText("Node dependency setup")).toBeNull()
    } else {
      await screen.findByText("Dependency setup reviewed without running npm or build.")
      const details = screen.getByLabelText("Node dependency setup").textContent ?? ""
      expect(details).toContain("Setup: " + scenario)
      expect(details).toContain("npm ci --ignore-scripts --no-bin-links --no-audit --no-fund --omit=dev")
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

it("accepts bounded build dependency approval without authorizing deploy or build", async () => {
  const user = userEvent.setup()
  const project = {
    id: ID, name: "Build packages", kind: "node", state: "source-staged",
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
        dependencyCount: 2, allowed: false, reason: "dependencies-or-build-need-separate-approval",
      }, executionEnabled: false }) }
    if (url.endsWith("/dependency-review") && !options?.method)
      return { ok: true, json: async () => ({ dependencyInstallEnabled: true, review: {
        release: RELEASE, status: "review-required", dependencyCount: 2,
        installRequired: true, buildRequired: true,
        installCommand: ["npm", "ci", "--ignore-scripts", "--no-bin-links", "--no-audit", "--no-fund", "--include=dev"],
        buildCommand: ["npm", "run", "build"], blockers: [], executed: false,
      } }) }
    throw new Error("Unexpected request " + url)
  })
  vi.stubGlobal("fetch", calls)
  render(<MemoryRouter><ProjectsPage /></MemoryRouter>)
  await unlockNodeOwner()
  await user.click(await screen.findByRole("button", { name: "Build packages" }))
  await user.click(screen.getByRole("button", { name: "Review dependency setup" }))
  await screen.findByText("Dependency setup reviewed without running npm or build.")
  const install = screen.getByRole("button", { name: "Install approved dependencies" }) as HTMLButtonElement
  expect(install.disabled).toBe(true)
  await user.click(screen.getByLabelText("Approve Node dependency install"))
  expect(install.disabled).toBe(false)
  expect((screen.getByRole("button", { name: "Deploy selected release" }) as HTMLButtonElement).disabled)
    .toBe(true)
  expect(calls.mock.calls.filter(([url]) => /install-dependencies|\/deploy$/.test(String(url))))
    .toHaveLength(0)
})

it("rejects malformed GitHub preview without changing the Node source editor", async () => {
  const user = userEvent.setup()
  const project = {
    id: ID, name: "Rejected GitHub", kind: "node", state: "created",
    runtime: "not-provisioned", activeRelease: null, candidateRelease: null,
    previousCandidate: null, deploymentCount: 0, createdAt: "2026-11-09T12:00:00Z",
  }
  const calls = vi.fn(async (input: RequestInfo | URL) => {
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
  render(<MemoryRouter><ProjectsPage /></MemoryRouter>)
  await unlockNodeOwner()
  await screen.findByRole("button", { name: "Rejected GitHub" })
  await user.click(screen.getByRole("button", { name: "Rejected GitHub" }))
  await screen.findByText(/not-provisioned · Live:/)
  const originalSource = (screen.getByLabelText("server.mjs") as HTMLTextAreaElement).value
  await user.type(screen.getByLabelText("Public GitHub repository"), "example/safe-node")
  await user.click(screen.getByRole("button", { name: "Load GitHub source" }))
  await screen.findByText("Invalid GitHub Node source preview")
  expect((screen.getByLabelText("server.mjs") as HTMLTextAreaElement).value).toBe(originalSource)
  expect(calls.mock.calls.filter(([url]) => String(url).endsWith("/stage"))).toHaveLength(0)
})

it("does not claim a staged Node release when exact catalog readback stays stale", async () => {
  const user = userEvent.setup()
  const original = {
    id: ID, name: "Stage readback Node", kind: "node" as const, state: "created" as const,
    runtime: "not-provisioned" as const, activeRelease: null,
    candidateRelease: null, previousCandidate: null, deploymentCount: 0,
    createdAt: "2026-11-22T10:00:00Z",
  }
  const acknowledged = {
    ...original, state: "source-staged", candidateRelease: RELEASE, deploymentCount: 1,
  }
  const calls = vi.fn(async (input: RequestInfo | URL, options?: RequestInit) => {
    const url = String(input)
    if (url === "/api/v1/node-projects" && !options?.method)
      return { ok: true, json: async () => ({ projects: [original] }) }
    if (url.endsWith("/releases"))
      return { ok: true, json: async () => ({ releases: [] }) }
    if (url.endsWith("/runtime"))
      return { ok: true, json: async () => ({ runtime: {
        state: "not-provisioned", desired: "stopped", port: null, activeRelease: null,
        lastGoodRelease: null, previousGoodRelease: null, history: [],
      }, executionEnabled: false }) }
    if (url.endsWith("/plan"))
      return { ok: true, json: async () => ({ plan: {
        release: null, port: null, missingTools: [], conflicts: [],
        dependencyCount: 0, allowed: false, reason: "no-source",
      }, executionEnabled: false }) }
    if (url.endsWith("/stage") && options?.method === "POST")
      return { ok: true, json: async () => ({ project: acknowledged }) }
    throw new Error("Unexpected endpoint " + url)
  })
  vi.stubGlobal("fetch", calls)
  render(<MemoryRouter><ProjectsPage /></MemoryRouter>)
  await unlockNodeOwner()
  await screen.findByRole("button", { name: "Stage readback Node" })
  await user.click(screen.getByRole("button", { name: "Stage readback Node" }))
  await screen.findByText(/not-provisioned · Live:/)
  await user.click(screen.getByRole("button", { name: "Validate and stage source" }))
  await screen.findByText(
    "Node source result unconfirmed. Refresh project and review the candidate before retrying.",
  )
  expect(screen.queryByText("Source candidate staged. Review the execution plan before deploying."))
    .toBeNull()
  expect(calls.mock.calls.filter(([url]) => String(url).endsWith("/stage"))).toHaveLength(1)
  expect(calls.mock.calls.filter(([url]) => String(url).endsWith("/deploy"))).toHaveLength(0)
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
  render(<MemoryRouter><ProjectsPage /></MemoryRouter>)
  await unlockNodeOwner()
  await screen.findByRole("button", { name: "Concurrent Node" })
  await user.click(screen.getByRole("button", { name: "Concurrent Node" }))
  await screen.findByText(/not-provisioned · Live:/)
  await user.type(screen.getByLabelText("server.mjs"), "x")
  await user.click(screen.getByRole("button", { name: "Validate and stage source" }))
  await screen.findByText("Node source save refused. Refresh project and review the current candidate.")
  expect(calls.mock.calls.filter(([url]) => String(url).endsWith("/stage"))).toHaveLength(1)
  expect(calls.mock.calls.filter(([url]) => String(url).endsWith("/deploy"))).toHaveLength(0)
})

