import * as React from "react"
import { afterEach, expect, it, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"

vi.mock("@/components/layouts/base-layout", () => ({
  BaseLayout: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}))

import ProjectsPage from "./helpers/node-project-workflow-harness"

const api = "/api/v1/node-projects"
const id = "node-" + "a".repeat(32)
const release = "r-" + "b".repeat(32)
const project = {
  id, name: "Demo fixture", kind: "node", state: "source-staged",
  runtime: "not-provisioned", activeRelease: null, candidateRelease: release,
  previousCandidate: null, deploymentCount: 1, createdAt: "2026-11-25T00:00:00Z",
}

afterEach(() => vi.unstubAllGlobals())

function setup(mode: string, state: "stopped" | "running" | "unknown", removalOK = true, drift = false) {
  let present = true
  let desired = state === "running" || drift ? "running" : "stopped"
  const requests = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    if (url === api) return { ok: true, json: async () => ({ accessMode: mode, projects: present ? [project] : [] }) }
    if (url === api + "/" + id + "/runtime") return { ok: true, json: async () => ({
      runtime: { state, desired, port: 19301,
        activeRelease: release, lastGoodRelease: release, previousGoodRelease: null, history: [] },
      executionEnabled: true,
    }) }
    if (url === api + "/" + id + "/plan") return { ok: true, json: async () => ({
      plan: { release, allowed: true, missingTools: [], conflicts: [], reason: "ready" }, executionEnabled: true,
    }) }
    if (url === api + "/" + id + "/releases") return { ok: true, json: async () => ({ releases: [] }) }
    if (url === api + "/" + id + "/stop" && init?.method === "POST") {
      desired = "stopped"
      return { ok: true, json: async () => ({ runtime: { state: "stopped", desired, activeRelease: release } }) }
    }
    if (url === api + "/" + id + "/remove" && init?.method === "POST") {
      if (!removalOK) return { ok: false, status: 503 }
      present = false
      return { ok: true, json: async () => ({ removed: true, id, filesRetained: true }) }
    }
    return { ok: false, status: 404 }
  })
  vi.stubGlobal("fetch", requests)
  vi.stubGlobal("confirm", vi.fn(() => true))
  render(<MemoryRouter><ProjectsPage /></MemoryRouter>)
  return requests
}

it("trusted mode removes a stopped project after exact host readback without a token", async () => {
  const user = userEvent.setup()
  const calls = setup("trusted-lan", "stopped")
  await screen.findByText("Trusted LAN · Node management enabled without a token.")
  expect(screen.queryByLabelText("Node owner token")).toBeNull()
  await user.click(await screen.findByRole("button", { name: project.name }))
  const remove = await screen.findByRole("button", { name: "Delete project" })
  await waitFor(() => expect((remove as HTMLButtonElement).disabled).toBe(false))
  await user.click(remove)
  await screen.findByText("Project removed. Source, data and logs retained.")
  expect(screen.queryByRole("button", { name: project.name })).toBeNull()
  const posts = calls.mock.calls.filter(([, init]) => init?.method === "POST")
  expect(posts).toHaveLength(1)
  expect(JSON.parse(String(posts[0][1]?.body))).toEqual({
    approved: true, expectedRevision: 1, expectedCandidate: release, expectedActiveRelease: release,
  })
  expect((posts[0][1]?.headers as Record<string, string>)["X-PocketHost-Node-Owner"]).toBeUndefined()
})

it.each(["running", "unknown"] as const)("blocks deletion of %s runtime", async state => {
  const user = userEvent.setup()
  const calls = setup("trusted-lan", state)
  await user.click(await screen.findByRole("button", { name: project.name }))
  expect((await screen.findByRole("button", { name: "Delete project" }) as HTMLButtonElement).disabled).toBe(true)
  expect(calls.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(0)
})

it("protected mode still requires the owner token to delete", async () => {
  const user = userEvent.setup()
  const calls = setup("protected", "stopped")
  await user.click(await screen.findByRole("button", { name: project.name }))
  expect(screen.getByLabelText("Node owner token")).toBeTruthy()
  expect((await screen.findByRole("button", { name: "Delete project" }) as HTMLButtonElement).disabled).toBe(true)
  expect(calls.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(0)
})

it("uncertain deletion hides stale controls and requires refresh", async () => {
  const user = userEvent.setup()
  const calls = setup("trusted-lan", "stopped", false)
  await user.click(await screen.findByRole("button", { name: project.name }))
  const remove = await screen.findByRole("button", { name: "Delete project" })
  await waitFor(() => expect((remove as HTMLButtonElement).disabled).toBe(false))
  await user.click(remove)
  await screen.findByText("Removal unconfirmed. Refresh before another operation.")
  expect(screen.queryByRole("button", { name: "Delete project" })).toBeNull()
  expect(calls.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(1)
})

it("reconciles a stopped process with running desired state before enabling start and removal", async () => {
  const user = userEvent.setup()
  const calls = setup("trusted-lan", "stopped", true, true)
  await user.click(await screen.findByRole("button", { name: project.name }))
  const confirmStop = await screen.findByRole("button", { name: "Confirm stopped state" })
  const remove = screen.getByRole("button", { name: "Delete project" }) as HTMLButtonElement
  expect(remove.disabled).toBe(true)
  expect((confirmStop as HTMLButtonElement).disabled).toBe(true)
  await user.click(screen.getByLabelText("Approve local Node execution"))
  await user.click(confirmStop)
  await screen.findByText("Owned Node service stopped.")
  await waitFor(() => expect(remove.disabled).toBe(false))
  await user.click(screen.getByLabelText("Approve local Node execution"))
  expect((screen.getByRole("button", { name: "Start stopped service" }) as HTMLButtonElement).disabled).toBe(false)
  await user.click(remove)
  await screen.findByText("Project removed. Source, data and logs retained.")
  expect(calls.mock.calls.filter(([, init]) => init?.method === "POST").map(([url]) => String(url).split("/").at(-1))).toEqual(["stop", "remove"])
})
