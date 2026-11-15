import * as React from "react"
import { Link } from "react-router-dom"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

type CommandResponse = { operation: string; result: { exit: number; output: string } }
type FileInfo = { name: string; kind: "directory" | "file"; bytes: number }
type SnapshotInfo = { name: string; createdAt: string; files: number }
const endpoint = "/api/v1/termux-admin"

async function action<T>(payload: { action: string; name?: string; root?: string; path?: string; destination?: string; content?: string; base64?: string }): Promise<T> {
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
    (mode === "python-source-review" || mode === "python-source-history")
      ? endpoint + "?mode=" + mode + "&name=" + encodeURIComponent(location) :
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
  const [view, setView] = React.useState<"installed" | "available">("installed")
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

  // Installed inventory and catalog search share an input, but switching back
  // to installed must not retain a catalog-only filter or package selection.
  const changeView = (next: "installed" | "available") => {
    setView(next)
    if (next === "installed") setQuery("")
    setSelected(null); setPlan(null); setError(null); setMessage(null); setOutput("")
  }
  const changeEcosystem = (next: PackageEcosystem) => {
    setEcosystem(next); setView("installed"); setQuery(""); setSelected(null); setPlan(null); setFound(null)
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
    setView("available"); setCatalogBusy(true); setError(null); setFound(null)
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
      setMessage("Operation completed · inventory refresh requested")
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

    {ecosystem === "termux" && <div role="tablist" aria-label="Package views" className="flex flex-wrap gap-2">
      <Button size="sm" role="tab" aria-selected={view === "installed"}
        variant={view === "installed" ? "secondary" : "outline"} disabled={isBusy}
        onClick={() => changeView("installed")}>Installed</Button>
      <Button size="sm" role="tab" aria-selected={view === "available"}
        variant={view === "available" ? "secondary" : "outline"} disabled={isBusy}
        onClick={() => changeView("available")}>Available</Button>
    </div>}
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
    {loading && !installed && ecosystem === "termux" && view === "installed" &&
      <div aria-label="Loading package inventory" className="space-y-2">
        {[0, 1, 2].map(item => <div key={item} className="h-7 animate-pulse rounded bg-muted" />)}
      </div>}
    {(ecosystem !== "termux" || view === "installed") && (!loading || installed || ecosystem !== "termux") &&
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
        {visible.length === 0 && !inventoryError && <p className="p-3 text-sm text-muted-foreground">No matching installed packages.</p>}
      </div>}

    {ecosystem === "termux" && view === "available" && !found && !catalogBusy &&
      <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
        Search the Termux catalog above. Results are separate from installed packages and searching makes no changes.
      </p>}
    {found && ecosystem === "termux" && view === "available" && <div className="space-y-1">
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

type WorkerTemplate = "heartbeat-worker-v1" | "python-heartbeat-v1" | "python-source-v1" | "node-source-v1"
type PythonSourceReview = {
  name: string
  template: "python-source-v1"
  sourceSha256: string
  sourceBytes: number
  observed: "running" | "stopped" | "unknown"
  autostart: boolean | null
  canStartFromLan: false
  ownerApproval: "not-configured"
  checkedAt: string
}
type PythonSourceHistory = {
  name: string
  currentSha256: string
  revisions: {
    id: string; sourceSha256: string; bytes: number; savedAt: string
  }[]
  execution: "blocked"
}
type ArchivedEntry = {
  name: string
  template: WorkerTemplate
  identity: "restorable" | "changed" | "conflict"
}
type NodeSourceReview = Omit<PythonSourceReview, "template"> & { template: "node-source-v1" }
type NodeSourceHistory = PythonSourceHistory
type RunitEntry = {
  name: string
  registered: boolean
  protected: boolean
  identity?: "verified" | "unregistered" | "legacy" | "changed" | "archive-conflict" | "reserved"
  identityReason?: "run-sha-attested" | "no-enrollment" | "legacy-without-sha" |
    "service-target-changed" | "run-script-changed" | "archive-live-conflict" |
    "reserved-system-service"
  template?: WorkerTemplate
  control: "standalone" | "delegated" | "read-only"
  state: "running" | "stopped" | "unknown"
  enabled?: boolean | null
  project?: { id: string; name: string }
}

// UI guard only: the panel and its watcher must not be stopped from this page.
const isPanelService = (service: RunitEntry) =>
  service.name === "pockethost-panel" || service.name === "pockethost-panel-watch"

// A successful write receipt is not proof of enrollment. Trust only a fresh,
// server-attested inventory entry with the intended template and safe state.
const confirmedStoppedWorker = (items: RunitEntry[], name: string, template: WorkerTemplate) =>
  items.some(item => item.name === name && item.registered === true &&
    item.protected === false && item.identity === "verified" &&
    item.identityReason === "run-sha-attested" && item.control === "standalone" &&
    item.template === template && item.state === "stopped" && item.enabled === false)

export function RunitServiceActions({
  refreshToken = 0, mode = "lifecycle",
}: { refreshToken?: number; mode?: "lifecycle" | "autostart" }) {
  const [services, setServices] = React.useState<RunitEntry[] | null>(null)
  const [archived, setArchived] = React.useState<ArchivedEntry[]>([])
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [done, setDone] = React.useState<string | null>(null)
  const [serviceLogs, setServiceLogs] = React.useState<{ name: string; lines: string[] } | null>(null)
  const [sourceReview, setSourceReview] = React.useState<PythonSourceReview | null>(null)
  const [sourceHistory, setSourceHistory] = React.useState<PythonSourceHistory | null>(null)
  const [nodeSourceReview, setNodeSourceReview] = React.useState<NodeSourceReview | null>(null)
  const [nodeSourceHistory, setNodeSourceHistory] = React.useState<NodeSourceHistory | null>(null)
  const [nodeReplacement, setNodeReplacement] = React.useState("")
  const [creatorOpen, setCreatorOpen] = React.useState(false)
  const [workerName, setWorkerName] = React.useState("")
  const [workerTemplate, setWorkerTemplate] = React.useState<WorkerTemplate>("heartbeat-worker-v1")
  const [pythonSource, setPythonSource] = React.useState("")
  const [pythonReplacement, setPythonReplacement] = React.useState("")
  const refresh = React.useCallback(async () => {
    const data = await inspect<{ services: RunitEntry[]; archived?: ArchivedEntry[] }>("services")
    if (!Array.isArray(data.services) || data.services.length > 100 ||
        !data.services.every(item => /^[a-z][a-z0-9-]{1,63}$/.test(item.name) &&
          typeof item.registered === "boolean" && typeof item.protected === "boolean" &&
          ["standalone", "delegated", "read-only"].includes(item.control) &&
          ((item.control === "read-only" && item.protected && !item.registered) ||
            (item.control === "standalone" && !item.protected && item.registered && !!item.template) ||
            (item.control === "delegated" && !item.protected && item.registered && !item.template)) &&
          ["running", "stopped", "unknown"].includes(item.state) &&
          (item.identity === undefined ||
            ["verified", "unregistered", "legacy", "changed", "archive-conflict", "reserved"].includes(item.identity)) &&
          (item.identityReason === undefined ||
            ["run-sha-attested", "no-enrollment", "legacy-without-sha",
             "service-target-changed", "run-script-changed", "archive-live-conflict",
             "reserved-system-service"].includes(item.identityReason)) &&
          (item.template === undefined ||
            item.template === "heartbeat-worker-v1" || item.template === "python-heartbeat-v1" ||
            item.template === "python-source-v1" || item.template === "node-source-v1") &&
          (item.project === undefined ||
            (item.control === "delegated" && !item.template &&
              typeof item.project === "object" && item.project !== null &&
              /^node-[a-f0-9]{32}$/.test(item.project.id) &&
              typeof item.project.name === "string" &&
              item.project.name.length > 0 && item.project.name.length <= 60))))
      throw new Error("Invalid runit inventory")
    if (!Array.isArray(data.archived) || data.archived.length > 4 ||
        !data.archived.every(item => /^[a-z][a-z0-9-]{1,63}$/.test(item.name) &&
          ["heartbeat-worker-v1", "python-heartbeat-v1", "python-source-v1", "node-source-v1"].includes(item.template) &&
          ["restorable", "changed", "conflict"].includes(item.identity)))
      throw new Error("Invalid archived worker inventory")
    setArchived(data.archived)
    setServices(data.services)
    setSourceReview(null)
    setSourceHistory(null)
    setNodeSourceReview(null)
    setNodeSourceHistory(null)
    setPythonReplacement("")
    setError(null)
    return { services: data.services, archived: data.archived }
  }, [])
  React.useEffect(() => {
    let active = true
    void refresh().catch(() => { if (active) setError("Runit services unavailable") })
    return () => { active = false }
  }, [refreshToken])
  const reviewPythonSource = async (name: string) => {
    if (busy) return
    setBusy(true); setError(null); setSourceReview(null); setSourceHistory(null)
    try {
      const result = await inspect<PythonSourceReview>("python-source-review", name)
      if (result.name !== name || result.template !== "python-source-v1" ||
          !/^[a-f0-9]{64}$/.test(result.sourceSha256) ||
          !Number.isSafeInteger(result.sourceBytes) || result.sourceBytes < 1 ||
          result.sourceBytes > 32 * 1024 ||
          !["running", "stopped", "unknown"].includes(result.observed) ||
          ![true, false, null].includes(result.autostart) ||
          result.canStartFromLan !== false || result.ownerApproval !== "not-configured" ||
          !Number.isFinite(Date.parse(result.checkedAt)))
        throw new Error("Invalid Python source review")
      setSourceReview(result)
    } catch {
      setError("Python source identity review refused or unavailable. Recheck ownership.")
    } finally { setBusy(false) }
  }
  const reviewNodeSource = async (name: string) => {
    if (busy) return
    setBusy(true); setError(null); setNodeSourceReview(null); setNodeSourceHistory(null)
    try {
      const result = await inspect<NodeSourceReview>("node-source-review", name)
      if (result.name !== name || result.template !== "node-source-v1" ||
          !/^[a-f0-9]{64}$/.test(result.sourceSha256) ||
          !Number.isSafeInteger(result.sourceBytes) || result.sourceBytes < 1 ||
          result.sourceBytes > 32 * 1024 ||
          !["running", "stopped", "unknown"].includes(result.observed) ||
          ![true, false, null].includes(result.autostart) ||
          result.canStartFromLan !== false || result.ownerApproval !== "not-configured" ||
          !Number.isFinite(Date.parse(result.checkedAt)))
        throw new Error("Invalid Node.js source review")
      setNodeSourceReview(result)
    } catch {
      setError("Node.js source identity review refused or unavailable. Recheck ownership.")
    } finally { setBusy(false) }
  }
  const loadPythonSourceHistory = async (name: string) => {
    if (busy || sourceReview?.name !== name) return
    setBusy(true); setError(null); setSourceHistory(null)
    try {
      const result = await inspect<PythonSourceHistory>("python-source-history", name)
      if (result.name !== name || result.currentSha256 !== sourceReview.sourceSha256 ||
          result.execution !== "blocked" || !Array.isArray(result.revisions) ||
          result.revisions.length > 8 || result.revisions.some(item =>
            !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(item.id) ||
            !/^[a-f0-9]{64}$/.test(item.sourceSha256) ||
            !Number.isSafeInteger(item.bytes) || item.bytes < 1 || item.bytes > 32768 ||
            !Number.isFinite(Date.parse(item.savedAt))))
        throw new Error("Revision history unavailable or stale")
      setSourceHistory(result)
    } catch {
      setError("Python revision history unverified. Refresh the source review.")
    } finally { setBusy(false) }
  }
  const restorePythonRevision = async (item: PythonSourceHistory["revisions"][number]) => {
    const record = sourceReview, history = sourceHistory
    if (busy || !record || !history || record.name !== history.name ||
        record.sourceSha256 !== history.currentSha256 ||
        record.observed !== "stopped" || record.autostart !== false) return
    if (window.prompt("Restore saved Python revision " + item.id +
        " for " + record.name + "? Type the exact service name.") !== record.name ||
        !window.confirm("Restore SHA-256 " + item.sourceSha256 +
          "? The current source will be retained and no Python code will execute.")) return
    setBusy(true); setError(null); setDone(null)
    setSourceHistory(null); setSourceReview(null)
    try {
      const result = await action<{
        changed: boolean; sourceSha256: string; sourceBytes: number; execution: "blocked"
      }>({ action: "service-python-restore", path: record.name,
        name: item.id, root: record.sourceSha256, destination: item.sourceSha256 })
      if (result.sourceSha256 !== item.sourceSha256 || result.execution !== "blocked" ||
          typeof result.changed !== "boolean" ||
          !Number.isSafeInteger(result.sourceBytes) ||
          result.sourceBytes < 1 || result.sourceBytes > 32768)
        throw new Error("Unexpected Python restore receipt")
      await refresh()
      setDone(record.name + ": previous Python source restored, execution still blocked")
    } catch {
      setError("Python source restore refused or unconfirmed. Refresh identity before any retry.")
    } finally { setBusy(false) }
  }
  const replacePythonSource = async () => {
    const review = sourceReview
    const bytes = new Blob([pythonReplacement]).size
    if (busy || !review || review.observed !== "stopped" ||
        review.autostart !== false || !pythonReplacement.trim() ||
        bytes < 1 || bytes > 32 * 1024) return
    if (window.prompt(
      "Replace the source for " + review.name +
      "? Enter the exact service name. The previous source is retained privately " +
      "and the new source will NOT execute.",
    ) !== review.name || !window.confirm(
      "Commit new worker.py for " + review.name + " only if its SHA-256 remains " +
      review.sourceSha256 + "? Start and autostart will stay blocked.",
    )) return
    setBusy(true); setError(null); setDone(null)
    // Any uncertain response must invalidate the old digest, not retry.
    setSourceReview(null)
    try {
      const result = await action<{
        changed: boolean; sourceSha256: string; sourceBytes: number; execution: "blocked"
      }>({ action: "service-python-update", path: review.name,
        destination: review.sourceSha256, content: pythonReplacement })
      if (typeof result.changed !== "boolean" ||
          !/^[a-f0-9]{64}$/.test(result.sourceSha256) ||
          !Number.isSafeInteger(result.sourceBytes) ||
          result.sourceBytes < 1 || result.sourceBytes > 32 * 1024 ||
          result.execution !== "blocked")
        throw new Error("Python revision receipt invalid")
      await refresh()
      setDone(review.name + ": source revision acknowledged. Review its new SHA before further changes.")
    } catch {
      setError("Python revision refused or unconfirmed. Inspect current source/marker; never retry blindly.")
    } finally {
      setBusy(false)
    }
  }
  const loadNodeSourceHistory = async (name: string) => {
    if (busy || nodeSourceReview?.name !== name) return
    setBusy(true); setError(null); setNodeSourceHistory(null)
    try {
      const result = await inspect<NodeSourceHistory>("python-source-history", name)
      if (result.name !== name || result.currentSha256 !== nodeSourceReview.sourceSha256 ||
          result.execution !== "blocked" || !Array.isArray(result.revisions) ||
          result.revisions.length > 8 || result.revisions.some(item =>
            !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(item.id) ||
            !/^[a-f0-9]{64}$/.test(item.sourceSha256) ||
            !Number.isSafeInteger(item.bytes) || item.bytes < 1 || item.bytes > 32768 ||
            !Number.isFinite(Date.parse(item.savedAt))))
        throw new Error("Revision history unavailable or stale")
      setNodeSourceHistory(result)
    } catch {
      setError("Node.js revision history unverified. Refresh the source review.")
    } finally { setBusy(false) }
  }
  const restoreNodeRevision = async (item: NodeSourceHistory["revisions"][number]) => {
    const record = nodeSourceReview, history = nodeSourceHistory
    if (busy || !record || !history || record.name !== history.name ||
        record.sourceSha256 !== history.currentSha256 ||
        record.observed !== "stopped" || record.autostart !== false) return
    if (window.prompt("Restore saved Node.js revision " + item.id +
        " for " + record.name + "? Type the exact service name.") !== record.name ||
        !window.confirm("Restore SHA-256 " + item.sourceSha256 +
          "? The current source will be retained and no Node.js code will execute.")) return
    setBusy(true); setError(null); setDone(null)
    setNodeSourceHistory(null); setNodeSourceReview(null)
    try {
      const result = await action<{
        changed: boolean; sourceSha256: string; sourceBytes: number; execution: "blocked"
      }>({ action: "service-node-restore", path: record.name,
        name: item.id, root: record.sourceSha256, destination: item.sourceSha256 })
      if (result.sourceSha256 !== item.sourceSha256 || result.execution !== "blocked" ||
          typeof result.changed !== "boolean" ||
          !Number.isSafeInteger(result.sourceBytes) ||
          result.sourceBytes < 1 || result.sourceBytes > 32768)
        throw new Error("Unexpected Node.js restore receipt")
      await refresh()
      setDone(record.name + ": previous Node.js source restored, execution still blocked")
    } catch {
      setError("Node.js source restore refused or unconfirmed. Refresh identity before any retry.")
    } finally { setBusy(false) }
  }
  const replaceNodeSource = async () => {
    const review = nodeSourceReview
    const bytes = new Blob([nodeReplacement]).size
    if (busy || !review || review.observed !== "stopped" ||
        review.autostart !== false || !nodeReplacement.trim() ||
        bytes < 1 || bytes > 32 * 1024) return
    if (window.prompt(
      "Replace the source for " + review.name +
      "? Enter the exact service name. The previous source is retained privately " +
      "and the new source will NOT execute.",
    ) !== review.name || !window.confirm(
      "Commit new worker.mjs for " + review.name + " only if its SHA-256 remains " +
      review.sourceSha256 + "? Start and autostart will stay blocked.",
    )) return
    setBusy(true); setError(null); setDone(null)
    // Any uncertain response must invalidate the old digest, not retry.
    setNodeSourceReview(null)
    try {
      const result = await action<{
        changed: boolean; sourceSha256: string; sourceBytes: number; execution: "blocked"
      }>({ action: "service-node-update", path: review.name,
        destination: review.sourceSha256, content: nodeReplacement })
      if (typeof result.changed !== "boolean" ||
          !/^[a-f0-9]{64}$/.test(result.sourceSha256) ||
          !Number.isSafeInteger(result.sourceBytes) ||
          result.sourceBytes < 1 || result.sourceBytes > 32 * 1024 ||
          result.execution !== "blocked")
        throw new Error("Node.js revision receipt invalid")
      await refresh()
      setDone(review.name + ": source revision acknowledged. Review its new SHA before further changes.")
    } catch {
      setError("Node.js revision refused or unconfirmed. Inspect current source/marker; never retry blindly.")
    } finally {
      setBusy(false)
    }
  }
  const readServiceLogs = async (name: string) => {
    if (busy) return
    setBusy(true); setError(null)
    try {
      const result = await action<{ lines: string[] }>({ action: "service-logs", path: name })
      if (!Array.isArray(result.lines) || result.lines.length > 100 ||
          !result.lines.every(line => typeof line === "string" && line.length <= 240))
        throw new Error("Invalid runit logs")
      setServiceLogs({ name, lines: result.lines })
    } catch { setError("Attested service log unavailable. Verify archive identity before retrying.") }
    finally { setBusy(false) }
  }
  const perform = async (name: "start" | "stop" | "restart" | "enable" | "disable", service: RunitEntry) => {
    if (busy || service.control !== "standalone" || service.protected || isPanelService(service) ||
        (mode === "autostart" && name !== "enable" && name !== "disable") ||
        (mode === "lifecycle" && (name === "enable" || name === "disable")) ||
        !window.confirm(
      name === "enable"
        ? "Enable persistent runit autostart for " + service.name +
          "? Removing its down marker can also start the service now. " +
          "This does not configure Android/Termux:Boot."
        : name === "disable"
          ? "Disable persistent runit autostart for " + service.name +
            "? This records the down marker and may stop the service now."
          : "Run " + name + " for explicitly registered runit service " + service.name + "?",
    )) return
    setBusy(true); setError(null); setDone(null)
    try {
      await action({ action: "service", name, path: service.name })
      try {
        const live = await refresh()
        if (name === "enable" || name === "disable") {
          const observed = live.services.find(item => item.name === service.name)
          if (!observed || !observed.registered || observed.protected ||
              observed.enabled !== (name === "enable")) {
            setError("Autostart command returned but persistent desired state was not verified.")
            return
          }
          setDone(service.name + ": runit autostart " +
            (observed.enabled ? "enabled" : "disabled") + " · saved and verified")
        } else {
          setDone(service.name + ": " + name + " acknowledged · inventory refreshed")
        }
      } catch {
        setDone(service.name + ": " + name + " acknowledged · status not refreshed")
        setError("Service inventory refresh failed. Verify live state before another command.")
      }
    } catch {
      setError("Service result unconfirmed or refused. Verify registration and live state before retrying.")
    } finally { setBusy(false) }
  }
  const archiveWorker = async (service: RunitEntry) => {
    if (busy || !service.template || service.control !== "standalone" ||
        !service.registered || service.protected ||
        service.state !== "stopped" || service.enabled !== false ||
        !window.confirm("Archive PocketHost worker " + service.name +
          "? This detaches its own runit supervisor and removes it from the service inventory. " +
          "The run script and logs are retained for recovery; no foreign files are deleted.")) return
    setBusy(true); setError(null); setDone(null)
    try {
      const receipt = await action<{ changed: boolean; archived: boolean; retainedFiles: boolean }>(
        { action: "service-archive", name: service.template, path: service.name })
      if (receipt.changed !== true || receipt.archived !== true || receipt.retainedFiles !== true)
        throw new Error("Archive receipt incomplete")
      try {
        const snapshot = await refresh()
        const saved = snapshot.archived.find(item => item.name === service.name)
        if (snapshot.services.some(item => item.name === service.name) ||
            saved?.template !== service.template || saved.identity !== "restorable") {
          setError("Archive acknowledged, but ownership or archive readback is inconsistent. Do not retry.")
          return
        }
        setServiceLogs(previous => previous?.name === service.name ? null : previous)
        setDone(service.name + ": worker archived and verified; script and logs retained")
      } catch {
        setError("Archive acknowledged but inventory refresh failed. Verify state before any follow-up.")
      }
    } catch {
      setError("Archive refused or unconfirmed. Verify worker identity and stopped state before retrying.")
    } finally { setBusy(false) }
  }
  const restoreWorker = async (entry: ArchivedEntry) => {
    if (busy || entry.identity !== "restorable" ||
        !window.confirm("Restore archived " +
          (entry.template === "python-source-v1" ? "Python source" :
            entry.template === "node-source-v1" ? "Node.js source" :
            entry.template === "python-heartbeat-v1" ? "Python" : "Node.js") +
          " service " + entry.name +
          "? The application worker stays stopped with autostart disabled. " +
          "Runit may launch only its own supervisor/logger.")) return
    setBusy(true); setError(null); setDone(null)
    try {
      const receipt = await action<{ changed: boolean; restored: boolean; started: boolean }>(
        { action: "service-restore", name: entry.template, path: entry.name })
      if (receipt.changed !== true || receipt.restored !== true || receipt.started !== false)
        throw new Error("Restore receipt incomplete")
      try {
        const snapshot = await refresh()
        if (!confirmedStoppedWorker(snapshot.services, entry.name, entry.template) ||
            snapshot.archived.some(item => item.name === entry.name)) {
          setError("Restore acknowledged, but verified stopped ownership was not read back. Do not retry.")
          return
        }
        setDone(entry.name + ": restored, verified and stopped; autostart disabled")
      } catch {
        setError("Restore acknowledged but inventory refresh failed. Verify before any lifecycle action.")
      }
    } catch {
      setError("Restore refused or unconfirmed. Check archived identity; do not retry automatically.")
    } finally { setBusy(false) }
  }
  const retireWorker = async (entry: ArchivedEntry) => {
    if (busy || entry.identity !== "restorable") return
    const typed = window.prompt(
      "Retire " + entry.name + "? This permanently revokes restoration in PocketHost. " +
      "The owned script and logs will be quarantined on the device, not deleted. " +
      "Type the exact service name to confirm.",
    )
    if (typed !== entry.name ||
        !window.confirm("Retire " + entry.name +
          " from the PocketHost registry? The service cannot be restored from the panel. " +
          "Files remain in private on-device quarantine for manual review.")) return
    setBusy(true); setError(null); setDone(null)
    try {
      const response = await action<{
        changed: boolean; retired: boolean; restorable: boolean; filesRetained: boolean
      }>({ action: "service-retire", name: entry.template, path: entry.name })
      if (response.changed !== true || response.retired !== true ||
          response.restorable !== false || response.filesRetained !== true)
        throw new Error("Unverified retirement receipt")
      try {
        const snapshot = await refresh()
        if (snapshot.archived.some(item => item.name === entry.name) ||
            snapshot.services.some(item => item.name === entry.name)) {
          setError("Retirement acknowledged, but service or archive remains visible. Inspect before retrying.")
          return
        }
        setServiceLogs(previous => previous?.name === entry.name ? null : previous)
        setDone(entry.name + ": retired from registry; definition and logs quarantined")
      } catch {
        setError("Retirement acknowledged but archive inventory is unavailable. Inspect before retrying.")
      }
    } catch {
      setError("Retirement refused or unconfirmed. Do not repeat automatically; inspect archive state.")
    } finally { setBusy(false) }
  }
  const createWorker = async () => {
    const name = workerName.trim()
    const custom = workerTemplate === "python-source-v1" || workerTemplate === "node-source-v1"
    if (busy || !/^[a-z][a-z0-9-]{1,63}$/.test(name) ||
        (custom && (!pythonSource.trim() ||
          new Blob([pythonSource]).size > 32 * 1024)) ||
      !window.confirm(custom
        ? "Stage exact " + (workerTemplate === "node-source-v1" ? "Node.js" : "Python") +
          " source for " + name + "? Code will NOT execute from this LAN panel. The file is saved" +
          " with SHA-256 and requires a separately authorized owner executor."
        : "Create a new stopped PocketHost-owned " +
          (workerTemplate === "python-heartbeat-v1" ? "Python" : "Node.js") +
          " heartbeat worker " + name +
          "? It uses a fixed, isolated template and will not start automatically.")) return
    setBusy(true); setError(null); setDone(null)
    try {
      const receipt = await action<{ changed: boolean; name: string; template: WorkerTemplate }>(
        { action: "service-create", name: workerTemplate, path: name,
          ...(custom ? { content: pythonSource } : {}) })
      if (receipt.changed !== true || receipt.name !== name || receipt.template !== workerTemplate)
        throw new Error("Creation receipt incomplete")
      try {
        const snapshot = await refresh()
        if (!confirmedStoppedWorker(snapshot.services, name, workerTemplate) ||
            snapshot.archived.some(item => item.name === name)) {
          setError("Service created, but stopped ownership and autostart were not verified. Inspect before retrying.")
          return
        }
        setDone(name + (custom
          ? ": source staged, verified and stopped · execution blocked in LAN Services"
          : ": verified stopped worker · autostart disabled"))
        setCreatorOpen(false); setWorkerName(""); setPythonSource("")
      } catch {
        setError("Creation acknowledged but inventory refresh failed. Verify identity before retrying.")
      }
    } catch {
      setError("Service creation refused or unconfirmed. Refresh before retrying; no automatic retry.")
    } finally { setBusy(false) }
  }
  const counts = services ? {
    owned: services.filter(isPanelService).length,
    managed: services.filter(item => item.control === "standalone").length,
    delegated: services.filter(item => item.control === "delegated").length,
    protected: services.filter(item => item.identity === "reserved" && !isPanelService(item)).length,
    unverified: services.filter(item => !item.registered && !isPanelService(item) && item.identity !== "reserved").length,
    changed: services.filter(item => item.identity === "changed" || item.identity === "archive-conflict").length,
    conflicts: services.filter(item => item.identity === "archive-conflict").length +
      archived.filter(item => item.identity === "conflict").length,
  } : null
  const serviceRow = (service: RunitEntry) => <div className="flex flex-wrap items-center justify-between gap-2 border-b py-2" key={service.name}>
      <div className="space-y-1">
        <p className="text-sm font-medium">{service.name}</p>
        <div className="flex flex-wrap gap-2" aria-label={"Status for " + service.name}>
          <Badge variant="outline">State: {service.state}</Badge>
          <Badge variant="outline">{service.enabled === null || service.enabled === undefined ? "Autostart unknown" :
            service.enabled ? "Autostart enabled" : "Autostart disabled"}</Badge>
          <Badge variant="outline">{isPanelService(service) ? "PocketHost-owned" :
            service.control === "standalone" ? "Standalone · attested" :
            service.control === "delegated" ? "Provisioner-owned · attested" :
            service.identity === "archive-conflict" ? "Archive conflict · blocked" :
            service.identity === "changed" ? "Identity changed · blocked" :
            service.identity === "legacy" ? "Legacy record · needs reattestation" :
            service.identity === "unregistered" ? "Discovered · unverified" : "Protected · read-only"}</Badge>
          {service.template && <Badge variant="outline">{service.template === "node-source-v1" ? "Node.js source · execution blocked" :
            service.template === "python-source-v1" ? "Python source · execution blocked" :
            service.template === "python-heartbeat-v1" ? "Python heartbeat" : "Node.js heartbeat"}</Badge>}
          {service.project && <Badge variant="outline">Node project: {service.project.name}</Badge>}
        </div>
      </div>
      {service.control === "read-only" && service.identityReason &&
        <p className="text-xs text-muted-foreground" aria-label={"Ownership for " + service.name}>
          {service.identityReason === "service-target-changed" ? "Recorded service path no longer matches. Commands blocked." :
           service.identityReason === "run-script-changed" ? "Recorded run script SHA-256 no longer matches. Commands blocked." :
           service.identityReason === "legacy-without-sha" ? "Old enrollment lacks a verified script digest. Commands blocked." :
           service.identityReason === "archive-live-conflict" ? "Archived and live enrollment conflict. Commands blocked." :
           service.identityReason === "no-enrollment" ? "Discovered only; no verified enrollment. Commands blocked." :
           "Protected system service. Commands blocked."}
        </p>}
      {service.state === "unknown" && mode === "lifecycle" &&
        <p className="text-xs text-muted-foreground">
          Runtime state unknown. Start, Stop and Restart require a confirmed state.
        </p>}
      {service.control === "delegated" && <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">
          Managed by its creator. Generic runit actions are blocked to protect release identity.
        </span>
        <Link to={service.project ? "/projects?project=" + encodeURIComponent(service.project.id) : "/projects"}
          className="text-xs underline underline-offset-4">
          {service.project ? "Open owning project" : "Review Projects"}
        </Link>
      </div>}
      {service.control === "standalone" && !isPanelService(service) && <div className="flex flex-wrap gap-1">
        {mode === "lifecycle" ? (service.registered ? <>
          <Button size="sm" disabled={busy || service.state !== "stopped" ||
              (service.template === "python-source-v1" || service.template === "node-source-v1")}
            onClick={() => void perform("start", service)}>Start</Button>
          <Button size="sm" variant="outline" disabled={busy || service.state !== "running"}
            onClick={() => void perform("stop", service)}>Stop</Button>
          <Button size="sm" variant="outline" disabled={busy || service.state !== "running" ||
              (service.template === "python-source-v1" || service.template === "node-source-v1")}
            onClick={() => void perform("restart", service)}>Restart</Button>
          <Button size="sm" variant="outline" disabled={busy}
            onClick={() => void readServiceLogs(service.name)}>Logs</Button>
          {service.template === "python-source-v1" &&
            <Button size="sm" variant="outline" disabled={busy}
              onClick={() => void reviewPythonSource(service.name)}>Review Python source</Button>}
          {service.template === "node-source-v1" &&
            <Button size="sm" variant="outline" disabled={busy}
              onClick={() => void reviewNodeSource(service.name)}>Review Node.js source</Button>}
          {service.template &&
            <Button size="sm" variant="outline"
              disabled={busy || service.state !== "stopped" || service.enabled !== false}
              title="Archive only the attested PocketHost worker. Keeps its script and logs."
              onClick={() => void archiveWorker(service)}>Archive worker</Button>}
        </> : <span className="text-xs text-muted-foreground">Not enrolled</span>) :
          (service.registered ? <>
            <Button size="sm" variant="outline"
              disabled={busy || service.enabled !== false ||
                (service.template === "python-source-v1" || service.template === "node-source-v1")}
              onClick={() => void perform("enable", service)}>Enable autostart</Button>
            <Button size="sm" variant="outline"
              disabled={busy || service.enabled !== true}
              onClick={() => void perform("disable", service)}>Disable autostart</Button>
          </> : <span className="text-xs text-muted-foreground">
            Not enrolled · register in Runit services first
          </span>)}
      </div>}
  </div>
  return <div className="space-y-3 rounded-md border p-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className="text-sm font-medium">{mode === "autostart" ? "Autostart registry" : "Runit services"}</h3>
      <Button size="sm" variant="outline" disabled={busy} onClick={() => void refresh().catch(() => setError("Runit services unavailable"))}>Refresh services</Button>
    </div>
    <p className="text-muted-foreground text-xs">
      {mode === "autostart"
        ? "Autostart changes apply only to PocketHost standalone workers. Project-created units are managed by their own provisioner. Each change is confirmed against the down marker; enable/disable may start/stop the worker. Android and Termux:Boot are separate."
        : "Standalone workers are managed here. Other attested services remain visible but their lifecycle stays with the creating project or provisioner. Unregistered and protected services are read-only; process liveness is not readiness."}
    </p>
    {mode === "lifecycle" && <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-muted-foreground text-xs">
          Standalone workers need no Project. Only PocketHost-created, attested services can be managed.
        </p>
        <Button size="sm" variant="outline" disabled={busy}
          onClick={() => setCreatorOpen(open => !open)}>
          {creatorOpen ? "Close creator" : "Add Service"}
        </Button>
      </div>
      {creatorOpen && <div className="space-y-3 rounded-md border p-3" aria-label="Add standalone service">
        <p className="text-sm font-medium">Create standalone service</p>
        <p className="text-muted-foreground text-xs">
          Create a fixed Node.js/Python heartbeat worker, or stage your own
          immutable Python/Node.js source. Source is never executed or enabled by
          this LAN page; only a separately authorized local owner workflow
          can review activation. Maximum four definitions and 32 KB per source.
          No process adoption or arbitrary service path is allowed.
        </p>
        <div className="flex flex-wrap gap-2" aria-label="Worker runtime">
          <Button size="sm" disabled={busy}
            variant={workerTemplate === "heartbeat-worker-v1" ? "secondary" : "outline"}
            aria-pressed={workerTemplate === "heartbeat-worker-v1"}
            onClick={() => setWorkerTemplate("heartbeat-worker-v1")}>Node.js</Button>
          <Button size="sm" disabled={busy}
            variant={workerTemplate === "python-heartbeat-v1" ? "secondary" : "outline"}
            aria-pressed={workerTemplate === "python-heartbeat-v1"}
            onClick={() => setWorkerTemplate("python-heartbeat-v1")}>Python heartbeat</Button>
          <Button size="sm" disabled={busy}
            variant={workerTemplate === "python-source-v1" ? "secondary" : "outline"}
            aria-pressed={workerTemplate === "python-source-v1"}
            onClick={() => setWorkerTemplate("python-source-v1")}>My Python code</Button>
          <Button size="sm" disabled={busy}
            variant={workerTemplate === "node-source-v1" ? "secondary" : "outline"}
            aria-pressed={workerTemplate === "node-source-v1"}
            onClick={() => setWorkerTemplate("node-source-v1")}>My Node.js code</Button>
        </div>
        {(workerTemplate === "python-source-v1" || workerTemplate === "node-source-v1") && <div className="space-y-2">
          <label htmlFor="python-worker-source" className="text-sm font-medium">
            {workerTemplate === "node-source-v1" ? "worker.mjs source" : "worker.py source"}
          </label>
          <Textarea id="python-worker-source" value={pythonSource}
            onChange={event => setPythonSource(event.target.value)}
            maxLength={32 * 1024} rows={7} disabled={busy}
            placeholder={workerTemplate === "node-source-v1" ? 'console.log("Hello from Node.js")' : 'print("Hello from Python")'} />
          <p className="text-xs text-muted-foreground">
            Stored privately without executing, dependencies or network listener.
            Start, Restart, Autostart and recovery are disabled from this page.
          </p>
        </div>}
        <div className="flex flex-wrap items-center gap-2">
          <Input aria-label="New service name" placeholder="e.g. monitoring-worker"
            className="min-w-48 max-w-72" maxLength={64} disabled={busy}
            value={workerName} onChange={event => setWorkerName(event.target.value.toLowerCase())} />
          <Button size="sm" disabled={busy || !/^[a-z][a-z0-9-]{1,63}$/.test(workerName) ||
              ((workerTemplate === "python-source-v1" || workerTemplate === "node-source-v1") &&
                (!pythonSource.trim() || new Blob([pythonSource]).size > 32 * 1024))}
            onClick={() => void createWorker()}>
            {workerTemplate === "node-source-v1" ? "Stage Node.js source" :
              workerTemplate === "python-source-v1" ? "Stage Python source" : "Create stopped service"}
          </Button>
        </div>
        <p className="text-muted-foreground text-xs">
          Names must be unique and 2–64 characters: lowercase letters, digits and hyphens.
          Creating a service never executes staged source or enables autostart.
        </p>
      </div>}
    </>}
    {!services && !error && <p role="status" className="text-sm text-muted-foreground">Loading runit services…</p>}
    {services?.length === 0 && <p className="text-muted-foreground text-xs">No discoverable runit services.</p>}
    {counts && <div className="flex flex-wrap gap-2" aria-label="PocketHost service coordination summary">
      <Badge variant="outline">PocketHost-owned: {counts.owned}</Badge>
      <Badge variant="outline">Standalone: {counts.managed}</Badge>
      <Badge variant="outline">Delegated: {counts.delegated}</Badge>
      <Badge variant="outline">Protected: {counts.protected}</Badge>
      <Badge variant="outline">Unverified: {counts.unverified}</Badge>
      {counts.changed > 0 && <Badge variant="outline">Identity changed: {counts.changed}</Badge>}
      {counts.conflicts > 0 && <Badge variant="outline">Archive conflicts: {counts.conflicts}</Badge>}
    </div>}
    {mode === "lifecycle" && services && counts?.managed === 0 && (
      <div className="space-y-2 rounded-md border p-3">
        <p className="text-sm font-medium">No attested managed services yet</p>
        <p className="text-muted-foreground text-xs">
          Run a PocketHost-provisioned Node project to create an owned runit unit.
          An arbitrary discovered service cannot be adopted by renaming it or clicking Register.
          Use Add Service to create a bounded Node.js or Python service.
          Owned Node projects register their runtimes separately; user code
          and external adoption require source/ownership qualification.
        </p>
        <Button size="sm" variant="outline" render={<Link to="/projects" />}>Open Projects</Button>
      </div>
    )}
    {services?.filter(service => service.registered && !service.protected && !isPanelService(service)).map(serviceRow)}
    {services && services.some(service => service.protected || isPanelService(service)) &&
      <section className="rounded-md border p-2" aria-label="Protected and PocketHost-owned services">
        <h4 className="text-sm font-medium">Unverified or protected services · view only</h4>
        {services.some(service => service.identity === "changed") && (
          <p role="alert" className="text-xs">
            A registered unit no longer matches its recorded run script or target.
            Controls are blocked until independently reattested by its creator.
          </p>
        )}
        {services.some(service => service.identity === "archive-conflict") && (
          <p role="alert" className="text-xs">
            Archive and live service ownership records overlap. All lifecycle controls are
            blocked until the partial operation is inspected and reconciled.
          </p>
        )}
        <p className="py-2 text-xs text-muted-foreground">
          Lifecycle state and autostart come from runit. Application health is independent.
        </p>
        {services.filter(service => service.protected || isPanelService(service)).map(serviceRow)}
      </section>}
    {mode === "lifecycle" && archived.length > 0 && <section className="space-y-2 rounded-md border p-3"
      aria-label="Archived PocketHost workers">
      <p className="text-sm font-medium">Archived workers ({archived.length})</p>
      <p className="text-xs text-muted-foreground">
        Archive retains service code and logs. Saved logs can be read only for an
        independently attested archived definition. Restore returns it stopped with
        autostart disabled. Retire revokes future restoration and moves the
        definition and logs to bounded private quarantine (no deletion).
        Entries in conflict or with changed identity are read-only and require inspection.
      </p>
      {archived.map(entry => <div className="flex flex-wrap items-center justify-between gap-2 border-b py-2" key={entry.name}>
        <div className="space-y-1">
          <p className="text-sm font-medium">{entry.name}</p>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">{entry.template === "python-source-v1" ? "Python source" :
              entry.template === "node-source-v1" ? "Node.js source" :
              entry.template === "python-heartbeat-v1" ? "Python heartbeat" : "Node.js"}</Badge>
            <Badge variant="outline">{entry.identity === "restorable" ? "Archived · verified" :
              entry.identity === "conflict" ? "Archive/live conflict · blocked" : "Identity changed · blocked"}</Badge>
          </div>
        </div>
        <div className="flex flex-wrap gap-1">
          <Button size="sm" variant="outline" disabled={busy || entry.identity !== "restorable"}
            onClick={() => void readServiceLogs(entry.name)}>Saved logs</Button>
          <Button size="sm" variant="outline" disabled={busy || entry.identity !== "restorable"}
            onClick={() => void restoreWorker(entry)}>Restore service</Button>
          <Button size="sm" variant="outline" disabled={busy || entry.identity !== "restorable"}
            onClick={() => void retireWorker(entry)}>Retire definition</Button>
        </div>
      </div>)}
    </section>}
    {mode === "lifecycle" && nodeSourceReview &&
      services?.some(service => service.name === nodeSourceReview.name &&
        service.registered && service.control === "standalone" &&
        service.template === "node-source-v1") &&
      <section className="space-y-1 rounded-md border p-3" aria-label="Node.js source identity review">
        <p className="text-sm font-medium">Node.js source review: {nodeSourceReview.name}</p>
        <p className="break-all font-mono text-xs">SHA-256: {nodeSourceReview.sourceSha256}</p>
        <p className="text-xs">Size: {nodeSourceReview.sourceBytes} bytes · runit: {nodeSourceReview.observed} · autostart: {
          nodeSourceReview.autostart === null ? "unknown" :
            nodeSourceReview.autostart ? "enabled" : "disabled"
        }</p>
        <p className="text-xs text-muted-foreground">
          Inspected: {nodeSourceReview.checkedAt}. Source text and credentials are not returned.
          This proves file identity only, not safety or readiness. Starting Node.js code
          is blocked from LAN; device-owner authorization is not configured.
        </p>
        <Button size="sm" variant="outline" disabled={busy}
          onClick={() => void loadNodeSourceHistory(nodeSourceReview.name)}>
          Read saved revisions
        </Button>
        {nodeSourceHistory?.name === nodeSourceReview.name &&
          nodeSourceHistory.currentSha256 === nodeSourceReview.sourceSha256 &&
          <div className="space-y-1 rounded-md border p-2">
            <p className="text-xs font-medium">Saved Node.js revisions ({nodeSourceHistory.revisions.length})</p>
            {nodeSourceHistory.revisions.length === 0 &&
              <p className="text-xs text-muted-foreground">No older revisions retained.</p>}
            {nodeSourceHistory.revisions.map(item =>
              <div key={item.id} className="flex flex-wrap items-center gap-2 border-b py-2">
                <div className="min-w-0 flex-1 text-xs">
                  <p>{item.savedAt} · {item.bytes} bytes</p>
                  <p className="break-all font-mono">SHA-256: {item.sourceSha256}</p>
                </div>
                <Button size="sm" variant="outline"
                  disabled={busy || nodeSourceReview.observed !== "stopped" ||
                    nodeSourceReview.autostart !== false ||
                    nodeSourceHistory.revisions.length >= 8}
                  onClick={() => void restoreNodeRevision(item)}>Restore this source</Button>
              </div>)}
            {nodeSourceHistory.revisions.length >= 8 &&
              <p className="text-xs text-muted-foreground">
                Revision history full. Restore is blocked to preserve existing files.
              </p>}
          </div>}
        {nodeSourceReview.observed === "stopped" && nodeSourceReview.autostart === false ? <>
          <label htmlFor="node-replacement-source" className="text-sm font-medium">
            Replace staged worker.mjs (full source)
          </label>
          <Textarea id="node-replacement-source" rows={7}
            value={nodeReplacement} onChange={event => setNodeReplacement(event.target.value)}
            maxLength={32 * 1024} disabled={busy}
            placeholder="Paste the complete revised Node.js source" />
          <p className="text-xs text-muted-foreground">
            Exact-SHA update only. Old code retained in private history (maximum eight revisions).
            Failed partial writes require manual reconciliation. This does not run Node.js.
          </p>
          <Button size="sm" variant="outline" disabled={busy ||
              !nodeReplacement.trim() || new Blob([nodeReplacement]).size > 32 * 1024}
            onClick={() => void replaceNodeSource()}>Replace staged Node.js source</Button>
        </> : <p className="text-xs text-muted-foreground">
          Revision requires a confirmed stopped worker with autostart disabled.
        </p>}
      </section>}
    {mode === "lifecycle" && sourceReview &&
      services?.some(service => service.name === sourceReview.name &&
        service.registered && service.control === "standalone" &&
        service.template === "python-source-v1") &&
      <section className="space-y-1 rounded-md border p-3" aria-label="Python source identity review">
        <p className="text-sm font-medium">Python source review: {sourceReview.name}</p>
        <p className="break-all font-mono text-xs">SHA-256: {sourceReview.sourceSha256}</p>
        <p className="text-xs">Size: {sourceReview.sourceBytes} bytes · runit: {sourceReview.observed} · autostart: {
          sourceReview.autostart === null ? "unknown" :
            sourceReview.autostart ? "enabled" : "disabled"
        }</p>
        <p className="text-xs text-muted-foreground">
          Inspected: {sourceReview.checkedAt}. Source text and credentials are not returned.
          This proves file identity only, not safety or readiness. Starting Python code
          is blocked from LAN; device-owner authorization is not configured.
        </p>
        <Button size="sm" variant="outline" disabled={busy}
          onClick={() => void loadPythonSourceHistory(sourceReview.name)}>
          Read saved revisions
        </Button>
        {sourceHistory?.name === sourceReview.name &&
          sourceHistory.currentSha256 === sourceReview.sourceSha256 &&
          <div className="space-y-1 rounded-md border p-2">
            <p className="text-xs font-medium">Saved Python revisions ({sourceHistory.revisions.length})</p>
            {sourceHistory.revisions.length === 0 &&
              <p className="text-xs text-muted-foreground">No older revisions retained.</p>}
            {sourceHistory.revisions.map(item =>
              <div key={item.id} className="flex flex-wrap items-center gap-2 border-b py-2">
                <div className="min-w-0 flex-1 text-xs">
                  <p>{item.savedAt} · {item.bytes} bytes</p>
                  <p className="break-all font-mono">SHA-256: {item.sourceSha256}</p>
                </div>
                <Button size="sm" variant="outline"
                  disabled={busy || sourceReview.observed !== "stopped" ||
                    sourceReview.autostart !== false ||
                    sourceHistory.revisions.length >= 8}
                  onClick={() => void restorePythonRevision(item)}>Restore this source</Button>
              </div>)}
            {sourceHistory.revisions.length >= 8 &&
              <p className="text-xs text-muted-foreground">
                Revision history full. Restore is blocked to preserve existing files.
              </p>}
          </div>}
        {sourceReview.observed === "stopped" && sourceReview.autostart === false ? <>
          <label htmlFor="python-replacement-source" className="text-sm font-medium">
            Replace staged worker.py (full source)
          </label>
          <Textarea id="python-replacement-source" rows={7}
            value={pythonReplacement} onChange={event => setPythonReplacement(event.target.value)}
            maxLength={32 * 1024} disabled={busy}
            placeholder="Paste the complete revised Python source" />
          <p className="text-xs text-muted-foreground">
            Exact-SHA update only. Old code retained in private history (maximum eight revisions).
            Failed partial writes require manual reconciliation. This does not run Python.
          </p>
          <Button size="sm" variant="outline" disabled={busy ||
              !pythonReplacement.trim() || new Blob([pythonReplacement]).size > 32 * 1024}
            onClick={() => void replacePythonSource()}>Replace staged Python source</Button>
        </> : <p className="text-xs text-muted-foreground">
          Revision requires a confirmed stopped worker with autostart disabled.
        </p>}
      </section>}
    {mode === "lifecycle" && serviceLogs && <div className="rounded-md border p-2">
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
