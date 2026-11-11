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

type PackageEcosystem = "termux" | "node" | "python"
type InstalledPackage = { name: string; version: string }
type AvailablePackage = { name: string; description: string }
type PackageSummary = {
  installed: Array<InstalledPackage & { ecosystem: PackageEcosystem }>
  state: string
  truncated: boolean
  observedAt: string
  updates: { state: string; candidates: string[] }
}
type PackageKind = "install" | "remove" | "upgrade" | "upgrade-all"
type SelectedPackage = { name: string; ecosystem: PackageEcosystem; version?: string; description?: string }
type PackagePlan = { kind: PackageKind; name?: string; output: string }
type PackageInventory = { packages: InstalledPackage[]; truncated: boolean }

const validPackageName = (value: string) => /^[a-z0-9][a-z0-9+.-]{0,39}$/.test(value)

export function PackageManager({
  summary, summaryError = false, refreshToken = 0, onChanged,
}: {
  summary?: PackageSummary | null
  summaryError?: boolean
  refreshToken?: number
  onChanged?: () => void
}) {
  const [ecosystem, setEcosystem] = React.useState<PackageEcosystem>("termux")
  const [installed, setInstalled] = React.useState<PackageInventory | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [reload, setReload] = React.useState(0)
  const [query, setQuery] = React.useState("")
  const [sort, setSort] = React.useState<"name" | "version">("name")
  const [descending, setDescending] = React.useState(false)
  const [selected, setSelected] = React.useState<SelectedPackage | null>(null)
  const [found, setFound] = React.useState<{ packages: AvailablePackage[]; truncated: boolean } | null>(null)
  const [catalogBusy, setCatalogBusy] = React.useState(false)
  const [operationBusy, setOperationBusy] = React.useState(false)
  const [plan, setPlan] = React.useState<PackagePlan | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [inventoryError, setInventoryError] = React.useState(false)
  const [message, setMessage] = React.useState<string | null>(null)
  const [output, setOutput] = React.useState("")

  React.useEffect(() => {
    let active = true
    void inspect<PackageInventory>("packages").then(result => {
      if (!Array.isArray(result.packages) || result.packages.length > 700 ||
        result.packages.some(item => !item || typeof item.name !== "string" || typeof item.version !== "string"))
        throw new Error("Invalid package inventory")
      if (active) { setInstalled(result); setInventoryError(false) }
    }).catch(() => { if (active) setInventoryError(true) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [refreshToken, reload])

  const changeEcosystem = (next: PackageEcosystem) => {
    setEcosystem(next); setQuery(""); setSelected(null); setPlan(null); setFound(null)
    setError(null); setMessage(null); setOutput("")
  }
  const choose = (item: SelectedPackage) => {
    setSelected(item); setPlan(null); setError(null); setMessage(null); setOutput("")
  }
  const changeQuery = (value: string) => {
    setQuery(value); setPlan(null); setFound(null); setSelected(null); setError(null)
  }
  const visible = (ecosystem === "termux"
    ? (installed?.packages ?? []).map(item => ({ ...item, ecosystem: "termux" as const }))
    : (summary?.installed ?? []).filter(item => item.ecosystem === ecosystem))
    .filter(item => (item.name + " " + item.version).toLowerCase().includes(query.toLowerCase().trim()))
    .sort((a, b) => {
      const comparison = a[sort].localeCompare(b[sort], undefined, { numeric: true }) || a.name.localeCompare(b.name)
      return descending ? -comparison : comparison
    })
  const chooseSort = (column: "name" | "version") => {
    if (sort === column) setDescending(previous => !previous)
    else { setSort(column); setDescending(false) }
  }
  const searchCatalog = async () => {
    const term = query.trim().toLowerCase()
    if (catalogBusy || operationBusy || ecosystem !== "termux" || !validPackageName(term)) return
    setCatalogBusy(true); setError(null); setFound(null)
    try {
      const result = await inspect<{ packages: AvailablePackage[]; truncated: boolean }>("search-packages", term)
      if (!Array.isArray(result.packages) || result.packages.length > 60) throw new Error("Invalid catalog")
      setFound(result)
    } catch { setError("Termux catalog search failed.") }
    finally { setCatalogBusy(false) }
  }
  const request = async (kind: PackageKind | "refresh", preview: boolean, name?: string): Promise<CommandResponse> => {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-PocketHost-Intent": "termux-admin" },
      credentials: "same-origin",
      body: JSON.stringify({
        action: preview ? "package-preview" : "package",
        name: kind,
        path: kind === "install" || kind === "remove" || kind === "upgrade" ? name : undefined,
      }),
    })
    if (!response.ok) throw new Error("HTTP " + response.status)
    const data = await response.json() as CommandResponse
    if (!data?.result || typeof data.result.exit !== "number" || typeof data.result.output !== "string")
      throw new Error("Invalid apt response")
    if (data.result.exit !== 0) throw new Error("apt exit " + data.result.exit)
    return data
  }
  const preview = async (kind: PackageKind) => {
    const name = kind === "upgrade-all" ? undefined : selected?.ecosystem === "termux" ? selected.name : undefined
    if (operationBusy || catalogBusy || (kind !== "upgrade-all" && (!name || !validPackageName(name)))) return
    setOperationBusy(true); setPlan(null); setError(null); setMessage(null); setOutput("")
    try {
      const data = await request(kind, true, name)
      setPlan({ kind, name, output: data.result.output })
      setOutput(data.result.output)
      setMessage("Preview ready · no changes made")
    } catch (cause) {
      setError("Preview failed (" + (cause instanceof Error ? cause.message : "unknown") + "). No changes made.")
    } finally { setOperationBusy(false) }
  }
  const reconcile = () => {
    setReload(current => current + 1)
    onChanged?.()
  }
  const apply = async () => {
    const approved = plan
    if (!approved || operationBusy ||
      (approved.kind !== "upgrade-all" && (selected?.ecosystem !== "termux" || selected.name !== approved.name))) return
    if (!window.confirm("Apply Termux " + approved.kind +
      (approved.name ? " " + approved.name : "") + " after preview? This changes installed packages.")) return
    setOperationBusy(true); setPlan(null); setError(null); setMessage(null); setOutput("")
    try {
      const data = await request(approved.kind, false, approved.name)
      setOutput(data.result.output)
      setMessage("Operation completed · inventory refreshed")
    } catch (cause) {
      setError("Result unconfirmed (" + (cause instanceof Error ? cause.message : "connection lost") +
        "). Inspect installed packages before retrying. No automatic retry.")
    } finally {
      setOperationBusy(false); setFound(null); reconcile()
    }
  }
  const refreshIndexes = async () => {
    if (operationBusy || !window.confirm("Refresh Termux apt indexes? This changes local package metadata.")) return
    setOperationBusy(true); setPlan(null); setMessage(null); setError(null); setOutput("")
    try {
      const data = await request("refresh", false)
      setOutput(data.result.output)
      setMessage("Package indexes refreshed")
    } catch (cause) {
      setError("Index refresh result unconfirmed (" + (cause instanceof Error ? cause.message : "connection lost") + ").")
    } finally {
      setOperationBusy(false); setFound(null); reconcile()
    }
  }
  const selectedInstalled = selected?.ecosystem === "termux" &&
    installed?.packages.some(item => item.name === selected.name)
  const canManage = selected?.ecosystem === "termux" && validPackageName(selected.name)
  const isBusy = operationBusy || catalogBusy
  const cachedUpdateHints = new Set(summary?.updates.state === "cached-unverified"
    ? summary.updates.candidates : [])
  const counts = {
    termux: installed?.packages.length ?? null,
    node: summary?.installed.filter(item => item.ecosystem === "node").length ?? null,
    python: summary?.installed.filter(item => item.ecosystem === "python").length ?? null,
  }

  return <div className="space-y-4">
    <div className="flex flex-wrap items-center gap-2" aria-label="Package ecosystems">
      {(["termux", "node", "python"] as const).map(item =>
        <Button key={item} size="sm" variant={ecosystem === item ? "secondary" : "outline"}
          onClick={() => changeEcosystem(item)} disabled={isBusy}>
          {item === "termux" ? "Termux" : item === "node" ? "Node" : "Python"} · {counts[item] ?? "—"}
        </Button>)}
      {ecosystem !== "termux" && <Badge variant="outline">Read-only sample</Badge>}
      {ecosystem === "termux" && installed?.truncated && <Badge variant="outline">Partial inventory</Badge>}
      {ecosystem === "termux" && summary?.updates.state === "cached-unverified" &&
        <Badge variant="outline">{summary.updates.candidates.length} cached update hints · unverified</Badge>}
    </div>

    <div className="flex flex-wrap gap-2">
      <Input aria-label="Search packages" className="min-w-44 flex-1" placeholder="Search packages…"
        value={query} disabled={isBusy} onChange={event => changeQuery(event.target.value)} />
      {ecosystem === "termux" && <>
        <Button size="sm" variant="outline" disabled={isBusy || !validPackageName(query.trim().toLowerCase())}
          onClick={() => void searchCatalog()}>Search catalog</Button>
        <Button size="sm" variant="outline" disabled={isBusy}
          title="Refreshes local apt metadata only; it does not install updates"
          onClick={() => void refreshIndexes()}>Check updates</Button>
        <Button size="sm" variant="outline" disabled={isBusy}
          onClick={() => void preview("upgrade-all")}>Preview all upgrades</Button>
      </>}
    </div>

    {inventoryError && ecosystem === "termux" &&
      <p role="alert">Termux inventory unavailable. {installed ? "Showing last successful result." : "Try Refresh."}</p>}
    {summaryError && ecosystem !== "termux" && <p role="alert">Ecosystem metadata may be outdated.</p>}
    {loading && !installed && ecosystem === "termux" &&
      <div aria-label="Loading package inventory" className="space-y-2">
        {[0, 1, 2].map(item => <div key={item} className="h-7 animate-pulse rounded bg-muted" />)}
      </div>}
    {(!loading || installed || ecosystem !== "termux") &&
      <div className="max-h-[30rem] overflow-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-background">
            <tr className="border-b">
              <th className="p-2 text-left"><button type="button" onClick={() => chooseSort("name")}>
                Package {sort === "name" ? (descending ? "↓" : "↑") : ""}
              </button></th>
              <th className="p-2 text-left"><button type="button" onClick={() => chooseSort("version")}>
                Version {sort === "version" ? (descending ? "↓" : "↑") : ""}
              </button></th>
              {ecosystem === "termux" && <th className="p-2 text-left">Updates</th>}
            </tr>
          </thead>
          <tbody>
            {visible.map(item => <tr key={item.ecosystem + ":" + item.name}
              className={selected?.ecosystem === item.ecosystem && selected.name === item.name ? "bg-muted/50" : "border-b"}>
              <td className="p-2"><button type="button" className="text-left font-medium underline-offset-4 hover:underline"
                disabled={isBusy} onClick={() => choose(item)}>{item.name}</button></td>
              <td className="p-2 font-mono text-xs">{item.version}</td>
              {ecosystem === "termux" && <td className="p-2 text-xs">
                {cachedUpdateHints.has(item.name) ? <Badge variant="outline">Cached hint</Badge> :
                  <span aria-label="No cached update hint" className="text-muted-foreground">—</span>}
              </td>}
            </tr>)}
          </tbody>
        </table>
        {visible.length === 0 && !inventoryError && <p className="p-3 text-sm text-muted-foreground">No matching packages.</p>}
      </div>}

    {found && ecosystem === "termux" && <div className="space-y-1">
      <p className="text-sm font-medium">Catalog results · {found.packages.length}{found.truncated ? "+" : ""}</p>
      <div className="max-h-56 overflow-auto rounded-md border">
        {found.packages.map(item => <button type="button" key={item.name}
          className="block w-full border-b p-2 text-left text-sm hover:bg-muted" disabled={isBusy}
          onClick={() => choose({ ecosystem: "termux", name: item.name, description: item.description,
            version: installed?.packages.find(entry => entry.name === item.name)?.version })}>
          <span className="font-medium">{item.name}</span>
          {item.description && <span className="ml-2 text-muted-foreground">{item.description}</span>}
        </button>)}
        {found.packages.length === 0 && <p className="p-3 text-sm">No catalog matches.</p>}
      </div>
    </div>}

    {selected && <div className="space-y-3 rounded-md border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium">{selected.name}</span>
        <Badge variant="outline">{selected.ecosystem !== "termux" ? "Read-only" :
          selectedInstalled ? "Installed" : "Not installed"}</Badge>
      </div>
      {selected.version && <p className="font-mono text-xs">{selected.version}</p>}
      {selected.ecosystem === "termux" && cachedUpdateHints.has(selected.name) &&
        <p className="text-muted-foreground text-xs">Cached update hint · verify with Check updates before applying.</p>}
      {selected.description && <p className="text-sm text-muted-foreground">{selected.description}</p>}
      {canManage && <div className="flex flex-wrap gap-2">
        <Button size="sm" disabled={isBusy} onClick={() => void preview("install")}>Preview install</Button>
        <Button size="sm" variant="outline" disabled={isBusy || !selectedInstalled}
          onClick={() => void preview("upgrade")}>Preview upgrade</Button>
        <Button size="sm" variant="outline" disabled={isBusy || !selectedInstalled}
          onClick={() => void preview("remove")}>Preview removal</Button>
      </div>}
    </div>}

    {plan && <div className="space-y-2 rounded-md border p-3">
      <p className="text-sm font-medium">Preview: {plan.kind}{plan.name ? " · " + plan.name : ""}</p>
      <p className="text-xs text-muted-foreground">Apt simulation only. Confirm before applying.</p>
      <Button size="sm" disabled={isBusy} onClick={() => void apply()}>Apply previewed changes</Button>
    </div>}
    {operationBusy && <p role="status">Termux operation in progress…</p>}
    {message && <p role="status" className="text-sm">{message}</p>}
    {error && <p role="alert" className="text-destructive text-sm">{error}</p>}
    {output && <pre className="max-h-60 overflow-auto whitespace-pre-wrap rounded-md bg-muted p-2 text-xs">{output}</pre>}
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

type RunitEntry = { name: string; registered: boolean; protected: boolean; state: "running" | "stopped" | "unknown"; enabled?: boolean | null }

// UI guard only: the panel and its watcher must not be stopped from this page.
const isPanelService = (service: RunitEntry) =>
  service.name === "pockethost-panel" || service.name === "pockethost-panel-watch"

export function RunitServiceActions({ refreshToken = 0 }: { refreshToken?: number }) {
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
  }, [refreshToken])
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
    if (busy || service.protected || isPanelService(service) || !window.confirm(
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
    </div>
    <p className="text-muted-foreground text-xs">
      Register grants lifecycle controls (start, stop, restart, autostart); it does not start a service.
      Protected services and the PocketHost panel/watch are read-only here.
    </p>
    {services?.length === 0 && <p className="text-muted-foreground text-xs">No discoverable runit services.</p>}
    {services?.map(service => <div className="flex flex-wrap items-center justify-between gap-2 border-b py-2" key={service.name}>
      <div className="space-y-1">
        <p className="text-sm font-medium">{service.name}</p>
        <div className="flex gap-2">
          <Badge variant="outline">{service.state}</Badge>
          <Badge variant="outline">{service.enabled === null || service.enabled === undefined ? "Autostart unknown" :
            service.enabled ? "Autostart enabled" : "Autostart disabled"}</Badge>
          <Badge variant="outline">{service.protected ? "Protected" : isPanelService(service) ? "Panel · read-only" : service.registered ? "Registered" : "Observed"}</Badge>
        </div>
      </div>
      {!service.protected && !isPanelService(service) && <div className="flex flex-wrap gap-1">
        {service.registered ? <>
          <Button size="sm" disabled={busy || service.state === "running"} onClick={() => void perform("start", service)}>Start</Button>
          <Button size="sm" variant="outline" disabled={busy || service.state !== "running"} onClick={() => void perform("stop", service)}>Stop</Button>
          <Button size="sm" variant="outline" disabled={busy || service.state !== "running"} onClick={() => void perform("restart", service)}>Restart</Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => void perform("enable", service)}>Enable</Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => void perform("disable", service)}>Disable</Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => void readServiceLogs(service)}>Logs</Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => void perform("unregister", service)}>Unregister</Button>
        </> : <Button size="sm" variant="outline" disabled={busy}
          title="Grant lifecycle controls; this does not start the service"
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
