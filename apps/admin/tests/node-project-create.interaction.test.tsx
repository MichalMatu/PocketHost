import * as React from "react"
import { afterEach, expect, it, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"

vi.mock("@/components/layouts/base-layout", () => ({
  BaseLayout: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}))
import ProjectsPage from "@/app/projects/page"

const ownerToken = "A".repeat(40)
const created = {
  id: "node-" + "a".repeat(32), name: "New Node", kind: "node", state: "created",
  runtime: "not-provisioned", activeRelease: null, candidateRelease: null,
  previousCandidate: null, deploymentCount: 0, createdAt: "2026-11-22T10:00:00Z",
}
afterEach(() => vi.unstubAllGlobals())

async function unlock() {
  const user = userEvent.setup()
  await screen.findByText("No Node projects yet.")
  const createPanel = document.querySelector<HTMLDetailsElement>('details[data-testid="node-create-panel"]')
  if (!createPanel) throw new Error("Missing Node project creation panel")
  createPanel.open = true
  await user.type(screen.getByLabelText("Node owner token"), ownerToken)
  await user.click(screen.getByRole("button", { name: "Unlock management" }))
  await screen.findByText("Owner authenticated for Node management.")
  await user.type(screen.getByLabelText("Project name"), "New Node")
  return user
}
it("locks a lost create reply until explicit catalog Refresh and prevents double POST", async () => {
  let rejectPost: ((reason: Error) => void) | undefined
  let reads = 0
  const requests = vi.fn(async (url: RequestInfo | URL, options?: RequestInit) => {
    if (String(url) === "/api/v1/node-projects/owner-session")
      return { ok: true, json: async () => ({ configured: true, authorized: true }) }
    if (String(url) === "/api/v1/node-projects" && !options?.method) {
      reads++
      return { ok: true, json: async () => ({ projects: [] }) }
    }
    if (String(url) === "/api/v1/node-projects/" && options?.method === "POST")
      return new Promise((_, reject) => { rejectPost = reject })
    throw new Error("Unexpected endpoint " + String(url))
  })
  vi.stubGlobal("fetch", requests)
  render(<MemoryRouter><ProjectsPage /></MemoryRouter>)
  const user = await unlock()
  const create = screen.getByRole("button", { name: "Create project" }) as HTMLButtonElement
  fireEvent.click(create)
  fireEvent.click(create)
  await screen.findByText(/Do not submit again while the host processes/)
  expect(create.disabled).toBe(true)
  expect(requests.mock.calls.filter(([url, opts]) =>
    String(url).endsWith("/node-projects/") && opts?.method === "POST")).toHaveLength(1)
  rejectPost?.(new Error("lost reply"))
  await screen.findByText("Project creation unconfirmed. Refresh the catalog before another create.")
  expect(create.disabled).toBe(true)
  await user.clear(screen.getByLabelText("Project name"))
  await user.type(screen.getByLabelText("Project name"), "Another Node")
  expect(create.disabled).toBe(true)
  await user.click(screen.getByRole("button", { name: "Refresh" }))
  await screen.findByText("Catalog refreshed. Check existing projects before creating another.")
  expect(reads).toBe(2)
  expect(create.disabled).toBe(false)
})
it("permits correcting a definite host name validation refusal", async () => {
  const requests = vi.fn(async (url: RequestInfo | URL, options?: RequestInit) => {
    if (String(url) === "/api/v1/node-projects/owner-session")
      return { ok: true, json: async () => ({ configured: true, authorized: true }) }
    if (String(url) === "/api/v1/node-projects" && !options?.method)
      return { ok: true, json: async () => ({ projects: [] }) }
    if (String(url) === "/api/v1/node-projects/" && options?.method === "POST")
      return { ok: false, status: 400 }
    throw new Error("Unexpected endpoint " + String(url))
  })
  vi.stubGlobal("fetch", requests)
  render(<MemoryRouter><ProjectsPage /></MemoryRouter>)
  const user = await unlock()
  await user.click(screen.getByRole("button", { name: "Create project" }))
  await screen.findByText("Project name rejected by the host. Review the name and try again.")
  expect(screen.getByText("Project name was rejected. Correct the name before trying again.")).toBeTruthy()
  expect((screen.getByRole("button", { name: "Create project" }) as HTMLButtonElement).disabled).toBe(false)
})
it("refuses an acknowledged creation missing from GET catalog readback", async () => {
  let reads = 0
  const requests = vi.fn(async (url: RequestInfo | URL, options?: RequestInit) => {
    if (String(url) === "/api/v1/node-projects/owner-session")
      return { ok: true, json: async () => ({ configured: true, authorized: true }) }
    if (String(url) === "/api/v1/node-projects" && !options?.method) {
      reads++
      return { ok: true, json: async () => ({ projects: [] }) }
    }
    if (String(url) === "/api/v1/node-projects/" && options?.method === "POST")
      return { ok: true, json: async () => ({ project: created }) }
    throw new Error("Unexpected endpoint " + String(url))
  })
  vi.stubGlobal("fetch", requests)
  render(<MemoryRouter><ProjectsPage /></MemoryRouter>)
  const user = await unlock()
  await user.click(screen.getByRole("button", { name: "Create project" }))
  await screen.findByText("Project creation unconfirmed. Refresh the catalog before another create.")
  expect(reads).toBe(2)
  expect(screen.queryByText("Private Node project created.")).toBeNull()
  expect((screen.getByRole("button", { name: "Create project" }) as HTMLButtonElement).disabled).toBe(true)
})
