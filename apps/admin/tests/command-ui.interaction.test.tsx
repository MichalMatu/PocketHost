import { render, screen } from "@testing-library/react"
import { expect, it } from "vitest"
import {
  Command,
  CommandDialog,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"

it("uses shared dialog and input-group geometry without redundant important overrides", async () => {
  render(
    <CommandDialog open onOpenChange={() => {}}>
      <Command>
        <CommandInput placeholder="Search commands" />
        <CommandList>
          <CommandItem value="dashboard">Dashboard</CommandItem>
        </CommandList>
      </Command>
    </CommandDialog>
  )

  const dialog = await screen.findByRole("dialog")
  const command = dialog.querySelector('[data-slot="command"]')
  const input = screen.getByPlaceholderText("Search commands")
  const group = input.closest('[data-slot="input-group"]')
  const addon = group?.querySelector('[data-slot="input-group-addon"]')

  expect(dialog.classList.contains("rounded-xl")).toBe(true)
  expect(dialog.className.includes("rounded-xl!")).toBe(false)
  expect(command?.classList.contains("rounded-xl")).toBe(true)
  expect(command?.className.includes("rounded-xl!")).toBe(false)
  expect(group?.classList.contains("h-8")).toBe(true)
  expect(group?.classList.contains("rounded-lg")).toBe(true)
  expect(group?.className.includes("!")).toBe(false)
  expect(addon?.classList.contains("pl-2")).toBe(true)
  const item = await screen.findByText("Dashboard")
  const option = item.closest('[data-slot="command-item"]')
  expect(option?.classList.contains("rounded-sm")).toBe(true)
  expect(option?.classList.contains("in-data-[slot=dialog-content]:rounded-lg")).toBe(true)
  expect(option?.className.includes("!")).toBe(false)
})
