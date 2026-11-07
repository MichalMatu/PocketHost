import * as React from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
const API = "/api/v1/termux-admin"
type Scope = "home" | "prefix" | "all"
type Snapshot = { id: string; time: string; paths: string[] }
type ResticState = { initialized: boolean; repositoryPresent: boolean; keyPresent: boolean }
const headers = { "Content-Type": "application/json", "X-PocketHost-Intent": "termux-admin" }
async function get<T>(query: string): Promise<T> {
  const response = await fetch(API + query, { credentials: "same-origin", cache: "no-store" })
  if (!response.ok) throw new Error("Restic inventory unavailable")
  return response.json() as Promise<T>
}
async function post<T>(input: object): Promise<T> {
  const response = await fetch(API, { method: "POST", credentials: "same-origin", headers,
    body: JSON.stringify(input) })
  if (!response.ok) throw new Error("Restic command failed or was refused")
  return response.json() as Promise<T>
}
export function FullTermuxBackups({ detected }: { detected: boolean }) {
  const [scope, setScope] = React.useState<Scope>("home")
  const [status, setStatus] = React.useState<ResticState | null>(null)
  const [records, setRecords] = React.useState<Snapshot[] | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [message, setMessage] = React.useState("")
  const [error, setError] = React.useState("")
  const refresh = async (targetScope: Scope) => {
    const result = await get<{ restic: ResticState }>("?mode=restic-status")
    setStatus(result.restic)
    if (result.restic.initialized) {
      const listing = await get<{ snapshots: Snapshot[] }>("?mode=system-snapshots&scope=" + targetScope)
      if (!Array.isArray(listing.snapshots) || listing.snapshots.length > 40 ||
          !listing.snapshots.every(item => /^[a-f0-9]{64}$/.test(item.id)))
        throw new Error("Invalid system backup records")
      setRecords(listing.snapshots)
    } else setRecords([])
  }
  const run = async (name: "backup" | "check" | "restore" | "forget", id?: string) => {
    if (busy || !detected) return
    const action = name === "backup" ? "Create a local encrypted Restic backup of Termux " + scope + "?" :
      name === "restore" ? "Restore the selected snapshot into an isolated directory, without replacing running files?" :
      name === "forget" ? "Permanently forget and prune this selected backup?" :
      "Run the full Restic integrity check?"
    if (!window.confirm(action)) return
    setBusy(true); setMessage(""); setError("")
    try {
      const result = await post<{ result?: { restoredTo?: string } }>({
        action: "restic-system", name, root: scope, path: id,
      })
      await refresh(scope)
      setMessage(name === "restore" && result.result?.restoredTo
        ? "Restored into: " + result.result.restoredTo
        : "Restic " + name + " completed")
    } catch { setError("Backup operation failed. Check Restic installation, free storage and repository state.") }
    finally { setBusy(false) }
  }
  React.useEffect(() => {
    if (!detected) return
    let active = true
    void get<{ restic: ResticState }>("?mode=restic-status").then(result => {
      if (active) setStatus(result.restic)
    }).catch(() => { if (active) setError("Restic state unavailable") })
    return () => { active = false }
  }, [detected])
  return <section className="space-y-3 rounded-md border p-3">
    <h3 className="text-sm font-medium">Full Termux backups with Restic</h3>
    <p className="text-xs text-muted-foreground">
      Encrypted local snapshots of HOME, Termux programs (PREFIX), or both.
      The Restic repository and its local encryption key are excluded from the backup.
      Restores go into staging, never over running applications.
    </p>
    <div className="flex flex-wrap items-center gap-2">
      <label htmlFor="h34-restic-scope" className="text-sm">Backup scope</label>
      <select id="h34-restic-scope" aria-label="Termux backup scope" value={scope}
        className="rounded-md border bg-background p-2" disabled={busy}
        onChange={event => { setScope(event.target.value as Scope); setRecords(null) }}>
        <option value="home">HOME · projects and settings</option>
        <option value="prefix">PREFIX · installed Termux programs</option>
        <option value="all">HOME + PREFIX · full Termux</option>
      </select>
      <Badge variant="outline">{status?.initialized ? "Encrypted repository ready" : "Not initialized"}</Badge>
    </div>
    <div className="flex flex-wrap gap-2">
      <Button size="sm" disabled={busy || !detected} onClick={() => void run("backup")}>Create full backup</Button>
      <Button size="sm" variant="outline" disabled={busy || !detected || !status?.initialized}
        onClick={() => void run("check")}>Verify repository</Button>
      <Button size="sm" variant="outline" disabled={busy || !detected}
        onClick={() => void refresh(scope).catch(() => setError("Cannot load backup list"))}>List snapshots</Button>
    </div>
    {!detected && <p className="text-sm">Restic not detected. Install it using Packages.</p>}
    <div className="max-h-64 space-y-2 overflow-auto">
      {records?.map(item => <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 border-b p-2">
        <div className="text-xs">
          <p>{item.time.slice(0, 19).replace("T", " ")}</p>
          <p className="font-mono text-muted-foreground">{item.id.slice(0, 18)}…</p>
        </div>
        <div className="flex flex-wrap gap-1">
          <Button size="sm" variant="outline" disabled={busy} onClick={() => void run("restore", item.id)}>Restore to staging</Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => void run("forget", item.id)}>Forget</Button>
        </div>
      </div>)}
      {records?.length === 0 && <p className="text-sm text-muted-foreground">No snapshots for this scope.</p>}
    </div>
    {busy && <p role="status">Restic command running…</p>}
    {message && <p role="status" className="text-sm">{message}</p>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </section>
}
