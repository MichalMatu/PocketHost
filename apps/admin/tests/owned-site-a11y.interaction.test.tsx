import * as React from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"

vi.mock("@/components/layouts/base-layout", () => ({
  BaseLayout: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}))

import OwnedSitePage from "@/app/owned-site/page"

const ownedSite = () => ({
  version: 1,
  id: "pockethost-demo",
  ownership: "pockethost",
  state: "running",
  port: 18787,
  url: "http://127.0.0.1:18787/",
  contentVersion: 1,
  previousVersion: null,
  canRollback: false,
})

const project = () => ({
  id: "pockethost-demo",
  name: "PocketHost Demo",
  description: "Isolated and manually operated test application",
  type: "static-html",
  dataDirectory: "PocketHost-OwnedSites/pockethost-demo",
  state: "running",
  port: 18787,
  url: "http://127.0.0.1:18787/",
  contentVersion: 1,
  previousVersion: null,
  pid: 1234,
  startTicks: "1234567",
  history: [{ at: "2026-11-07T05:00:00.000Z", action: "create", from: null, to: 1 }],
})

function renderWithSite(
  site: ReturnType<typeof ownedSite> | null,
  enabled = true,
) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input)
    const data = url.endsWith("/project")
      ? { project: { ...project(), state: site?.state ?? "absent",
          pid: site?.state === "running" ? 1234 : null,
          startTicks: site?.state === "running" ? "1234567" : null } }
      : url.endsWith("/health")
        ? { healthy: site?.state === "running" }
        : url.endsWith("/logs")
          ? { logs: ["Owned demo active"] }
          : { enabled, site }
    return { ok: true, json: async () => data }
  })
  vi.stubGlobal("fetch", fetchMock)
  render(
    <MemoryRouter>
      <OwnedSitePage />
    </MemoryRouter>,
  )
  return fetchMock
}

afterEach(() => vi.unstubAllGlobals())

describe("H1 owned-site accessible actions and state semantics", () => {
  it("has an accessible release selector, disables no-op publish and exhausted rollback", async () => {
    renderWithSite(ownedSite())
    await screen.findByText("PocketHost Demo")

    expect(screen.getByRole("combobox", { name: "Target release" })).toBeTruthy()
    expect((screen.getByRole("button", { name: "Publish" }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole("button", { name: "Rollback" }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByRole("button", { name: "Restart" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "Stop" })).toBeTruthy()
  })

  it("does not show mutating controls when the owned adapter is disabled", async () => {
    renderWithSite(null, false)
    await screen.findByText("Project controls unavailable")
    expect(screen.queryByRole("button", { name: "Publish" })).toBeNull()
    expect(screen.queryByRole("button", { name: "Rollback" })).toBeNull()
    expect(screen.queryByRole("button", { name: "Start" })).toBeNull()
  })

  it("blocks controls and explains failed process identity verification", async () => {
    renderWithSite({ ...ownedSite(), state: "unknown" })
    const alert = await screen.findByRole("alert")
    expect(alert.textContent).toContain("Process ownership is uncertain")
    expect(screen.queryByRole("button", { name: "Publish" })).toBeNull()
    expect((screen.getByRole("button", { name: "Rollback" }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.queryByRole("button", { name: "Restart" })).toBeNull()
    expect(screen.queryByRole("button", { name: "Stop" })).toBeNull()
  })
})
