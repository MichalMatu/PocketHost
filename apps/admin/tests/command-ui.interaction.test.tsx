import { render, screen } from "@testing-library/react"
import { expect, it } from "vitest"
import {
  Command,
  CommandDialog,
  CommandInput,
} from "@/components/ui/command"

it("uses shared dialog and input-group geometry without redundant important overrides", async () => {
  const { container } = render(
    <CommandDialog open onOpenChange={() => {}}>
      <Command>
        <CommandInput placeholder="Search commands" />
      </Command>
    </CommandDialog>
  )

  const dialog = await screen.findByRole("dialog")
  const command = container.querySelector('[data-slot="command"]')
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
})
