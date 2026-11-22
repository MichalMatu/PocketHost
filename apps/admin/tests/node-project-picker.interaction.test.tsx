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
  expect(screen.getByText("Owned projects")).toBeTruthy()
  const buttons = screen.getAllByRole("button")
  expect(buttons.map(button => button.textContent)).toEqual(["First Node", "Second Node"])
  const user = userEvent.setup()
  await user.click(screen.getByRole("button", { name: "Second Node" }))
  expect(onSelect).toHaveBeenCalledTimes(1)
  expect(onSelect).toHaveBeenCalledWith(projects[1])
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
