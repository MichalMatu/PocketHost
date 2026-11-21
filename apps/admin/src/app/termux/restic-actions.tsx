import * as React from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Feedback } from "./admin-actions-feedback"
import { action, inspect } from "./admin-actions-api"

type ResticStatus = { initialized: boolean; repositoryPresent: boolean; keyPresent: boolean }
type ResticSnapshot = { id: string; time: string; paths: string[] }

export function ResticActions({ detected, refreshToken = 0 }: { detected: boolean; refreshToken?: number }) {
  const [status, setStatus] = React.useState<ResticStatus | null>(null)
  const [snapshots, setSnapshots] = React.useState<ResticSnapshot[] | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [done, setDone] = React.useState<string | null>(null)
  const refresh = React.useCallback(async () => {
    const current = await inspect<{ restic: ResticStatus }>("restic-status")
    setStatus(current.restic)
    if (current.restic.initialized) {
      const result = await inspect<{ snapshots: ResticSnapshot[] }>("restic-snapshots")
      if (!Array.isArray(result.snapshots) || result.snapshots.length > 40 ||
          !result.snapshots.every(item => /^[a-f0-9]{64}$/.test(item.id) && typeof item.time === "string"))
        throw new Error("Invalid Restic snapshots")
      setSnapshots(result.snapshots)
    } else setSnapshots([])
  }, [])
  React.useEffect(() => {
    if (!detected) return
    let active = true
    void inspect<{ restic: ResticStatus }>("restic-status").then(async current => {
      if (!active) return
      setStatus(current.restic)
      if (current.restic.initialized) {
        const result = await inspect<{ snapshots: ResticSnapshot[] }>("restic-snapshots")
        if (active) setSnapshots(result.snapshots)
      } else setSnapshots([])
    }).catch(() => { if (active) setError("Restic state cannot be inspected.") })
    return () => { active = false }
  }, [detected, refreshToken])
  const run = async (operation: "init" | "backup" | "check" | "restore" | "forget", snapshot?: string) => {
    if (busy || !detected) return
    const question = operation === "backup" ? "Back up the H3 workspace into the local encrypted Restic repository?" :
      operation === "restore" ? "Restore snapshot into a separate staging directory? The current workspace will not be overwritten." :
      operation === "forget" ? "Permanently forget and prune the selected Restic snapshot?" :
      operation === "init" ? "Initialize the encrypted Restic repository and local recovery key?" :
      "Run Restic repository consistency check?"
    if (!window.confirm(question)) return
    setBusy(true); setError(null); setDone(null)
    try {
      const result = await action<{ result?: { restoredTo?: string } }>({
        action: "restic", name: operation, path: snapshot,
      })
      await refresh()
      setDone(operation === "restore" && result.result?.restoredTo
        ? "Restored into staging: " + result.result.restoredTo
        : "Restic " + operation + " completed")
    } catch {
      setError("Restic operation failed or repository is unavailable; no success was assumed.")
    } finally { setBusy(false) }
  }
  return <div className="space-y-3 rounded-md border p-3">
    <h3 className="text-sm font-medium">Encrypted Restic backups</h3>
    <p className="text-muted-foreground text-xs">Workspace only · encrypted locally. Store a separate recovery-key copy.</p>
    {!detected && <p className="text-muted-foreground text-sm">Restic executable not detected. Install restic from Packages to use this integration.</p>}
    {detected && <>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">{status?.initialized ? "Repository initialized" : "Repository not initialized"}</Badge>

      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" disabled={busy || status?.initialized === true}
          onClick={() => void run("init")}>Initialize repository</Button>
        <Button size="sm" disabled={busy}
          onClick={() => void run("backup")}>Create Restic backup</Button>
        <Button size="sm" variant="outline" disabled={busy || !status?.initialized}
          onClick={() => void run("check")}>Check repository</Button>
      </div>
      <div className="max-h-64 space-y-2 overflow-auto">
        {snapshots?.map(item => <div className="flex flex-wrap items-center justify-between gap-2 border-b py-2" key={item.id}>
          <div>
            <p className="text-sm">{item.time.slice(0, 19).replace("T", " ")}</p>
            <p className="font-mono text-xs text-muted-foreground">{item.id.slice(0, 16)}…</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" disabled={busy}
              onClick={() => void run("restore", item.id)}>Restore to staging</Button>
            <Button size="sm" variant="outline" disabled={busy}
              onClick={() => void run("forget", item.id)}>Forget / Prune</Button>
          </div>
        </div>)}
        {snapshots?.length === 0 && <p className="text-muted-foreground text-xs">No Restic backups in this repository.</p>}
      </div>
    </>}
    {busy && <p role="status">Running the selected Restic command…</p>}
    <Feedback error={error} done={done} />
    <p className="text-muted-foreground text-xs">Restore uses isolated staging; not an off-device backup.</p>
  </div>
}
