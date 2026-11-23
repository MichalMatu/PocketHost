import * as React from "react"
import { afterEach, expect, it, vi } from "vitest"
import { render as renderBase, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
vi.mock("@/components/layouts/base-layout", () => ({
  BaseLayout: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}))
import ProjectsPage from "@/app/projects/page"
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

it.each(["restored", "conflict", "readback-drift"] as const)(
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
        const acknowledged = {
          ...project, candidateRelease: RELEASE,
          previousCandidate: current, deploymentCount: 3,
        }
        if (scenario !== "readback-drift") project = acknowledged
        return { ok: true, json: async () => ({ project: acknowledged }) }
      }
      throw new Error("Unexpected request " + url)
    })
    vi.stubGlobal("fetch", calls)
    render(<MemoryRouter><ProjectsPage /></MemoryRouter>)
  await unlockNodeOwner()
    await screen.findByRole("button", { name: "Versioned Node" })
    await user.click(screen.getByRole("button", { name: "Versioned Node" }))
    await screen.findByText(/not-provisioned · Live:/)
    await user.click(screen.getByRole("button", { name: "Restore previous candidate" }))
    if (scenario === "restored") {
      await screen.findByText("Previous source candidate restored. No live process was changed.")
      expect(project.candidateRelease).toBe(RELEASE)
      expect(project.previousCandidate).toBe(current)
      expect(project.deploymentCount).toBe(3)
    } else {
      await screen.findByText(scenario === "conflict"
        ? "Node source save refused. Refresh project and review the current candidate."
        : "Node source result unconfirmed. Refresh project and review the candidate before retrying.")
      expect(project.candidateRelease).toBe(current)
      expect(project.previousCandidate).toBe(RELEASE)
      expect(project.deploymentCount).toBe(2)
      expect(screen.queryByText("Previous source candidate restored. No live process was changed."))
        .toBeNull()
    }
    expect(calls.mock.calls.filter(([url]) => String(url).endsWith("/restore-candidate")))
      .toHaveLength(1)
    expect(calls.mock.calls.filter(([url]) => String(url).endsWith("/deploy")))
      .toHaveLength(0)
  },
)

it.each(["disabled", "approved", "blocked"] as const)(
  "requires explicit and eligible npm dependency installation: %s",
  async (scenario) => {
    const user = userEvent.setup()
    const project = {
      id: ID, name: "Prepared Node", kind: "node", state: "source-staged",
      runtime: "not-provisioned", activeRelease: null, candidateRelease: RELEASE,
      previousCandidate: null, deploymentCount: 1, createdAt: "2026-11-09T12:00:00Z",
    }
    let installed = false
    const calls = vi.fn(async (input: RequestInfo | URL, options?: RequestInit) => {
      const url = String(input)
      if (url === "/api/v1/node-projects")
        return { ok: true, json: async () => ({ projects: [project] }) }
      if (url.endsWith("/releases"))
        return { ok: true, json: async () => ({ releases: [] }) }
      if (url.endsWith("/runtime"))
        return { ok: true, json: async () => ({ runtime: {
          state: "not-provisioned", desired: "stopped", port: null,
          activeRelease: null, lastGoodRelease: null, previousGoodRelease: null,
          history: [],
        }, executionEnabled: false }) }
      if (url.endsWith("/plan"))
        return { ok: true, json: async () => ({ plan: {
          release: RELEASE, port: null, nodeVersion: "v26.13.0", npmVersion: "11.6.2",
          missingTools: [], conflicts: [], dependencyCount: 1,
          allowed: installed, reason: installed ? "ready-for-explicit-local-deploy"
            : "dependencies-or-build-need-separate-approval",
        }, executionEnabled: false }) }
      if (url.endsWith("/dependency-review") && !options?.method)
        return { ok: true, json: async () => ({
          dependencyInstallEnabled: scenario !== "disabled",
          review: {
            release: RELEASE, status: installed ? "prepared" :
              scenario === "blocked" ? "blocked" : "review-required",
            dependencyCount: 1, installRequired: true, buildRequired: false,
            installCommand: ["npm", "ci", "--ignore-scripts", "--no-bin-links", "--no-audit", "--no-fund", "--omit=dev"],
            buildCommand: null,
            blockers: scenario === "blocked" ? ["unreviewed-source:unsafe"] : [],
            executed: false,
          },
        }) }
      if (url.endsWith("/install-dependencies") && options?.method === "POST") {
        const body = JSON.parse(String(options.body))
        expect(body).toEqual({ approved: true, release: RELEASE })
        expect((options.headers as Record<string, string>)["X-PocketHost-Intent"])
          .toBe("owned-node-project")
        installed = true
        return { ok: true, json: async () => ({ dependencies: {
          release: RELEASE, dependencyCount: 1, prepared: true, verified: true,
        } }) }
      }
      throw new Error("Unexpected request " + url)
    })
    vi.stubGlobal("fetch", calls)
    render(<MemoryRouter><ProjectsPage /></MemoryRouter>)
  await unlockNodeOwner()
    await screen.findByRole("button", { name: "Prepared Node" })
    await user.click(screen.getByRole("button", { name: "Prepared Node" }))
    await screen.findByText(/not-provisioned · Live:/)
    const approve = screen.getByLabelText("Approve Node dependency install") as HTMLInputElement
    const install = screen.getByRole("button", { name: "Install approved dependencies" }) as HTMLButtonElement
    expect(approve.disabled).toBe(true)
    expect(install.disabled).toBe(true)
    await user.click(screen.getByRole("button", { name: "Review dependency setup" }))
    if (scenario === "approved") {
      await screen.findByText("Dependency setup reviewed without running npm or build.")
      expect(approve.disabled).toBe(false)
      expect(install.disabled).toBe(true)
      await user.click(approve)
      expect(install.disabled).toBe(false)
      await user.click(install)
      await screen.findByText("Owned Node packages installed and SHA-256 integrity verified. Review deploy plan.")
      expect(screen.getByLabelText("Node dependency setup").textContent).toContain("Setup: prepared")
      expect(install.disabled).toBe(true)
    } else {
      await screen.findByText("Dependency setup reviewed without running npm or build.")
      expect(approve.disabled).toBe(true)
      expect(install.disabled).toBe(true)
    }
    expect(calls.mock.calls.filter(([url]) => String(url).endsWith("/install-dependencies")))
      .toHaveLength(scenario === "approved" ? 1 : 0)
  },
)


it.each(["disabled", "blocked", "approved", "unconfirmed"] as const)(
  "build execution requires pinned separate approval: %s",
  async scenario => {
    const user = userEvent.setup()
    const project = {
      id: ID, name: "Build project", kind: "node", state: "source-staged",
      runtime: "not-provisioned", activeRelease: null, candidateRelease: RELEASE,
      previousCandidate: null, deploymentCount: 1, createdAt: "2026-11-09T12:00:00Z",
    }
    let built = false
    const calls = vi.fn(async (input: RequestInfo | URL, options?: RequestInit) => {
      const url = String(input)
      if (url === "/api/v1/node-projects")
        return { ok: true, json: async () => ({ projects: [project] }) }
      if (url.endsWith("/releases"))
        return { ok: true, json: async () => ({ releases: [] }) }
      if (url.endsWith("/runtime"))
        return { ok: true, json: async () => ({ runtime: {
          state: "not-provisioned", desired: "stopped", port: null,
          activeRelease: null, lastGoodRelease: null, previousGoodRelease: null,
          history: [],
        }, executionEnabled: false }) }
      if (url.endsWith("/plan"))
        return { ok: true, json: async () => ({ plan: {
          release: RELEASE, port: null, missingTools: [], conflicts: [],
          dependencyCount: 0, allowed: built, reason: built ? "ready-for-explicit-local-deploy" :
            "build-artifact-not-verified",
        }, executionEnabled: false }) }
      if (url.endsWith("/build-review"))
        return { ok: true, json: async () => ({
          buildEnabled: scenario !== "disabled",
          review: {
            release: RELEASE, status: built ? "verified" :
              scenario === "blocked" ? "blocked" : "ready-to-build",
            buildRequired: true, script: "node server.mjs --build",
            dependencyCount: 0, dependenciesPrepared: true,
            artifactVerified: built,
            artifact: built ? { entries: 1, bytes: 14, files: ["index.html"], truncated: false } : null,
            blockers: scenario === "blocked" ? ["release-in-use"] : [],
          },
        }) }
      if (url.endsWith("/build") && options?.method === "POST") {
        expect(JSON.parse(String(options.body))).toEqual({ approved: true, release: RELEASE })
        expect((options.headers as Record<string, string>)["X-PocketHost-Intent"])
          .toBe("owned-node-project")
        if (scenario === "unconfirmed") return { ok: false, status: 409 }
        built = true
        return { ok: true, json: async () => ({ build: {
          release: RELEASE, entries: 1, bytes: 14, prepared: true, verified: true,
        } }) }
      }
      throw new Error("Unexpected request " + url)
    })
    vi.stubGlobal("fetch", calls)
    render(<MemoryRouter><ProjectsPage /></MemoryRouter>)
  await unlockNodeOwner()
    await user.click(await screen.findByRole("button", { name: "Build project" }))
    await screen.findByText(/not-provisioned · Live:/)
    const approve = screen.getByLabelText("Approve Node build execution") as HTMLInputElement
    const build = screen.getByRole("button", { name: "Execute approved Node build" }) as HTMLButtonElement
    expect(build.disabled).toBe(true)
    await user.click(screen.getByRole("button", { name: "Review Node build" }))
    await screen.findByText("Build reviewed without running project code.")
    expect(screen.getByLabelText("Node build setup").textContent).toContain("Script: node server.mjs --build")
    expect(build.disabled).toBe(true)
    if (scenario === "disabled" || scenario === "blocked") {
      expect(approve.disabled).toBe(true)
    } else {
      expect(approve.disabled).toBe(false)
      await user.click(approve)
      expect(build.disabled).toBe(false)
      await user.click(build)
      if (scenario === "approved") {
        await screen.findByText("Node build published privately and artifact integrity verified. Review deploy plan.")
        expect(screen.getByLabelText("Node build setup").textContent).toContain("Build: verified")
        expect(screen.getByLabelText("Node build setup").textContent).toContain("Files: index.html")
        expect(screen.getByLabelText("Node build setup").textContent).toContain("Size: 14 bytes")
        expect(build.disabled).toBe(true)
      } else {
        await screen.findByText("Node build result unconfirmed. Review the artifact before retrying.")
        expect(build.disabled).toBe(true)
        expect(screen.queryByLabelText("Node build setup")).toBeNull()
      }
    }
    expect(calls.mock.calls.filter(([url]) => String(url).endsWith("/build")))
      .toHaveLength(scenario === "approved" || scenario === "unconfirmed" ? 1 : 0)
    expect(calls.mock.calls.filter(([url]) => String(url).endsWith("/deploy")))
      .toHaveLength(0)
  },
)

it.each([true, false])(
  "read-only rollback review blocks unsafe targets before any mutation: verified=%s",
  async verified => {
    const user = userEvent.setup()
    const NEXT = "r-" + "c".repeat(32)
    const project = {
      id: ID, name: "Rollback review", kind: "node", state: "source-staged",
      runtime: "not-provisioned", activeRelease: null, candidateRelease: NEXT,
      previousCandidate: RELEASE, deploymentCount: 2, createdAt: "2026-11-09T12:00:00Z",
    }
    const calls = vi.fn(async (input: RequestInfo | URL, options?: RequestInit) => {
      const url = String(input)
      if (url === "/api/v1/node-projects")
        return { ok: true, json: async () => ({ projects: [project] }) }
      if (url.endsWith("/releases"))
        return { ok: true, json: async () => ({ releases: [] }) }
      if (url.endsWith("/runtime"))
        return { ok: true, json: async () => ({ runtime: {
          state: "running", desired: "running", port: 19302, activeRelease: NEXT,
          lastGoodRelease: NEXT, previousGoodRelease: RELEASE, history: [],
        }, executionEnabled: true }) }
      if (url.endsWith("/plan"))
        return { ok: true, json: async () => ({ plan: {
          release: NEXT, port: 19302, missingTools: [], conflicts: [],
          dependencyCount: 0, allowed: true, reason: "ready-for-explicit-local-deploy",
        }, executionEnabled: true }) }
      if (url.endsWith("/rollback-preview") && !options?.method)
        return { ok: true, json: async () => ({ rollbackPreview: {
          release: RELEASE, allowed: verified,
          reason: verified ? "previous-release-verified" : "rollback-release-not-verifiable",
        } }) }
      throw new Error("Unexpected request " + url)
    })
    vi.stubGlobal("fetch", calls)
    render(<MemoryRouter><ProjectsPage /></MemoryRouter>)
  await unlockNodeOwner()
    await user.click(await screen.findByRole("button", { name: "Rollback review" }))
    await screen.findByText(/running · Live:/)
    await user.click(screen.getByRole("button", { name: "Review rollback target" }))
    await screen.findByText(verified ?
      "Previous Node release verified for explicit rollback." :
      "Rollback target is not safely recoverable.")
    const rollback = screen.getByRole("button", { name: "Rollback active release" }) as HTMLButtonElement
    expect(rollback.disabled).toBe(true)
    await user.click(screen.getByLabelText("Approve local Node execution"))
    expect(rollback.disabled).toBe(!verified)
    expect(screen.getByLabelText("Node rollback preflight").textContent)
      .toContain(verified ? "verified" : "blocked")
    expect(calls.mock.calls.filter(([url]) => String(url).endsWith("/rollback")))
      .toHaveLength(0)
  },
)

it("loads one local project folder including frontend assets and stages only after review", async () => {
  const user = userEvent.setup()
  const current = {
    id: ID, name: "Local folder", kind: "node", state: "created",
    runtime: "not-provisioned", activeRelease: null, candidateRelease: null,
    previousCandidate: null, deploymentCount: 0, createdAt: "2026-11-09T12:00:00Z",
  }
  const pkg = { name: "folder-node", version: "1.0.0", scripts: { start: "node server.mjs" } }
  const lock = {
    name: "folder-node", version: "1.0.0", lockfileVersion: 3,
    packages: { "": { name: "folder-node", version: "1.0.0" } },
  }
  let staged = false
  const calls = vi.fn(async (input: RequestInfo | URL, options?: RequestInit) => {
    const url = String(input)
    if (url === "/api/v1/node-projects")
      return { ok: true, json: async () => ({ projects: [
        staged ? { ...current, state: "source-staged", candidateRelease: RELEASE, deploymentCount: 1 } : current,
      ] }) }
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
        dependencyCount: 0, allowed: false, reason: "no-candidate",
      }, executionEnabled: false }) }
    if (url.endsWith("/stage") && options?.method === "POST") {
      expect(JSON.parse(String(options.body))).toEqual({
        packageJson: pkg, packageLock: lock, serverSource: "console.log('folder')",
        extraFiles: { "index.html": "<main>Hello</main>" },
        assetFiles: {
          "public/logo.png": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j2WcAAAAASUVORK5CYII=",
        },
        expectedCandidate: null, expectedRevision: 0,
      })
      staged = true
      return { ok: true, json: async () => ({ project: {
        ...current, state: "source-staged", candidateRelease: RELEASE, deploymentCount: 1,
      } }) }
    }
    throw new Error("Unexpected endpoint " + url)
  })
  const make = (path: string, content: string | Uint8Array) => {
    const file = new File([content], path.split("/").at(-1)!)
    Object.defineProperty(file, "webkitRelativePath", { value: "my-project/" + path })
    return file
  }
  const png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j2WcAAAAASUVORK5CYII="
  vi.stubGlobal("fetch", calls)
  render(<MemoryRouter><ProjectsPage /></MemoryRouter>)
  await unlockNodeOwner()
  await user.click(await screen.findByRole("button", { name: "Local folder" }))
  await screen.findByText(/not-provisioned · Live:/)
  await user.upload(screen.getByLabelText("Load Node project folder"), [
    make("package.json", JSON.stringify(pkg)),
    make("package-lock.json", JSON.stringify(lock)),
    make("server.mjs", "console.log('folder')"),
    make("index.html", "<main>Hello</main>"),
    make("public/logo.png", Uint8Array.from(atob(png), char => char.charCodeAt(0))),
  ])
  await screen.findByText("Local project folder reviewed. Validate and stage to save its files; no code executed.")
  expect(screen.getByLabelText("Imported frontend files").textContent).toContain("index.html")
  expect(screen.getByLabelText("Imported binary assets").textContent).toContain("public/logo.png")
  expect(calls.mock.calls.filter(([url]) => String(url).endsWith("/stage"))).toHaveLength(0)
  await user.click(screen.getByRole("button", { name: "Validate and stage source" }))
  await screen.findByText("Source candidate staged. Review the execution plan before deploying.")
  expect(calls.mock.calls.filter(([url]) => String(url).endsWith("/stage"))).toHaveLength(1)
  expect(calls.mock.calls.filter(([url]) => String(url).endsWith("/deploy"))).toHaveLength(0)
})

it("collapses secondary Node controls by default", () => {
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ projects: [] }) })))
  const { container } = renderBase(<MemoryRouter><ProjectsPage /></MemoryRouter>)
  expect(Array.from(container.querySelectorAll<HTMLDetailsElement>("details"))
    .every(section => !section.open)).toBe(true)
})

