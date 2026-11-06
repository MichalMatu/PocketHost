import * as React from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"

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
  url: "http://127.0.0.1:18787",
  contentVersion: 1,
  previousVersion: null,
  canRollback: false,
})

function renderWithSite(site: ReturnType<typeof ownedSite> | null, enabled = true) {
  const fetchMock = vi.fn(async () => ({
    ok: true,
    json: async () => ({ enabled, site }),
  }))
  vi.stubGlobal("fetch", fetchMock)
  render(<OwnedSitePage />)
  return fetchMock
}

afterEach(() => vi.unstubAllGlobals())

describe("owned-site keyboard and action semantics", () => {
  it("has an accessible version selector and disables no-op publication and rollback", async () => {
    renderWithSite(ownedSite())
    await screen.findByText("PocketHost local demo")

    expect(screen.getByRole("combobox", { name: "Target version" })).toBeTruthy()
    expect(
      (screen.getByRole("button", { name: "Publish selected version" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true)
    expect(
      (screen.getByRole("button", { name: "Rollback version" }) as HTMLButtonElement).disabled,
    ).toBe(true)
  })

  it("does not render mutating controls while the demo is disabled", async () => {
    renderWithSite(null, false)
    await screen.findByText(/disabled/i)
    expect(screen.queryByRole("button", { name: "Publish selected version" })).toBeNull()
    expect(screen.queryByRole("button", { name: "Rollback version" })).toBeNull()
    expect(screen.queryByRole("button", { name: "Start site" })).toBeNull()
  })

  it("blocks controls and exposes an alert if the owned process is unknown", async () => {
    renderWithSite({ ...ownedSite(), state: "unknown" })
    expect(await screen.findByRole("alert")).toHaveProperty("textContent")
    expect(screen.queryByRole("button", { name: "Publish selected version" })).toBeNull()
    expect(
      (screen.getByRole("button", { name: "Rollback version" }) as HTMLButtonElement).disabled,
    ).toBe(true)
    expect(screen.queryByRole("button", { name: "Stop site" })).toBeNull()
  })
})
