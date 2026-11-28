import { fireEvent, render, screen, within } from "@testing-library/react"
import { expect, it, vi } from "vitest"

vi.mock("@/components/ui/sidebar", () => ({
  SidebarTrigger: () => <button>Sidebar</button>,
}))
vi.mock("@/components/command-search", () => ({
  SearchTrigger: () => <button>Search</button>,
  CommandSearch: () => null,
}))
vi.mock("@/components/mode-toggle", () => ({
  ModeToggle: () => <button>Appearance</button>,
}))

import { SiteHeader } from "@/components/site-header"

it("exposes one shared route refresh with its disabled state", () => {
  const refresh = vi.fn()
  const common = { onCustomize: vi.fn(), onResetAppearance: vi.fn() }
  const view = render(<SiteHeader {...common} onRefresh={refresh} />)
  const button = within(screen.getByRole("banner")).getByRole("button", { name: "Refresh" })
  expect(screen.getAllByRole("button", { name: "Refresh" })).toHaveLength(1)
  expect(button.className).toContain("min-h-10")
  expect(button.className).toContain("min-w-10")
  expect(button.querySelector("svg")).toBeTruthy()
  fireEvent.click(button)
  expect(refresh).toHaveBeenCalledTimes(1)
  view.rerender(<SiteHeader {...common} onRefresh={refresh} refreshDisabled />)
  expect((screen.getByRole("button", { name: "Refresh" }) as HTMLButtonElement).disabled).toBe(true)
  fireEvent.click(screen.getByRole("button", { name: "Refresh" }))
  expect(refresh).toHaveBeenCalledTimes(1)
  view.rerender(<SiteHeader {...common} />)
  expect(screen.queryByRole("button", { name: "Refresh" })).toBeNull()
})
