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

it("imports a pinned GitHub frontend bundle and preserves it in the staged release", async () => {
  const user = userEvent.setup()
  const extras = {
    "index.html": "<main>Hello</main>",
    "src/main.tsx": "document.body.textContent = 'Hello'",
    "vite.config.ts": "export default {}",
  }
  const assets = { "public/logo.png": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j2WcAAAAASUVORK5CYII=" }
  const manifest = {
    name: "frontend-node", version: "1.0.0", scripts: {
      start: "node server.mjs", build: "vite build",
    },
  }
  const lock = {
    name: "frontend-node", version: "1.0.0", lockfileVersion: 3,
    packages: { "": { name: "frontend-node", version: "1.0.0" } },
  }
  const serverSource = "console.log('frontend entrypoint')"
  let project = {
    id: ID, name: "Frontend import", kind: "node", state: "created",
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
        release: project.candidateRelease, port: null, missingTools: [], conflicts: [],
        dependencyCount: 0, allowed: false, reason: "build-artifact-not-verified",
      }, executionEnabled: false }) }
    if (url === "/api/v1/node-projects/github/preview") {
      expect(JSON.parse(String(options?.body))).toEqual({ repository: "example/frontend-node" })
      return { ok: true, json: async () => ({ preview: {
        repository: "example/frontend-node", commit: "a".repeat(40),
        source: { packageJson: manifest, packageLock: lock, serverSource, extraFiles: extras,
          assetFiles: assets },
        plan: { dependencyCount: 0, commands: { build: ["npm", "run", "build"] } },
      } }) }
    }
    if (url.endsWith("/stage") && options?.method === "POST") {
      expect(JSON.parse(String(options.body))).toEqual({
        packageJson: manifest, packageLock: lock, serverSource, extraFiles: extras,
        assetFiles: assets, expectedCandidate: null, expectedRevision: 0,
      })
      project = { ...project, state: "source-staged", candidateRelease: RELEASE,
        deploymentCount: 1 }
      return { ok: true, json: async () => ({ project, unchanged: false }) }
    }
    if (url.endsWith("/source"))
      return { ok: true, json: async () => ({ source: {
        release: RELEASE, manifest: JSON.stringify(manifest),
        lockfile: JSON.stringify(lock), serverSource, extraFiles: extras, assetFiles: assets,
      } }) }
    throw new Error("Unexpected endpoint " + url)
  })
  vi.stubGlobal("fetch", calls)
  render(<MemoryRouter><ProjectsPage /></MemoryRouter>)
  await unlockNodeOwner()
  await user.click(await screen.findByRole("button", { name: "Frontend import" }))
  await screen.findByText(/Runtime: not-provisioned/)
  await user.type(screen.getByLabelText("Public GitHub repository"), "example/frontend-node")
  await user.click(screen.getByRole("button", { name: "Load GitHub source" }))
  await screen.findByText(/contains changes. Review and stage/)
  expect(screen.getByLabelText("Imported frontend files").textContent)
    .toContain("src/main.tsx")
  expect(screen.getByLabelText("Imported binary assets").textContent)
    .toContain("public/logo.png")
  expect(screen.getByLabelText("GitHub source changes").textContent)
    .toContain("Frontend files: 3")
  expect(screen.getByLabelText("GitHub source changes").textContent)
    .toContain("Binary assets: 1")
  await user.click(screen.getByRole("button", { name: "Validate and stage source" }))
  await screen.findByText("Source candidate staged. Review the execution plan before deploying.")
  await user.click(screen.getByRole("button", { name: "Load staged source" }))
  await screen.findByText("Verified staged source loaded into editor; no process changed.")
  expect(screen.getByLabelText("Imported frontend files").textContent)
    .toContain("index.html")
  expect(calls.mock.calls.filter(([url]) => String(url).endsWith("/stage"))).toHaveLength(1)
  expect(calls.mock.calls.filter(([url]) => String(url).endsWith("/deploy"))).toHaveLength(0)
})

