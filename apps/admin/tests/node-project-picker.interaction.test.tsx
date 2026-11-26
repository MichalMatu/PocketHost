import * as React from "react"
import { expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { NodeProjectPicker } from "@/app/projects/node-project-picker"

const projects = [
  { id: "node-one", name: "First Node" },
  { id: "node-two", name: "Second Node" },
]

it("renders an empty catalog without triggering project selection", () => {
  const onSelect = vi.fn()
  render(<NodeProjectPicker projects={[]} selectedId="" busy={false} onSelect={onSelect} />)
  expect(screen.getByText("No Node projects yet.")).toBeTruthy()
  expect(screen.queryByRole("button", { name: "First Node" })).toBeNull()
  expect(onSelect).not.toHaveBeenCalled()
})

it("shows project names and delegates only the chosen item to the parent", async () => {
  const onSelect = vi.fn()
  render(<NodeProjectPicker projects={projects} selectedId="node-one" busy={false}
    onSelect={onSelect} />)
  expect(screen.getByRole("region", { name: "Owned projects" })).toBeTruthy()
  expect(screen.queryByText("Owned projects")).toBeNull()
  const buttons = screen.getAllByRole("button")
  expect(buttons.map(button => button.getAttribute("aria-label"))).toEqual(["First Node", "Second Node"])
  expect(buttons.map(button => button.textContent)).toEqual(["First NodeNo source", "Second NodeNo source"])
  expect(buttons.map(button => button.getAttribute("aria-pressed"))).toEqual(["true", "false"])
  const user = userEvent.setup()
  await user.click(screen.getByRole("button", { name: "Second Node" }))
  expect(onSelect).toHaveBeenCalledTimes(1)
  expect(onSelect).toHaveBeenCalledWith(projects[1])
})

it("updates the accessible selected project state after a catalog selection changes", () => {
  const onSelect = vi.fn()
  const { rerender } = render(<NodeProjectPicker projects={projects} selectedId="node-one"
    busy={false} onSelect={onSelect} />)
  expect(screen.getByRole("button", { name: "First Node" }).getAttribute("aria-pressed"))
    .toBe("true")
  rerender(<NodeProjectPicker projects={projects} selectedId="node-two"
    busy={false} onSelect={onSelect} />)
  expect(screen.getByRole("button", { name: "First Node" }).getAttribute("aria-pressed"))
    .toBe("false")
  expect(screen.getByRole("button", { name: "Second Node" }).getAttribute("aria-pressed"))
    .toBe("true")
  expect(onSelect).not.toHaveBeenCalled()
})

it("prevents selection while an action is busy", async () => {
  const onSelect = vi.fn()
  render(<NodeProjectPicker projects={projects} selectedId="" busy={true}
    onSelect={onSelect} />)
  const user = userEvent.setup()
  const button = screen.getByRole("button", { name: "First Node" }) as HTMLButtonElement
  expect(button.disabled).toBe(true)
  await user.click(button)
  expect(onSelect).not.toHaveBeenCalled()
})
