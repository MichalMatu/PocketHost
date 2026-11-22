import * as React from "react"
import { expect, it, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import { NodeDataPanel } from "@/app/projects/node-data-panel"

const PROJECT = "node-" + "a".repeat(32)
const OTHER = "node-" + "b".repeat(32)
const SNAPSHOT = "snapshot-" + "c".repeat(32)
const index = {
  verification: "metadata-only",
  snapshotCreationEnabled: false,
  snapshots: [{
    snapshot: SNAPSHOT,
    createdAt: "2026-11-22T00:00:00.000Z",
    schema: 2,
    files: 1,
    bytes: 8,
    directories: 1,
    integrity: "not-checked",
  }],
}
const scope = {
  data: {
    projectId: PROJECT,
    state: "not-configured",
    fileCount: 0,
    totalBytes: 0,
    categories: {
      uploads: { fileCount: 0, totalBytes: 0, directoryCount: 0 },
      db: { fileCount: 0, totalBytes: 0, directoryCount: 0 },
      state: { fileCount: 0, totalBytes: 0, directoryCount: 0 },
    },
    backupReady: false,
    consistency: "offline-required",
  },
  recovery: {
    status: "data-not-configured",
    runtimeState: "not-provisioned",
    snapshotEnabled: false,
    requirements: {
      dataOwned: false,
      runtimeStopped: false,
      databaseConsistent: false,
      snapshotApproved: false,
    },
  },
}

function display(getJson: (url: string) => Promise<Record<string, unknown>>) {
  const action = (fn: () => Promise<void>) => { void fn().catch(() => undefined) }
  const view = render(<NodeDataPanel projectId={PROJECT} ownerAuthorized
    busy={false} getJson={getJson} action={action} />)
  fireEvent.click(screen.getByText("Application data", { exact: false }))
  fireEvent.click(screen.getByRole("button", { name: "Inspect data storage" }))
  return { view, action }
}

it("retains detached snapshots when damaged live data inspection fails", async () => {
  const requests = vi.fn(async (url: string) => {
    if (url.endsWith("/data-scope")) throw new Error("damaged source")
    if (url.endsWith("/data-snapshots")) return index
    if (url.endsWith("/verify")) return { verification: {
      snapshot: SNAPSHOT, integrity: "verified", files: 1, bytes: 8, directories: 1,
    } }
    throw new Error("Unexpected request " + url)
  })
  display(requests)
  await screen.findByText("Detached local snapshots (1)")
  expect(screen.getByText(/Current application data could not be inspected/)).toBeTruthy()
  expect(screen.getByText(SNAPSHOT)).toBeTruthy()
  fireEvent.click(screen.getByRole("button", { name: "Verify stored bytes" }))
  await screen.findByText(/Archive matches its manifest/)
  expect(requests.mock.calls.some(([url]) => url.endsWith("/" + SNAPSHOT + "/verify"))).toBe(true)
})

it("retains current-data information when detached snapshot listing fails", async () => {
  const requests = vi.fn(async (url: string) => {
    if (url.endsWith("/data-scope")) return scope
    if (url.endsWith("/data-snapshots")) throw new Error("archive inaccessible")
    throw new Error("Unexpected request " + url)
  })
  display(requests)
  await screen.findByText("Storage: not configured.")
  expect(screen.getByText(/Detached snapshots could not be listed/)).toBeTruthy()
  expect(screen.queryByText(/No snapshots recorded for this project/)).toBeNull()
  expect(screen.queryByRole("button", { name: "Verify stored bytes" })).toBeNull()
})

it("discards snapshot metadata when owner session or selected project changes", async () => {
  const requests = vi.fn(async (url: string) =>
    url.endsWith("/data-scope") ? scope : index)
  const { view, action } = display(requests)
  await screen.findByText("Detached local snapshots (1)")
  view.rerender(<NodeDataPanel projectId={OTHER} ownerAuthorized={false}
    busy={false} getJson={requests} action={action} />)
  expect(screen.queryByText(SNAPSHOT)).toBeNull()
  expect((screen.getByRole("button", { name: "Inspect data storage" }) as HTMLButtonElement).disabled)
    .toBe(true)
})
