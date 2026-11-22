import * as React from "react"
import { expect, it } from "vitest"
import { render, screen } from "@testing-library/react"
import { NodeRuntimeDetails } from "@/app/projects/node-runtime-details"
import type { RuntimeState, RuntimePlan, BuildReview, DependencyReview } from "@/app/projects/node-project-client"

it("keeps advanced runtime details collapsed with unchanged missing-data copy", () => {
  const view = render(<NodeRuntimeDetails runtime={null} plan={null}
    buildReview={null} dependencyReview={null} />)
  const details = view.container.querySelector<HTMLDetailsElement>(
    'details[data-testid="node-runtime-details"]',
  )
  expect(details?.open).toBe(false)
  expect(screen.getByText("Technical details")).toBeTruthy()
  expect(screen.getByLabelText("Node local address").textContent).toContain("not assigned")
  expect(screen.getByText(/Staged candidate plan:/).textContent).toContain("not checked")
  expect(screen.getByText(/Health policy \(read-only\):/).textContent)
    .toContain("No automatic restart is authorized.")
  expect(screen.queryByLabelText("Node build setup")).toBeNull()
  expect(screen.queryByLabelText("Node dependency setup")).toBeNull()
})

it("renders verified runtime, dependency and build readbacks without initiating actions", () => {
  const release = "r-" + "a".repeat(32)
  const runtime: RuntimeState = {
    state: "running", port: 19090, desired: "running", activeRelease: release,
    lastGoodRelease: release, previousGoodRelease: null, history: [],
    healthDecision: { action: "none", reason: "healthy", nextEligibleAtMs: null },
  }
  const plan: RuntimePlan = {
    release, port: 19090, missingTools: [], nodeVersion: "22", npmVersion: "10",
    conflicts: [], dependencyCount: 2, allowed: true, reason: "reviewed",
  }
  const buildReview: BuildReview = {
    release, status: "verified", buildRequired: true, script: "npm run build",
    dependencyCount: 2, dependenciesPrepared: true, artifactVerified: true,
    artifact: { entries: 1, bytes: 240, files: ["dist/server.js"], truncated: false },
    blockers: [],
  }
  const dependencyReview: DependencyReview = {
    release, status: "prepared", dependencyCount: 2, installRequired: true,
    buildRequired: true, installCommand: ["npm", "ci"],
    buildCommand: ["npm", "run", "build"], blockers: [], executed: false,
  }
  const view = render(<NodeRuntimeDetails runtime={runtime} plan={plan}
    buildReview={buildReview} dependencyReview={dependencyReview} />)
  expect(view.container.querySelector('details')?.open).toBe(false)
  expect(screen.getByLabelText("Node local address").textContent)
    .toContain("http://127.0.0.1:19090/")
  expect(screen.getByLabelText("Node build setup").textContent)
    .toContain("dist/server.js")
  expect(screen.getByLabelText("Node dependency setup").textContent)
    .toContain("Installed package bytes verified")
  expect(screen.getByText(/Health policy \(read-only\):/).textContent).toContain("healthy")
  expect(view.container.querySelector("button")).toBeNull()
})
