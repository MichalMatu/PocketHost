import * as React from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import type { FleetSite } from "@/lib/site-fleet-schema"

type CommandResponse = { operation: string; result: { exit: number; output: string } }
type FileInfo = { name: string; kind: "directory" | "file"; bytes: number }
type SnapshotInfo = { name: string; createdAt: string; files: number }
const endpoint = "/api/v1/termux-admin"

async function action<T>(payload: { action: string; name?: string; path?: string; destination?: string; content?: string }): Promise<T> {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-PocketHost-Intent": "termux-admin" },
    credentials: "same-origin",
    body: JSON.stringify(payload),
  })
  if (!response.ok) throw new Error("Operation failed or was refused. No success was assumed.")
  return await response.json() as T
}
async function inspect<T>(mode: string, location = ""): Promise<T> {
  const request = mode === "files" ? endpoint + "?mode=files&path=" + encodeURIComponent(location) :
    endpoint + "?mode=" + mode
  const response = await fetch(request, { method: "GET", credentials: "same-origin", cache: "no-store" })
  if (!response.ok) throw new Error("Inventory cannot be inspected.")
  return await response.json() as T
}
function Feedback({ error, done }: { error: string | null; done: string | null }) {
  return <>{error && <p role="alert" className="text-destructive text-sm">{error}</p>}
    {done && <p role="status" className="text-sm">{done}</p>}</>
}

export function PackageActions() {
  const [name, setName] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [done, setDone] = React.useState<string | null>(null)
  const [output, setOutput] = React.useState("")
  const run = async (kind: "install" | "remove" | "upgrade" | "refresh" | "upgrade-all", preview = false) => {
    if (busy) return
    if (!preview && !window.confirm("Run Termux package operation: " + kind + (name ? " " + name : "") + "? This can alter system packages.")) return
    setBusy(true); setDone(null); setError(null); setOutput("")
    try {
      const data = await action<CommandResponse>({ action: preview ? "package-preview" : "package", name: kind,
        path: ["install","remove","upgrade"].includes(kind) ? name.trim() : undefined })
      setOutput(data.result.output)
      setDone((preview ? "Simulation " : "Operation ") + kind + " finished with exit " + data.result.exit)
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Package operation failed.") }
    finally { setBusy(false) }
  }
  return <div className="space-y-3 rounded-md border p-3">
    <h3 className="text-sm font-medium">Manage Termux packages</h3>
    <Input aria-label="Package name" placeholder="Package name, e.g. git" value={name}
      disabled={busy} onChange={event => setName(event.target.value)} />
    <div className="flex flex-wrap gap-2">
      <Button size="sm" disabled={busy} onClick={() => void run("refresh")}>Refresh package indexes</Button>
      <Button size="sm" disabled={busy || !name.trim()} onClick={() => void run("install")}>Install</Button>
      <Button size="sm" variant="outline" disabled={busy || !name.trim()} onClick={() => void run("upgrade")}>Upgrade package</Button>
      <Button size="sm" variant="outline" disabled={busy || !name.trim()} onClick={() => void run("remove")}>Remove</Button>
      <Button size="sm" variant="outline" disabled={busy} onClick={() => void run("upgrade-all")}>Upgrade all</Button>
      <Button size="sm" variant="secondary" disabled={busy || !name.trim()} onClick={() => void run("install", true)}>Preview install</Button>
      <Button size="sm" variant="secondary" disabled={busy || !name.trim()} onClick={() => void run("remove", true)}>Preview removal</Button>
      <Button size="sm" variant="secondary" disabled={busy} onClick={() => void run("upgrade-all", true)}>Preview upgrade all</Button>
    </div>
    {busy && <p role="status">Running the selected operation…</p>}
    <Feedback error={error} done={done} />
    {output && <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded bg-muted p-2 text-xs">{output}</pre>}
    <p className="text-muted-foreground text-xs">Calls the existing Termux apt engine with fixed arguments. No shell input.</p>
  </div>
}

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

export function SiteServiceActions({ sites, reload }: { sites: FleetSite[] | null; reload: () => Promise<void> }) {
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [done, setDone] = React.useState<string | null>(null)
  const [logLines, setLogLines] = React.useState<{ site: string; lines: string[] } | null>(null)
  const readLogs = async (site: FleetSite) => {
    setBusy(true); setError(null); setDone(null)
    try {
      const response = await fetch("/api/v1/sites/" + site.id + "/logs", {
        method: "GET", credentials: "same-origin", cache: "no-store",
      })
      if (!response.ok) throw new Error("Owned service logs unavailable")
      const body: unknown = await response.json()
      if (!body || typeof body !== "object" || !("logs" in body) ||
          !Array.isArray(body.logs) || body.logs.length > 25 ||
          !body.logs.every(line => typeof line === "string" && line.length <= 200))
        throw new Error("Invalid service logs")
      setLogLines({ site: site.name, lines: body.logs })
    } catch { setError("Service logs unavailable; no processes were changed.") }
    finally { setBusy(false) }
  }
  const run = async (site: FleetSite, name: "start" | "stop" | "restart") => {
    if (busy || !window.confirm("Run " + name + " for PocketHost-owned site " + site.name + "?")) return
    setBusy(true); setError(null); setDone(null)
    try {
      const response = await fetch("/api/v1/sites/" + site.id + "/" + name, {
        method: "POST", credentials: "same-origin",
        headers: { "X-PocketHost-Intent": "owned-sites" },
      })
      if (!response.ok) throw new Error("Exact-site identity or process checks refused the operation.")
      await reload()
      setDone(site.name + ": " + name + " completed")
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Service operation failed") }
    finally { setBusy(false) }
  }
  return <div className="space-y-3 rounded-md border p-3">
    <h3 className="text-sm font-medium">Manage owned services</h3>
    {sites?.map(site => <div key={site.id} className="flex flex-wrap items-center justify-between gap-2 border-b py-2">
      <div><p className="text-sm">{site.name}</p><Badge variant="outline">{site.state}</Badge></div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" disabled={busy || site.state === "unknown"}
          onClick={() => void readLogs(site)}>Logs</Button>
        <Button size="sm" disabled={busy || site.state !== "stopped" || !site.activeRelease}
          onClick={() => void run(site, "start")}>Start</Button>
        <Button size="sm" variant="outline" disabled={busy || site.state !== "running"}
          onClick={() => void run(site, "restart")}>Restart</Button>
        <Button size="sm" variant="outline" disabled={busy || site.state !== "running"}
          onClick={() => void run(site, "stop")}>Stop</Button>
      </div>
    </div>)}
    {logLines && <div className="space-y-2 rounded border p-2">
      <p className="text-sm font-medium">Logs: {logLines.site}</p>
      <pre className="max-h-40 overflow-auto whitespace-pre-wrap text-xs">{logLines.lines.join("\n") || "No recent logs"}</pre>
    </div>}
    <p className="text-muted-foreground text-xs">Existing H2 process ownership checks stay in force. Unrelated runit services are not adopted.</p>
    <Feedback error={error} done={done} />
  </div>
}

export function WorkspaceBackupActions() {
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
  }, [])
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
    } catch { setError("Workspace snapshot operation failed safely.") }
    finally { setBusy(false) }
  }
  return <div className="space-y-3 rounded-md border p-3">
    <h3 className="text-sm font-medium">Workspace snapshots</h3>
    <Button disabled={busy} size="sm" onClick={() => void run("create")}>Create snapshot</Button>
    <Button disabled={busy} size="sm" variant="outline"
      onClick={() => void load().catch(() => setError("Backup inventory unavailable"))}>Refresh snapshots</Button>
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
