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
      expect(envelope.packageJson.scripts.start).toBe("node server.mjs")
      const project = { ...(projects[0] as Record<string, unknown>), state: "source-staged",
        candidateRelease: RELEASE, deploymentCount: 1 }
      projects = [project]
      releases = [{ id: RELEASE, active: false, candidate: true, previousCandidate: false,
        dependencyPlan: { packageName: "my-node-site", packageVersion: "1.0.0", dependencyCount: 0, status: "review-required" } }]
      return { ok: true, json: async () => ({ project }) }
    }
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
  await user.type(screen.getByLabelText("Project name"), "My node")
  await user.click(screen.getByRole("button", { name: "Create project" }))
  await screen.findByText("Private Node project created.")
  await user.click(screen.getByRole("button", { name: "Validate and stage source" }))
  await screen.findByText("Source candidate staged. Review the execution plan before deploying.")
  expect(screen.getByText(/Runtime: not-provisioned/)).toBeTruthy()
  expect(screen.getByRole("button", { name: "Deploy selected release" }).hasAttribute("disabled")).toBe(true)
  expect(screen.getByRole("button", { name: "Rollback active release" }).hasAttribute("disabled")).toBe(true)
  expect(calls.mock.calls.some(call => String(call[0]).includes("/start"))).toBe(false)
})
