import * as React from "react"
import { act, fireEvent, render, screen } from "@testing-library/react"
import { expect, it, vi } from "vitest"
import { NodeSqlitePanel } from "@/app/projects/node-sqlite-panel"

const PROJECT = "node-" + "a".repeat(32)
const OTHER = "node-" + "b".repeat(32)
const DB = "d".repeat(64)
const TABLE = "e".repeat(64)
const catalog = { kind: "catalog", projectId: PROJECT, state: "available",
  databases: [{ id: DB, name: "app.sqlite", bytes: 4096, state: "available", mode: "live-wal" }] }
const tables = { kind: "tables", projectId: PROJECT, databaseId: DB, state: "available",
  mode: "live-wal", tables: [{ id: TABLE, name: 'a "quoted"', type: "table", columns: 1, state: "available" }] }
const rows = (page: number) => ({ kind: "rows", projectId: PROJECT, databaseId: DB, tableId: TABLE,
  state: "available", mode: "live-wal", page, columns: [{ name: "label", type: "TEXT", notNull: false, primaryKey: 0, generated: false }],
  rows: Array.from({ length: page === 1 ? 20 : 1 }, (_, i) => [{
    kind: "text", value: page === 1 ? "row " + i : "last row", bytes: page === 1 ? ("row " + i).length : 8, truncated: false,
  }]), hasMore: page === 1 })
function mount(getJson: (url: string) => Promise<Record<string, unknown>>, authorized = true) {
  return render(<NodeSqlitePanel projectId={PROJECT} ownerAuthorized={authorized} busy={false} getJson={getJson} />)
}
async function selectTable() {
  fireEvent.click(screen.getByRole("button", { name: "Browse databases" }))
  const db = await screen.findByLabelText("SQLite database")
  fireEvent.change(db, { target: { value: DB } })
  const table = await screen.findByLabelText("SQLite table or view")
  fireEvent.change(table, { target: { value: TABLE } })
}
it("does not read until requested, then renders schema, rows, pagination and read-only WAL notice", async () => {
  const getJson = vi.fn(async (url: string) => url.includes("page=2") ? rows(2) :
    url.includes("table=") ? rows(1) : url.includes("?db=") ? tables : catalog)
  mount(getJson)
  expect(getJson).not.toHaveBeenCalled()
  await selectTable()
  await screen.findByText("row 0")
  expect(screen.getByText("Schema (1 columns)")).toBeTruthy()
  expect(screen.getByText(/existing shared-memory/)).toBeTruthy()
  fireEvent.click(screen.getByRole("button", { name: "Next" }))
  await screen.findByText("last row")
  expect((screen.getByRole("button", { name: "Next" }) as HTMLButtonElement).disabled).toBe(true)
  expect(screen.queryByText("row 0")).toBeNull()
  expect(getJson.mock.calls.every(([url]) => url.startsWith("/api/v1/node-projects/" + PROJECT + "/sqlite"))).toBe(true)
})
it("does not read private data while owner session is locked", () => {
  const getJson = vi.fn(async () => catalog)
  mount(getJson, false)
  expect((screen.getByRole("button", { name: "Browse databases" }) as HTMLButtonElement).disabled).toBe(true)
  expect(getJson).not.toHaveBeenCalled()
})
it("discards a response after the selected project or owner session changes", async () => {
  let complete: ((value: Record<string, unknown>) => void) | undefined
  const getJson = vi.fn(async () => new Promise<Record<string, unknown>>(resolve => { complete = resolve }))
  const view = mount(getJson)
  fireEvent.click(screen.getByRole("button", { name: "Browse databases" }))
  view.rerender(<NodeSqlitePanel projectId={OTHER} ownerAuthorized={false} busy={false} getJson={getJson} />)
  await act(async () => { complete!(catalog) })
  expect(screen.queryByLabelText("SQLite database")).toBeNull()
  expect(screen.getByText(/Unlock the Node owner session/)).toBeTruthy()
})
it("rejects stale identity, exposes offline-only and never exposes SQL actions", async () => {
  const offline = { ...catalog, databases: [{ ...catalog.databases[0], state: "offline-only", mode: null }] }
  const getJson = vi.fn(async (url: string) => url.includes("?db=")
    ? { ...tables, state: "offline-only", mode: null, tables: [] } : offline)
  const view = mount(getJson)
  fireEvent.click(screen.getByRole("button", { name: "Browse databases" }))
  fireEvent.change(await screen.findByLabelText("SQLite database"), { target: { value: DB } })
  await screen.findAllByText(/Offline-only/)
  expect(screen.queryByLabelText("SQLite table or view")).toBeNull()
  expect(screen.queryByRole("button", { name: /execute SQL|delete database|export/i })).toBeNull()
  view.unmount()
  mount(async () => ({ ...catalog, projectId: OTHER }))
  fireEvent.click(screen.getByRole("button", { name: "Browse databases" }))
  await screen.findByRole("alert")
  expect(screen.queryByLabelText("SQLite database")).toBeNull()
})
