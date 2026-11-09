import * as React from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

type CommandResponse = { operation: string; result: { exit: number; output: string } }
type FileInfo = { name: string; kind: "directory" | "file"; bytes: number }
type SnapshotInfo = { name: string; createdAt: string; files: number }
const endpoint = "/api/v1/termux-admin"

async function action<T>(payload: { action: string; name?: string; path?: string; destination?: string; content?: string; base64?: string }): Promise<T> {
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
    mode === "search-packages" ? endpoint + "?mode=search-packages&query=" + encodeURIComponent(location) :
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

type RunitEntry = { name: string; registered: boolean; protected: boolean; state: "running" | "stopped" | "unknown"; enabled?: boolean | null }

export function RunitServiceActions() {
  const [services, setServices] = React.useState<RunitEntry[] | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [done, setDone] = React.useState<string | null>(null)
  const [serviceLogs, setServiceLogs] = React.useState<{ name: string; lines: string[] } | null>(null)
  const refresh = React.useCallback(async () => {
    const data = await inspect<{ services: RunitEntry[] }>("services")
    if (!Array.isArray(data.services) || data.services.length > 100 ||
        !data.services.every(item => /^[a-z][a-z0-9-]{1,63}$/.test(item.name) &&
          typeof item.registered === "boolean" && typeof item.protected === "boolean" &&
          ["running", "stopped", "unknown"].includes(item.state)))
      throw new Error("Invalid runit inventory")
    setServices(data.services)
  }, [])
  React.useEffect(() => {
    let active = true
    void inspect<{ services: RunitEntry[] }>("services").then(result => {
      if (active) setServices(result.services)
    }).catch(() => { if (active) setError("Runit services unavailable") })
    return () => { active = false }
  }, [])
  const readServiceLogs = async (service: RunitEntry) => {
    setBusy(true); setError(null)
    try {
      const result = await action<{ lines: string[] }>({ action: "service-logs", path: service.name })
      if (!Array.isArray(result.lines) || result.lines.length > 100 ||
          !result.lines.every(line => typeof line === "string" && line.length <= 240))
        throw new Error("Invalid runit logs")
      setServiceLogs({ name: service.name, lines: result.lines })
    } catch { setError("Registered runit service log unavailable.") }
    finally { setBusy(false) }
  }
  const perform = async (name: "register" | "unregister" | "start" | "stop" | "restart" | "enable" | "disable", service: RunitEntry) => {
    if (busy || service.protected || !window.confirm(
      name === "register" ?
        "Register service " + service.name + " for PocketHost lifecycle control? Registration does not start or stop it." :
        "Run " + name + " for explicitly registered runit service " + service.name + "?",
    )) return
    setBusy(true); setError(null); setDone(null)
    try {
      await action({ action: "service", name, path: service.name })
      await refresh()
      setDone(service.name + ": " + name + " completed")
    } catch {
      setError("Service action rejected. Registration, identity or runit availability may have changed.")
    } finally { setBusy(false) }
  }
  return <div className="space-y-3 rounded-md border p-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className="text-sm font-medium">Runit services</h3>
      <Button size="sm" variant="outline" disabled={busy}
        onClick={() => void refresh().catch(() => setError("Runit inventory unavailable"))}>Refresh runit</Button>
    </div>
    <p className="text-muted-foreground text-xs">
      Existing services are only observed until you explicitly register them.
      Protected system services are never available for registration or mutation.
    </p>
    {services?.length === 0 && <p className="text-muted-foreground text-xs">No discoverable runit services.</p>}
    {services?.map(service => <div className="flex flex-wrap items-center justify-between gap-2 border-b py-2" key={service.name}>
      <div className="space-y-1">
        <p className="text-sm font-medium">{service.name}</p>
        <div className="flex gap-2">
          <Badge variant="outline">{service.state}</Badge>
          <Badge variant="outline">{service.enabled === null || service.enabled === undefined ? "Autostart unknown" :
            service.enabled ? "Autostart enabled" : "Autostart disabled"}</Badge>
          <Badge variant="outline">{service.protected ? "Protected" : service.registered ? "Registered" : "Observed"}</Badge>
        </div>
      </div>
      {!service.protected && <div className="flex flex-wrap gap-1">
        {service.registered ? <>
          <Button size="sm" disabled={busy || service.state === "running"} onClick={() => void perform("start", service)}>Start</Button>
          <Button size="sm" variant="outline" disabled={busy || service.state !== "running"} onClick={() => void perform("stop", service)}>Stop</Button>
          <Button size="sm" variant="outline" disabled={busy || service.state !== "running"} onClick={() => void perform("restart", service)}>Restart</Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => void perform("enable", service)}>Enable</Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => void perform("disable", service)}>Disable</Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => void readServiceLogs(service)}>Logs</Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => void perform("unregister", service)}>Unregister</Button>
        </> : <Button size="sm" variant="outline" disabled={busy}
          onClick={() => void perform("register", service)}>Register</Button>}
      </div>}
    </div>)}
    {serviceLogs && <div className="rounded-md border p-2">
      <p className="text-sm font-medium">Runit logs: {serviceLogs.name}</p>
      <pre className="max-h-56 overflow-auto whitespace-pre-wrap text-xs">{serviceLogs.lines.join("\n")}</pre>
    </div>}
    <Feedback error={error} done={done} />
  </div>
}

type InstalledPackage = { name: string; version: string }
type AvailablePackage = { name: string; description: string }
export function PackageCatalog() {
  const [installed, setInstalled] = React.useState<{ packages: InstalledPackage[]; truncated: boolean } | null>(null)
  const [found, setFound] = React.useState<{ packages: AvailablePackage[]; truncated: boolean } | null>(null)
  const [filter, setFilter] = React.useState("")
  const [query, setQuery] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const loadInstalled = async () => {
    if (busy) return
    setBusy(true); setError(null)
    try {
      const result = await inspect<{ packages: InstalledPackage[]; truncated: boolean }>("packages")
      if (!Array.isArray(result.packages) || result.packages.length > 700)
        throw new Error("Invalid package inventory")
      setInstalled(result)
    } catch { setError("Full installed-package inventory is unavailable.") }
    finally { setBusy(false) }
  }
  const search = async () => {
    if (busy || !/^[a-z0-9][a-z0-9+.-]{0,39}$/.test(query)) return
    setBusy(true); setError(null)
    try {
      const result = await inspect<{ packages: AvailablePackage[]; truncated: boolean }>("search-packages", query)
      if (!Array.isArray(result.packages) || result.packages.length > 60)
        throw new Error("Invalid package search")
      setFound(result)
    } catch { setError("Termux apt package catalog is unavailable.") }
    finally { setBusy(false) }
  }
  const visible = installed?.packages.filter(item => item.name.toLowerCase().includes(filter.toLowerCase().trim())) ?? []
  return <div className="space-y-3 rounded-md border p-3">
    <h3 className="text-sm font-medium">Full Termux package catalog</h3>
    <Button size="sm" variant="outline" disabled={busy} onClick={() => void loadInstalled()}>
      Load installed Termux packages
    </Button>
    {installed && <>
      <Input aria-label="Filter complete package inventory" placeholder="Filter installed software" value={filter}
        onChange={event => setFilter(event.target.value)} />
      <p className="text-muted-foreground text-xs">
        {installed.packages.length} installed Termux packages {installed.truncated ? "(truncated)" : "(complete within the catalog limit)"}
      </p>
      <div className="max-h-64 overflow-auto">
        {visible.map(item => <div key={item.name} className="flex flex-wrap justify-between gap-2 border-b py-2 text-xs">
          <span>{item.name}</span><span className="font-mono">{item.version}</span>
        </div>)}
      </div>
    </>}
    <div className="flex flex-wrap gap-2">
      <Input className="min-w-40 flex-1" aria-label="Search available Termux software" placeholder="Find available packages" value={query}
        onChange={event => setQuery(event.target.value.toLowerCase())} />
      <Button size="sm" disabled={busy || !/^[a-z0-9][a-z0-9+.-]{0,39}$/.test(query)}
        onClick={() => void search()}>Search catalog</Button>
    </div>
    {found && <div className="max-h-64 space-y-1 overflow-auto">
      {found.packages.map(item => <div key={item.name} className="border-b py-2 text-xs">
        <p className="font-medium">{item.name}</p>
        <p className="text-muted-foreground">{item.description}</p>
      </div>)}
      {found.packages.length === 0 && <p className="text-sm">No packages found.</p>}
      {found.truncated && <p className="text-xs">Search results truncated.</p>}
    </div>}
    {error && <p role="alert" className="text-destructive text-sm">{error}</p>}
    <p className="text-muted-foreground text-xs">Uses dpkg-query and apt-cache directly, without reimplementing package resolution.</p>
  </div>
}

type ResticStatus = { initialized: boolean; repositoryPresent: boolean; keyPresent: boolean }
type ResticSnapshot = { id: string; time: string; paths: string[] }

export function ResticActions({ detected }: { detected: boolean }) {
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
  }, [detected])
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
    <p className="text-muted-foreground text-xs">
      Native Restic stores H3 workspace snapshots in its own encrypted local repository.
      The recovery key is generated once and stored privately on Termux;
      keep a separate secure copy for recovery after device loss.
    </p>
    {!detected && <p className="text-muted-foreground text-sm">Restic executable not detected. Install restic from Packages to use this integration.</p>}
    {detected && <>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">{status?.initialized ? "Repository initialized" : "Repository not initialized"}</Badge>
        <Button size="sm" variant="outline" disabled={busy}
          onClick={() => void refresh().catch(() => setError("Restic refresh failed"))}>Refresh Restic</Button>
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
    <p className="text-muted-foreground text-xs">
      Restic restores to isolated staging, not over active services. This is a local backup until an off-device destination is configured.
    </p>
  </div>
}
