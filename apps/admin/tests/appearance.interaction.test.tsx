import * as React from "react"
import { describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

const theme = vi.hoisted(() => ({
  setTheme: vi.fn(),
}))

vi.mock("@/hooks/use-theme", () => ({
  useTheme: () => ({ theme: "light", setTheme: theme.setTheme }),
}))

import { ModeToggle } from "@/components/mode-toggle"
import { ThemeTab } from "@/components/theme-customizer/theme-tab"

async function menu() {
  const user = userEvent.setup()
  render(
    <ModeToggle
      onCustomize={vi.fn()}
      onResetAppearance={vi.fn()}
    />
  )
  await user.click(screen.getByRole("button", { name: "Appearance settings" }))
  return { user, popup: await screen.findByRole("menu") }
}

describe("real Base UI header appearance interaction", () => {
  it("opens a rendered menu containing a correctly grouped label and all actions", async () => {
    const { popup } = await menu()
    expect(within(popup).getByText("Appearance")).toBeTruthy()
    for (const label of ["Light", "Dark", "System", "Colors & themes", "Panel layout", "Reset appearance"]) {
      expect(within(popup).getByRole("menuitem", { name: label })).toBeTruthy()
    }
  })

  for (const [label, value] of [["Light", "light"], ["Dark", "dark"], ["System", "system"]] as const) {
    it(`changes to ${label.toLowerCase()} mode via the actual dropdown`, async () => {
      const { user, popup } = await menu()
      await user.click(within(popup).getByRole("menuitem", { name: label }))
      expect(theme.setTheme).toHaveBeenCalledWith(value)
    })
  }

  it("can reopen the menu and invoke theme/layout/reset callbacks", async () => {
    const onCustomize = vi.fn()
    const onResetAppearance = vi.fn()
    const user = userEvent.setup()
    render(<ModeToggle onCustomize={onCustomize} onResetAppearance={onResetAppearance} />)
    const trigger = screen.getByRole("button", { name: "Appearance settings" })
    for (const [item, tab] of [["Colors & themes", "theme"], ["Panel layout", "layout"]] as const) {
      await user.click(trigger)
      const popup = await screen.findByRole("menu")
      await user.click(within(popup).getByRole("menuitem", { name: item }))
      expect(onCustomize).toHaveBeenCalledWith(tab)
    }
    await user.click(trigger)
    const popup = await screen.findByRole("menu")
    await user.click(within(popup).getByRole("menuitem", { name: "Reset appearance" }))
    expect(onResetAppearance).toHaveBeenCalledTimes(1)
  })

  it("retains the upstream landing quick color switch", async () => {
    render(<ModeToggle variant="ghost" />)
    fireEvent.click(screen.getByRole("button", { name: "Switch color mode" }))
    expect(theme.setTheme).toHaveBeenCalledWith("dark")
  })
})

it("selects dark mode directly from the theme customization tab", () => {
  render(
    <ThemeTab
      selectedTheme=""
      setSelectedTheme={vi.fn()}
      selectedTweakcnTheme=""
      setSelectedTweakcnTheme={vi.fn()}
      selectedRadius="0.5rem"
      setSelectedRadius={vi.fn()}
      setImportedTheme={vi.fn()}
      onImportClick={vi.fn()}
    />
  )
  theme.setTheme.mockClear()
  fireEvent.click(screen.getByRole("button", { name: "Light" }))
  expect(theme.setTheme).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole("button", { name: "Dark" }))
  expect(theme.setTheme).toHaveBeenCalledWith("dark")
})
