import * as React from "react"
import { act, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createMemoryRouter, RouterProvider } from "react-router-dom"
import { afterEach, beforeAll, expect, it, vi } from "vitest"
import { routes } from "@/config/routes"

vi.mock("@/components/layouts/base-layout", () => ({
  BaseLayout: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}))

const first = {
  id: "site-" + "a".repeat(32), name: "First website", kind: "static-site", state: "stopped",
  port: 19080, activeRelease: null, previousRelease: null, canRollback: false,
  pid: null, startTicks: null, fileCount: 0, bytes: 0, releases: 0,
  memoryBytes: null, uptimeSeconds: null, healthy: null, history: [],
}
const second = { ...first, id: "site-" + "b".repeat(32), name: "Second website", port: 19081 }

// Keep the real lazy route configuration but pre-load its module outside the
// DOM query's 1-second timeout on the resource-constrained A8.
beforeAll(async () => {
  await import("@/app/sites/page")
}, 30_000)

afterEach(() => vi.unstubAllGlobals())

function mount(path: string) {
  const router = createMemoryRouter(routes.filter(route => route.path?.startsWith("/sites")), {
    initialEntries: [path],
  })
  render(<RouterProvider router={router} />)
  return router
}

it("separates the catalog, creation and one owned site's controls", async () => {
  const user = userEvent.setup()
  const fetcher = vi.fn(async (url: RequestInfo | URL) => String(url) === "/api/v1/sites"
    ? { ok: true, json: async () => ({ sites: [first, second] }) } : { ok: false, status: 404 })
  vi.stubGlobal("fetch", fetcher)
  const router = mount("/sites")
  const firstLink = await screen.findByRole("link", { name: first.name }, { timeout: 5000 })
  expect(screen.getByRole("link", { name: second.name })).toBeTruthy()
  expect(screen.queryByLabelText("Site name")).toBeNull()
  expect(screen.queryByRole("button", { name: "Delete site" })).toBeNull()
  expect(fetcher.mock.calls.map(([url]) => String(url))).toEqual(["/api/v1/sites"])
  await user.click(firstLink)
  await screen.findByRole("button", { name: "Delete site" })
  expect(router.state.location.pathname).toBe("/sites/" + first.id)
  expect(screen.queryByText(second.name)).toBeNull()
  expect(screen.queryByLabelText("Site name")).toBeNull()
  await user.click(screen.getByRole("button", { name: "Show all sites" }))
  await screen.findByRole("link", { name: second.name })
  await user.click(screen.getByRole("button", { name: "Add website" }))
  await screen.findByLabelText("Site name")
  expect(router.state.location.pathname).toBe("/sites/new")
  expect(screen.queryByRole("button", { name: "Delete site" })).toBeNull()
  expect(screen.queryByText(first.name)).toBeNull()
  expect(screen.getByText("2 of 8 sites registered.")).toBeTruthy()
})

it.each(["/sites/not-owned", "/sites?site=not-owned"])("never falls back to another site for %s", async path => {
  vi.stubGlobal("fetch", vi.fn(async (url: RequestInfo | URL) => String(url) === "/api/v1/sites"
    ? { ok: true, json: async () => ({ sites: [first] }) } : { ok: false, status: 404 }))
  mount(path)
  expect(await screen.findByText("This static site was not found in the owned inventory.", {}, { timeout: 5000 })).toBeTruthy()
  expect(screen.queryByText(first.name)).toBeNull()
  expect(screen.queryByRole("button", { name: "Delete site" })).toBeNull()
  expect(screen.queryByLabelText("Site name")).toBeNull()
})

it("preserves the creation latch across navigation within Static Hosting", async () => {
  const user = userEvent.setup()
  let finish!: () => void
  let created = false
  const pending = new Promise<void>(resolve => { finish = resolve })
  const fetcher = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    if (String(url) === "/api/v1/sites/" && init?.method === "POST") {
      await pending
      created = true
      return { ok: true, json: async () => ({ site: first }) }
    }
    if (String(url) === "/api/v1/sites")
      return { ok: true, json: async () => ({ sites: created ? [first] : [] }) }
    return { ok: false, status: 404 }
  })
  vi.stubGlobal("fetch", fetcher)
  const router = mount("/sites/new")
  await screen.findByText("No static sites yet.")
  await user.type(screen.getByLabelText("Site name"), first.name)
  await user.click(screen.getByRole("button", { name: "Create site" }))
  await screen.findByText("Creating site and verifying readback…")
  await act(async () => { await router.navigate("/sites") })
  expect((await screen.findByRole("button", { name: "Add website" }) as HTMLButtonElement).disabled).toBe(true)
  await act(async () => { await router.navigate("/sites/new") })
  expect((await screen.findByRole("button", { name: "Create site" }) as HTMLButtonElement).disabled).toBe(true)
  await act(async () => { finish(); await pending })
  await waitFor(() => expect(screen.queryByText("Creating site and verifying readback…")).toBeNull())
  expect(router.state.location.pathname).toBe("/sites/new")
  expect(fetcher.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(1)
})
