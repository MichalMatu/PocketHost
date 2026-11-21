import * as React from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Feedback } from "./admin-actions-feedback"
import { action, inspect } from "./admin-actions-api"

type FileInfo = { name: string; kind: "directory" | "file"; bytes: number }
type SnapshotInfo = { name: string; createdAt: string; files: number }
export function WorkspaceManager() {
  const [folder, setFolder] = React.useState("")
  const [entries, setEntries] = React.useState<FileInfo[] | null>(null)
  const [file, setFile] = React.useState("")
  const [content, setContent] = React.useState("")
  const [newName, setNewName] = React.useState("")
  const [destination, setDestination] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  const [uploading, setUploading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [done, setDone] = React.useState<string | null>(null)
  const load = async (location = folder) => {
    setBusy(true); setError(null)
    try {
      const response = await inspect<{ files: FileInfo[] }>("files", location)
      setEntries(response.files); setFolder(location); setFile(""); setContent("")
    } catch { setError("Unable to read this workspace directory.") }
    finally { setBusy(false) }
  }
  React.useEffect(() => {
    let active = true
    void inspect<{ files: FileInfo[] }>("files", "").then(response => {
      if (active) setEntries(response.files)
    }).catch(() => { if (active) setError("Unable to read this workspace directory.") })
    return () => { active = false }
  }, [])
  const full = (name: string) => [folder, name].filter(Boolean).join("/")
  const edit = async (name: string) => {
    setBusy(true); setError(null)
    try {
      const current = full(name)
      const response = await action<{ content: string }>({ action: "read-file", path: current })
      setFile(current); setContent(response.content)
    } catch { setError("Only bounded text documents can be edited.") }
    finally { setBusy(false) }
  }
  const apply = async (name: "mkdir" | "save" | "rename" | "delete" | "copy", relative: string) => {
    if (busy || !relative) return
    if (!window.confirm("Apply " + name + " to owned workspace path " + relative + "?")) return
    setBusy(true); setError(null); setDone(null)
    try {
      await action({ action: "file", name, path: relative,
        destination: name === "rename" || name === "copy" ? destination : undefined,
        content: name === "save" ? content : undefined })
      setDone(name + " completed")
      const response = await inspect<{ files: FileInfo[] }>("files", folder)
      setEntries(response.files)
      if (name !== "save") { setFile(""); setContent("") }
    } catch { setError("File operation failed. Check path, ownership and destination.") }
    finally { setBusy(false) }
  }
  const importFile = async (selected: File | undefined) => {
    if (!selected || busy || uploading) return
    if (selected.size > 128 * 1024) { setError("File exceeds 128 KiB import limit."); return }
    setUploading(true); setError(null); setDone(null)
    try {
      const content = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onerror = () => reject(new Error("File read failed"))
        reader.onload = () => {
          const value = reader.result
          if (typeof value !== "string" || !value.startsWith("data:") || !value.includes(","))
            reject(new Error("Invalid file data"))
          else resolve(value.slice(value.indexOf(",") + 1))
        }
        reader.readAsDataURL(selected)
      })
      await action({ action: "file", name: "upload", path: full(selected.name), base64: content })
      setDone("Imported " + selected.name)
      const updated = await inspect<{ files: FileInfo[] }>("files", folder)
      setEntries(updated.files)
    } catch { setError("Import rejected; check file name, duplicate and size.") }
    finally { setUploading(false) }
  }
  const exportFile = async (name: string) => {
    setBusy(true); setError(null)
    try {
      const item = await action<{ name: string; base64: string; bytes: number }>({
        action: "download-file", path: full(name),
      })
      const decoded = atob(item.base64)
      const bytes = Uint8Array.from(decoded, character => character.charCodeAt(0))
      const blob = new Blob([bytes], { type: "application/octet-stream" })
      const url = URL.createObjectURL(blob)
      try {
        const link = document.createElement("a")
        link.href = url; link.download = item.name
        link.click()
      } finally { URL.revokeObjectURL(url) }
      setDone("Exported " + item.name)
    } catch { setError("File export failed or exceeds 128 KiB.") }
    finally { setBusy(false) }
  }
  return <div className="space-y-3 rounded-md border p-3">
    <h3 className="text-sm font-medium">Termux workspace files</h3>
    <p className="text-muted-foreground text-xs">Managed area: Projects/PocketHost-H3-Workspace. Browsing, editing, adding, moving and deleting never affect other projects.</p>
    <div className="flex flex-wrap gap-2 items-center">
      <label htmlFor="h3-import-file" className="text-sm font-medium">Import file (max 128 KiB)</label>
      <input id="h3-import-file" type="file" aria-label="Import workspace file"
        disabled={busy || uploading}
        onChange={event => {
          const selected = event.target.files?.[0]
          void importFile(selected)
          event.target.value = ""
        }} />
    </div>
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant="outline">{folder || "/"}</Badge>
      <Button size="sm" variant="outline" disabled={busy || !folder}
        onClick={() => void load(folder.split("/").slice(0, -1).join("/"))}>Up</Button>
      <Button size="sm" variant="outline" disabled={busy} onClick={() => void load()}>Refresh</Button>
    </div>
    <div className="max-h-56 space-y-1 overflow-auto">
      {entries?.map(entry => <div key={entry.name} className="flex flex-wrap items-center justify-between gap-2 border-b py-2 text-xs">
        <span>{entry.kind === "directory" ? "📁" : "📄"} {entry.name} {entry.kind === "file" ? entry.bytes + " B" : ""}</span>
        <div className="flex gap-2">
          {entry.kind === "directory" ?
            <Button size="sm" variant="outline" disabled={busy} onClick={() => void load(full(entry.name))}>Open</Button> :
            <>
              <Button size="sm" variant="outline" disabled={busy} onClick={() => void edit(entry.name)}>Edit</Button>
              <Button size="sm" variant="outline" disabled={busy} onClick={() => void exportFile(entry.name)}>Export</Button>
            </>}
          <Button size="sm" variant="outline" disabled={busy} onClick={() => { setDestination(""); void apply("delete", full(entry.name)) }}>Delete</Button>
        </div>
      </div>)}
      {entries?.length === 0 && <p className="text-muted-foreground text-sm">Workspace is empty.</p>}
    </div>
    <Input aria-label="New workspace name" placeholder="New file or directory name" value={newName}
      disabled={busy} onChange={event => setNewName(event.target.value)} />
    <div className="flex flex-wrap gap-2">
      <Button size="sm" disabled={busy || !newName.trim()} onClick={() => void apply("mkdir", full(newName.trim()))}>New directory</Button>
      <Button size="sm" variant="outline" disabled={busy || !newName.trim()} onClick={() => { setFile(full(newName.trim())); setContent("") }}>New text file</Button>
    </div>
    {file && <div className="space-y-2">
      <p className="break-all text-sm font-medium">Editor: {file}</p>
      <Textarea aria-label="Workspace file editor" rows={8} value={content} onChange={event => setContent(event.target.value)} />
      <Button size="sm" disabled={busy} onClick={() => void apply("save", file)}>Save file</Button>
    </div>}
    <div className="space-y-2">
      <p className="text-sm font-medium">Rename or move</p>
      <Input aria-label="Workspace source path" placeholder="Source relative path" value={file}
        onChange={event => setFile(event.target.value)} />
      <Input aria-label="Workspace destination path" placeholder="Destination relative path" value={destination}
        onChange={event => setDestination(event.target.value)} />
      <Button size="sm" variant="outline" disabled={busy || !file || !destination}
        onClick={() => void apply("rename", file)}>Move / Rename</Button>
      <Button size="sm" variant="outline" disabled={busy || !file || !destination}
        onClick={() => void apply("copy", file)}>Copy file</Button>
    </div>
    <Feedback error={error} done={done} />
  </div>
}

export function WorkspaceBackupActions({ refreshToken = 0 }: { refreshToken?: number }) {
  const [items, setItems] = React.useState<SnapshotInfo[] | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [done, setDone] = React.useState<string | null>(null)
  const load = async () => {
    const response = await inspect<{ snapshots: SnapshotInfo[] }>("snapshots")
    setItems(response.snapshots)
  }
  React.useEffect(() => {
    let active = true
    void inspect<{ snapshots: SnapshotInfo[] }>("snapshots").then(response => {
      if (active) setItems(response.snapshots)
    }).catch(() => { if (active) setError("Backup inventory unavailable") })
    return () => { active = false }
  }, [refreshToken])
  const run = async (name: "create" | "restore" | "delete" | "verify", snapshot?: string) => {
    if (busy || (name !== "verify" && !window.confirm(name === "restore"
      ? "Restore snapshot " + snapshot + "? The current workspace will be preserved in a sidecar."
      : name === "delete" ? "Permanently remove snapshot " + snapshot + "?" : "Create workspace snapshot?"))) return
    setBusy(true); setError(null); setDone(null)
    try {
      const response = await action<{ verification?: { name: string; state: string; files: number } }>({
        action: "snapshot", name, path: snapshot,
      })
      if (name !== "verify") await load()
      setDone(name === "verify" && response.verification
        ? "Snapshot integrity: " + response.verification.state + " (" + response.verification.files + " files)"
        : "Workspace snapshot " + name + " completed")
    } catch { setError("Snapshot result unconfirmed. Inspect snapshots before retrying.") }
    finally { setBusy(false) }
  }
  return <div className="space-y-3 rounded-md border p-3">
    <h3 className="text-sm font-medium">Workspace snapshots</h3>
    <Button disabled={busy} size="sm" onClick={() => void run("create")}>Create snapshot</Button>

    {items?.map(item => <div key={item.name} className="flex flex-wrap items-center justify-between gap-2 border-b py-2 text-xs">
      <span>{item.createdAt.slice(0, 19).replace("T", " ")} · {item.files} files</span>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" disabled={busy}
          onClick={() => void run("verify", item.name)}>Verify</Button>
        <Button size="sm" variant="outline" disabled={busy}
          onClick={() => void run("restore", item.name)}>Restore</Button>
        <Button size="sm" variant="outline" disabled={busy}
          onClick={() => void run("delete", item.name)}>Delete</Button>
      </div>
    </div>)}
    {items?.length === 0 && <p className="text-muted-foreground text-xs">No workspace snapshots yet.</p>}
    <Feedback error={error} done={done} />
    <p className="text-muted-foreground text-xs">Snapshots cover only the H3-owned workspace, not arbitrary Termux apps or databases.</p>
  </div>
}


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


// Preserve existing public imports while keeping the large Runit workflow isolated.
export { RunitServiceActions } from "./runit-service-actions"
export { PackageManager } from "./package-manager"
