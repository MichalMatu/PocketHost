import * as React from "react"
import { afterEach, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { NodeReleaseInventory } from "@/app/projects/node-release-inventory"
import type { Candidate } from "@/app/projects/node-project-client"

afterEach(() => cleanup())

const release = (id: string, candidate: boolean, legacy = false): Candidate => ({
  id,
  active: false,
  candidate,
  previousCandidate: false,
  sourceIntegrity: legacy ? "legacy-needs-restaging" : "verified",
  dependencyPlan: {
    packageName: "sample",
    packageVersion: "1.0.0",
    dependencyCount: 2,
    status: "review-required",
  },
})

const first = "r-" + "a".repeat(32)
const second = "r-" + "b".repeat(32)

const defaults = {
  releases: [] as Candidate[],
  loading: false,
  error: false,
  checked: false,
  busy: false,
  activeRelease: null,
  running: false,
  onRefresh: vi.fn(),
}

it("preserves unchecked, loading and empty-inventory feedback", () => {
  const view = render(<NodeReleaseInventory {...defaults} />)
  expect(screen.getByText("Releases not checked yet.")).toBeTruthy()
  view.rerender(<NodeReleaseInventory {...defaults} loading />)
  expect(screen.getByText(/Reading releases for selected Node project/)).toBeTruthy()
  expect((screen.getByRole("button", { name: "Refresh releases" }) as HTMLButtonElement).disabled)
    .toBe(true)
  view.rerender(<NodeReleaseInventory {...defaults} checked />)
  expect(screen.getByText(/No source releases yet/)).toBeTruthy()
  expect(screen.queryByText("Releases not checked yet.")).toBeNull()
})

it("preserves retry and delegates the same refresh callback without API calls", () => {
  const onRefresh = vi.fn()
  const view = render(<NodeReleaseInventory {...defaults} error onRefresh={onRefresh} />)
  expect(screen.getByRole("alert").textContent).toContain("Could not read source releases")
  fireEvent.click(screen.getByRole("button", { name: "Retry releases" }))
  fireEvent.click(screen.getByRole("button", { name: "Refresh releases" }))
  expect(onRefresh).toHaveBeenCalledTimes(2)
  view.rerender(<NodeReleaseInventory {...defaults} error busy onRefresh={onRefresh} />)
  expect((screen.getByRole("button", { name: "Retry releases" }) as HTMLButtonElement).disabled)
    .toBe(true)
  expect((screen.getByRole("button", { name: "Refresh releases" }) as HTMLButtonElement).disabled)
    .toBe(true)
})

it("renders release roles, dependency details and legacy restaging warning", () => {
  const items = [release(first, true), release(second, false, true)]
  const view = render(<NodeReleaseInventory {...defaults} checked releases={items}
    activeRelease={first} running />)
  expect(screen.getByText("Running release")).toBeTruthy()
  expect(screen.getByText("Archived source")).toBeTruthy()
  expect(screen.getByText("Restaging required before use.")).toBeTruthy()
  expect(screen.getAllByText(/sample@1.0.0/)).toHaveLength(2)
  expect(view.container.querySelectorAll("details")).toHaveLength(2)
  expect(Array.from(view.container.querySelectorAll("details")).every(d => !d.open)).toBe(true)
  expect(view.container.querySelectorAll("button")).toHaveLength(1)
})
