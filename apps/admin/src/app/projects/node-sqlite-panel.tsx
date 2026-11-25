import * as React from "react"
import { Button } from "@/components/ui/button"
import {
  parseSqliteRead, SQLITE_MAX_PAGE, SQLITE_PAGE_SIZE,
  type SqliteCell, type SqliteQuery, type SqliteRead, type SqliteState,
} from "../../../../../src/shared/node-sqlite-studio.ts"

type Props = {
  projectId: string
  ownerAuthorized: boolean
  busy: boolean
  getJson: (url: string) => Promise<Record<string, unknown>>
}
type Catalog = Extract<SqliteRead, { kind: "catalog" }>
type Tables = Extract<SqliteRead, { kind: "tables" }>
type Rows = Extract<SqliteRead, { kind: "rows" }>
const descriptions: Record<SqliteState, string> = {
  available: "Available",
  "not-configured": "No private database directory is configured.",
  "offline-only": "Offline-only: a safe live read cannot be established. Studio will not stop a service or create missing SQLite sidecars.",
  locked: "Database is locked or has a rollback journal. No recovery was attempted.",
  corrupt: "Not a valid SQLite database, or SQLite reported corruption.",
  unsupported: "This database, table, view or response exceeds the supported read-only limits.",
  stale: "Database identity or state changed. Refresh the database list.",
  busy: "SQLite reader is busy or exceeded its time budget. Try again later.",
  unavailable: "Database storage or native reader is unavailable.",
}

function displayCell(cell: SqliteCell) {
  if (cell.kind === "null") return <span className="text-muted-foreground italic">NULL</span>
  if (cell.kind === "blob") return <span className="break-all">
    BLOB ({cell.bytes} bytes) · {cell.value}{cell.truncated ? "…" : ""}
  </span>
  return <span className="whitespace-pre-wrap break-all">
    {cell.value === "" ? <em className="text-muted-foreground">empty string</em> : cell.value}
    {cell.truncated && <span className="text-muted-foreground">… ({cell.bytes} bytes)</span>}
  </span>
}
function State({ value }: { value: SqliteState }) {
  return value === "available" ? null : <p role="status" className="text-xs text-muted-foreground">{descriptions[value]}</p>
}

/** No request until opened explicitly. Project/owner changes invalidate all in-flight results. */
export function NodeSqlitePanel(props: Props) {
  return <SqliteContent key={props.projectId + ":" + String(props.ownerAuthorized)} {...props} />
}
function SqliteContent({ projectId, ownerAuthorized, busy, getJson }: Props) {
  const [catalog, setCatalog] = React.useState<Catalog | null>(null)
  const [tables, setTables] = React.useState<Tables | null>(null)
  const [rows, setRows] = React.useState<Rows | null>(null)
  const [databaseId, setDatabaseId] = React.useState("")
  const [tableId, setTableId] = React.useState("")
  const [page, setPage] = React.useState(1)
  const [loading, setLoading] = React.useState(false)
  const [failed, setFailed] = React.useState(false)
  const version = React.useRef(0)
  React.useEffect(() => () => { version.current += 1 }, [])

  async function load(query: SqliteQuery) {
    const requested = ++version.current
    setLoading(true)
    setFailed(false)
    if (!query.databaseId) {
      setCatalog(null)
      setDatabaseId("")
      setTableId("")
      setTables(null)
      setRows(null)
      setPage(1)
    } else if (!query.tableId) {
      setDatabaseId(query.databaseId)
      setTableId("")
      setTables(null)
      setRows(null)
      setPage(1)
    } else {
      setTableId(query.tableId)
      setRows(null)
      setPage(query.page)
    }
    try {
      const params = new URLSearchParams()
      if (query.databaseId) params.set("db", query.databaseId)
      if (query.tableId) {
        params.set("table", query.tableId)
        params.set("page", String(query.page))
      }
      const suffix = params.toString()
      const data = parseSqliteRead(await getJson(
        "/api/v1/node-projects/" + projectId + "/sqlite" + (suffix ? "?" + suffix : ""),
      ), projectId, query)
      if (requested !== version.current) return
      if (data.kind === "catalog") setCatalog(data)
      else if (data.kind === "tables") setTables(data)
      else setRows(data)
    } catch {
      if (requested === version.current) setFailed(true)
    } finally {
      if (requested === version.current) setLoading(false)
    }
  }
  const catalogQuery = { databaseId: null, tableId: null, page: 1 }
  const selectedDb = catalog?.databases.find(item => item.id === databaseId)
  const selectedTable = tables?.tables.find(item => item.id === tableId)
  const disabled = busy || !ownerAuthorized
  return <section aria-label="SQLite Studio" className="rounded-lg border p-3 space-y-3 text-sm">
    <div className="flex flex-wrap gap-2 items-center justify-between">
      <div><h3 className="font-semibold">SQLite Studio</h3>
        <p className="text-xs text-muted-foreground">Read-only · this project&apos;s private db directory</p></div>
      <Button size="sm" variant="outline" disabled={disabled} onClick={() => void load(catalogQuery)}>
        {catalog ? "Refresh databases" : "Browse databases"}
      </Button>
    </div>
    {!ownerAuthorized && <p className="text-xs text-muted-foreground">Unlock the Node owner session to browse private databases.</p>}
    {ownerAuthorized && <>
      {loading && <p role="status">Loading SQLite…</p>}
      {failed && <p role="alert">SQLite request failed or returned an invalid response. Refresh the selection.</p>}
      {catalog && <State value={catalog.state} />}
      {catalog?.state === "available" && (catalog.databases.length === 0 ?
        <p role="status">No SQLite files in this project&apos;s db directory.</p> : <>
          <label className="block space-y-1">
            <span className="font-medium">Database</span>
            <select aria-label="SQLite database" className="block w-full rounded border bg-background p-2"
              value={databaseId} disabled={disabled}
              onChange={event => {
                const next = event.target.value
                if (next) void load({ databaseId: next, tableId: null, page: 1 })
                else void load(catalogQuery)
              }}>
              <option value="">Select database</option>
              {catalog.databases.map(item => <option key={item.id} value={item.id}>
                {item.name} · {item.bytes.toLocaleString()} B · {item.state}
              </option>)}
            </select>
          </label>
          {selectedDb && <State value={selectedDb.state} />}
        </>)}
      {tables && <State value={tables.state} />}
      {tables?.state === "available" && <>
        {tables.mode === "live-wal" && <p className="text-xs text-muted-foreground">
          Native read-only WAL snapshot. SQLite coordinates through existing shared-memory (SHM); no SQL writes.
        </p>}
        {tables.mode === "offline" && <p className="text-xs text-muted-foreground">
          Verified stopped runtime; clean WAL database opened immutable without sidecars.
        </p>}
        {tables.tables.length === 0 ? <p role="status">No user tables or views.</p> :
          <label className="block space-y-1">
            <span className="font-medium">Table / view</span>
            <select aria-label="SQLite table or view" className="block w-full rounded border bg-background p-2"
              disabled={disabled} value={tableId} onChange={event => {
                const next = event.target.value
                if (next) void load({ databaseId, tableId: next, page: 1 })
                else void load({ databaseId, tableId: null, page: 1 })
              }}>
              <option value="">Select table or view</option>
              {tables.tables.map(item => <option key={item.id} value={item.id}>
                {item.name} · {item.type} · {item.columns} columns{item.state === "unsupported" ? " · unsupported" : ""}
              </option>)}
            </select>
          </label>}
      </>}
      {rows && <State value={rows.state} />}
      {rows?.state === "available" && <>
        <details className="rounded border p-2">
          <summary className="cursor-pointer font-medium">Schema ({rows.columns.length} columns)</summary>
          <div className="overflow-auto">
            <table className="w-full text-left text-xs">
              <thead><tr>{["Column", "Type", "Not null", "PK", "Generated"].map(name =>
                <th className="border-b p-2" key={name}>{name}</th>)}</tr></thead>
              <tbody>{rows.columns.map((column, index) =>
                <tr key={index} className="border-b">
                  <td className="p-2 break-all">{column.name}</td><td className="p-2">{column.type || "—"}</td>
                  <td className="p-2">{column.notNull ? "Yes" : "No"}</td>
                  <td className="p-2">{column.primaryKey || "—"}</td><td className="p-2">{column.generated ? "Yes" : "No"}</td>
                </tr>)}</tbody>
            </table>
          </div>
        </details>
        {rows.rows.length === 0 ? <p role="status">No rows on this page.</p> :
          <div className="overflow-auto max-h-96 rounded border">
            <table aria-label="SQLite rows" className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-background"><tr>{rows.columns.map((column, index) =>
                <th key={index} className="p-2 border-b min-w-24">{column.name}</th>)}</tr></thead>
              <tbody>{rows.rows.map((row, index) => <tr key={index} className="border-b">
                {row.map((cell, i) => <td key={i} className="p-2 max-w-64 align-top">{displayCell(cell)}</td>)}
              </tr>)}</tbody>
            </table>
          </div>}
        <div className="flex flex-wrap gap-2 items-center">
          <Button size="sm" variant="outline" disabled={disabled || loading || page <= 1}
            onClick={() => void load({ databaseId, tableId, page: page - 1 })}>Previous</Button>
          <span className="text-xs">Page {rows.page} · {rows.rows.length}/{SQLITE_PAGE_SIZE} rows</span>
          <Button size="sm" variant="outline" disabled={disabled || loading || !rows.hasMore || page >= SQLITE_MAX_PAGE}
            onClick={() => void load({ databaseId, tableId, page: page + 1 })}>Next</Button>
          <Button size="sm" variant="outline" disabled={disabled || loading}
            onClick={() => void load({ databaseId, tableId, page })}>Refresh rows</Button>
        </div>
        {rows.hasMore && page >= SQLITE_MAX_PAGE && <p role="status">Browse limit reached; more rows may exist.</p>}
        <p className="text-xs text-muted-foreground">Each page is a separate read snapshot. Data may shift between requests;
          {selectedTable?.type === "view" ? " view order is not guaranteed." : " no full row count is calculated."}
          {" "}Text and BLOB values are bounded previews.</p>
      </>}
    </>}
  </section>
}
