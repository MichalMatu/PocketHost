import * as React from "react"
import { expect, it } from "vitest"
import { render, screen, within } from "@testing-library/react"
import { NodeRuntimeHistory } from "@/app/projects/node-runtime-history"
import type { RuntimeState } from "@/app/projects/node-project-client"

type History = RuntimeState["history"]
const entry = (index: number): History[number] => ({
  at: new Date(Date.UTC(2026, 10, 22, 12, index)).toISOString(),
  action: index % 2 === 0 ? "start" : "stop",
  release: "r-" + index.toString(16).padStart(32, "0"),
})

it("hides empty runtime history instead of showing an unverified timeline", () => {
  const view = render(<NodeRuntimeHistory history={[]} />)
  expect(view.container.textContent).toBe("")
  expect(screen.queryByTestId("node-history")).toBeNull()
})

it("shows exactly the newest eight events in reverse order, with original release ids", () => {
  const history = Array.from({ length: 10 }, (_, i) => entry(i))
  render(<NodeRuntimeHistory history={history} />)
  expect(screen.getByText("Runtime history (10)")).toBeTruthy()
  const rows = within(screen.getByLabelText("Node runtime history")).getAllByRole("listitem", { hidden: true })
  expect(rows).toHaveLength(8)
  expect(rows.map(row => row.querySelector("span[title]")?.getAttribute("title")))
    .toEqual(history.slice(-8).reverse().map(item => item.release))
  expect(rows[0].textContent).toContain("stop")
  expect(rows.every(row => row.textContent?.includes("…"))).toBe(true)
})
