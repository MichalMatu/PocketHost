import { afterEach, expect, it } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"
import { NodeProjectLogFeedback } from "@/app/projects/node-project-log-feedback"

afterEach(() => cleanup())

const raw = "2026-11-22_15:05:00.123456 [NODE] literal source entry"

it("distinguishes never checked from a confirmed empty log snapshot", () => {
  const props = { lines: [], loading: false, error: null, checked: false }
  const view = render(<NodeProjectLogFeedback {...props} />)
  expect(screen.queryByText(/No owned Node runtime log lines/)).toBeNull()
  view.rerender(<NodeProjectLogFeedback {...props} checked />)
  expect(screen.getByRole("status").textContent).toContain("No owned Node runtime log lines")
  expect(screen.queryByLabelText("Node runit logs")).toBeNull()
})

it("preserves source text and order and shows loading/error instead of old lines", () => {
  const props = { lines: [raw, "second original line"], loading: false, error: null, checked: true }
  const view = render(<NodeProjectLogFeedback {...props} />)
  expect(screen.getByLabelText("Node runit logs").textContent).toBe(raw + "\nsecond original line")
  view.rerender(<NodeProjectLogFeedback {...props} loading />)
  expect(screen.getByText("Reading Node logs for selected project…")).toBeTruthy()
  expect(screen.queryByLabelText("Node runit logs")).toBeNull()
  view.rerender(<NodeProjectLogFeedback {...props} loading={false} error="Read failed" />)
  expect(screen.getByRole("alert").textContent).toBe("Read failed")
  expect(screen.queryByLabelText("Node runit logs")).toBeNull()
})
