import * as React from "react"
import { afterEach, expect, it, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes } from "react-router-dom"
vi.mock("@/components/layouts/base-layout", () => ({
  BaseLayout: ({ children, title, onRefresh, refreshDisabled }: {
    children: React.ReactNode; title?: string; onRefresh?: () => void; refreshDisabled?: boolean
  }) => <>
    {onRefresh && <header><button onClick={onRefresh} disabled={refreshDisabled}>Refresh</button></header>}
    <main>{title && <h1 className="sr-only">{title}</h1>}{children}</main>
  </>,
}))
import ProjectsPage from "@/app/projects/page"

const api = "/api/v1/node-projects"
const id = "node-" + "a".repeat(32)
const release = "r-" + "b".repeat(32)
const project = {
  id, name: "Workspace demo", kind: "node", state: "source-staged",
  runtime: "not-provisioned", activeRelease: null, candidateRelease: release,
  previousCandidate: null, deploymentCount: 1, createdAt: "2026-11-25T12:00:00Z",
}
afterEach(() => vi.unstubAllGlobals())

function setup(path = "/projects", candidateRelease = release) {
  let running = false
  const runtime = () => ({
    state: running ? "running" : "stopped", desired: running ? "running" : "stopped",
    port: 19300, activeRelease: release, lastGoodRelease: release,
    previousGoodRelease: null, history: [],
  })
  const requests = vi.fn(async (url: RequestInfo | URL, options?: RequestInit) => {
    const endpoint = String(url)
    const ok = (value: unknown) => ({ ok: true, json: async () => value })
    if (endpoint === api) return ok({ accessMode: "trusted-lan", projects: [{ ...project, candidateRelease }] })
    if (endpoint === api + "/" + id + "/runtime") return ok({ runtime: runtime(), executionEnabled: true })
    if (endpoint === api + "/" + id + "/plan") return ok({
      executionEnabled: true, plan: { release, allowed: true, missingTools: [], conflicts: [], reason: "ready" },
    })
    if (endpoint === api + "/" + id + "/releases") return ok({ releases: [] })
    if (endpoint === api + "/" + id + "/health") return ok({ health: { state: runtime().state, release, ready: running } })
    if (endpoint === api + "/" + id + "/start" && options?.method === "POST") {
      expect(JSON.parse(String(options.body))).toEqual({ approved: true })
      running = true
      return ok({ runtime: runtime() })
    }
    throw new Error("Unexpected endpoint " + endpoint)
  })
  vi.stubGlobal("fetch", requests)
  render(<MemoryRouter initialEntries={[path]}><Routes>
    <Route path="/projects" element={<ProjectsPage />}>
      <Route index element={<></>} />
      <Route path="new" element={<></>} />
      <Route path="backups" element={<></>} />
      <Route path="diagnostics" element={<></>} />
      <Route path=":id" element={<></>} />
    </Route>
  </Routes></MemoryRouter>)
  return requests
}

it("separates the catalog, create screen and application workspace tabs", async () => {
  setup()
  const user = userEvent.setup()
  await screen.findByRole("button", { name: "Workspace demo" })
  expect(screen.queryByLabelText("Project name")).toBeNull()
  const catalog = screen.getByRole("region", { name: "Node.js applications" })
  expect(catalog.contains(screen.getByRole("button", { name: "Add application" }))).toBe(true)
  expect(screen.getByRole("heading", { level: 1 }).classList.contains("sr-only")).toBe(true)
  expect(screen.getAllByRole("button", { name: "Refresh" })).toHaveLength(1)
  expect(screen.getByRole("button", { name: "Refresh" }).closest("header")).toBeTruthy()
  await user.click(screen.getByRole("button", { name: "Add application" }))
  await screen.findByRole("heading", { name: "Add Node.js application" })
  expect(screen.getByLabelText("Project name")).toBeTruthy()
  const create = screen.getByRole("region", { name: "Create Node.js project" })
  expect(create.contains(screen.getByLabelText("Project name"))).toBe(true)
  expect(create.contains(screen.getByRole("button", { name: "Applications" }))).toBe(true)
  expect(screen.getByRole("heading", { level: 1 }).classList.contains("sr-only")).toBe(true)
  expect(screen.getAllByRole("button", { name: "Refresh" })).toHaveLength(1)
  expect(screen.getByRole("button", { name: "Refresh" }).closest("header")).toBeTruthy()
  expect(screen.queryByRole("button", { name: "Workspace demo" })).toBeNull()
  await user.click(screen.getByRole("button", { name: "Applications" }))
  await user.click(await screen.findByRole("button", { name: "Workspace demo" }))
  await screen.findByRole("heading", { name: "Workspace demo" })
  await screen.findByRole("button", { name: "Start", exact: true })
  const sections = screen.getByRole("tablist", { name: "Application sections" })
  expect(sections.classList.contains("group-data-horizontal/tabs:h-auto")).toBe(true)
  expect(sections.getAttribute("data-variant")).toBe("default")
  expect(screen.getAllByRole("tab")).toHaveLength(8)
  expect(screen.queryByLabelText("Project name")).toBeNull()
  expect(screen.queryByRole("button", { name: "Delete project" })).toBeNull()
  await user.click(screen.getByRole("tab", { name: "Source" }))
  expect(await screen.findByLabelText("Public GitHub repository")).toBeTruthy()
  await user.click(screen.getByRole("tab", { name: "Settings" }))
  expect(screen.queryByLabelText("Public GitHub repository")).toBeNull()
  expect(await screen.findByRole("button", { name: /Delete project/i })).toBeTruthy()
})

it("rejects unknown IDs without inspecting another application", async () => {
  const requests = setup("/projects/node-" + "c".repeat(32))
  await screen.findByRole("alert", { name: "" })
  expect(screen.getByText("Application not found.")).toBeTruthy()
  expect(requests.mock.calls.map(([url]) => String(url))).toEqual([api])
})

it("keeps legacy deep links and confirms lifecycle mutations at the action", async () => {
  const requests = setup("/projects?project=" + id)
  const user = userEvent.setup()
  const confirm = vi.fn(() => false)
  vi.stubGlobal("confirm", confirm)
  await screen.findByRole("heading", { name: "Workspace demo" })
  await user.click(await screen.findByRole("button", { name: "Start", exact: true }))
  expect(confirm).toHaveBeenCalledTimes(1)
  expect(requests.mock.calls.filter(([, options]) => options?.method === "POST")).toHaveLength(0)
  confirm.mockReturnValue(true)
  await user.click(screen.getByRole("button", { name: "Start", exact: true }))
  await waitFor(() => expect(screen.getByRole("button", { name: "Stop", exact: true })).toBeTruthy())
  expect(requests.mock.calls.filter(([, options]) => options?.method === "POST")).toHaveLength(1)
})

it("keeps the Node approval target comfortably clickable without invoking a mutation", async () => {
  const requests = setup("/projects/" + id, "r-" + "c".repeat(32))
  const user = userEvent.setup()
  const approval = await screen.findByRole("checkbox", { name: "Approve local Node execution" }) as HTMLInputElement
  const label = approval.closest("label")
  expect(label?.classList.contains("min-h-11")).toBe(true)
  expect(approval.classList.contains("size-4")).toBe(true)
  expect(approval.checked).toBe(false)
  await user.click(screen.getByText("Approve running this trusted application."))
  expect(approval.checked).toBe(true)
  await user.click(screen.getByText("Approve running this trusted application."))
  expect(approval.checked).toBe(false)
  expect(requests.mock.calls.filter(([, options]) => options?.method === "POST")).toHaveLength(0)
})
