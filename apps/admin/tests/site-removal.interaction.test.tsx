import * as React from "react"
import { afterEach, expect, it, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"

vi.mock("@/components/layouts/base-layout", () => ({
  BaseLayout: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}))
import SitesPage from "@/app/sites/page"

const id = "site-" + "a".repeat(32)
const site = {
  id, name: "Last owned site", kind: "static-site", state: "stopped", port: 19080,
  activeRelease: null, previousRelease: null, canRollback: false, pid: null, startTicks: null,
  fileCount: 0, bytes: 0, releases: 0, memoryBytes: null, uptimeSeconds: null,
  healthy: null, history: [],
}
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function setup(mode: "success" | "uncertain" | "running" | "stale" = "success") {
  let sites: Record<string, unknown>[] = [mode === "running" ? {
    ...site, state: "running", activeRelease: "r-" + "b".repeat(32),
    releases: 1, pid: 123, startTicks: "456", uptimeSeconds: 1,
  } : site]
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(true)
  const requests = vi.fn(async (input: RequestInfo | URL, options?: RequestInit) => {
    if (String(input) === "/api/v1/sites" && !options?.method)
      return { ok: true, json: async () => ({ sites }) }
    if (String(input) === "/api/v1/sites/" + id && options?.method === "DELETE") {
      expect(options.headers).toMatchObject({ "X-PocketHost-Intent": "owned-sites" })
      expect(JSON.parse(String(options.body))).toEqual({ activeRelease: null, releases: 0 })
      if (mode === "uncertain") return { ok: false, status: 409 }
      if (mode !== "stale") sites = []
      return { ok: true, json: async () => ({ deleted: id }) }
    }
    throw new Error("Unexpected request")
  })
  vi.stubGlobal("fetch", requests)
  render(<MemoryRouter initialEntries={["/sites?site=" + id]}><SitesPage /></MemoryRouter>)
  return { requests, confirm }
}

it("removes the final site only after confirmation and inventory readback", async () => {
  const { requests, confirm } = setup()
  const user = userEvent.setup()
  await screen.findByRole("button", { name: "Delete site" })
  confirm.mockReturnValueOnce(false)
  await user.click(screen.getByRole("button", { name: "Delete site" }))
  expect(requests.mock.calls.filter(([, opts]) => opts?.method === "DELETE")).toHaveLength(0)
  await user.click(screen.getByRole("button", { name: "Delete site" }))
  await screen.findByText("No static sites yet.")
  expect(screen.queryByRole("button", { name: "Delete site" })).toBeNull()
  await waitFor(() => expect(screen.queryByText("Website details")).toBeNull())
  expect(requests.mock.calls.filter(([, opts]) => opts?.method === "DELETE")).toHaveLength(1)
})

it("disables deletion for a running site", async () => {
  const { requests } = setup("running")
  const button = await screen.findByRole("button", { name: "Delete site" }) as HTMLButtonElement
  expect(button.disabled).toBe(true)
  expect(requests.mock.calls.every(([, opts]) => !opts?.method)).toBe(true)
})

it.each(["uncertain", "stale"] as const)("blocks writes after %s removal", async mode => {
  const { requests } = setup(mode)
  const user = userEvent.setup()
  await user.click(await screen.findByRole("button", { name: "Delete site" }))
  await screen.findByText("Site removal unconfirmed. Refresh the owned inventory before retrying.")
  await waitFor(() => {
    const button = screen.queryByRole("button", { name: "Delete site" }) as HTMLButtonElement | null
    expect(!button || button.disabled).toBe(true)
  })
  expect(requests.mock.calls.filter(([, opts]) => opts?.method === "DELETE")).toHaveLength(1)
})
