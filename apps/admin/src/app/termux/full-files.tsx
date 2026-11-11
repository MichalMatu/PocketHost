import * as React from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"

type Root = "home" | "prefix" | "shared"
type Entry = { name: string; kind: "file" | "directory" | "link" | "other"; bytes: number }
type Listing = { path: string; entries: Entry[]; truncated: boolean }
const api = "/api/v1/termux-admin"
const headers = { "Content-Type": "application/json", "X-PocketHost-Intent": "termux-admin" }

async function browse(root: Root, folder: string): Promise<Listing> {
  const response = await fetch(api + "?mode=browse-root&root=" + root + "&path=" + encodeURIComponent(folder),
    { cache: "no-store", credentials: "same-origin" })
  if (!response.ok) throw new Error("Directory cannot be inspected")
  const data = await response.json() as Listing
  if (!Array.isArray(data.entries) || data.entries.length > 300 ||
    !data.entries.every(item => typeof item.name === "string" && typeof item.bytes === "number" &&
      ["file", "directory", "link", "other"].includes(item.kind)))
    throw new Error("Invalid file listing")
  return data
}
async function operate<T>(payload: Record<string, unknown>): Promise<T> {
  const response = await fetch(api, {
    method: "POST", headers, credentials: "same-origin", body: JSON.stringify({ action: "full-file", ...payload }),
  })
  if (!response.ok) throw new Error("Filesystem operation refused")
  return response.json() as Promise<T>
}
export function TermuxFileExplorer({ refreshToken = 0 }: { refreshToken?: number }) {
  const [root, setRoot] = React.useState<Root>("home")
  const [folder, setFolder] = React.useState("")
  const currentLocation = React.useRef<{ root: Root; folder: string }>({ root: "home", folder: "" })
  const [available, setAvailable] = React.useState<{ id: Root; available: boolean }[] | null>(null)
  const [listing, setListing] = React.useState<Listing | null>(null)
  const [target, setTarget] = React.useState("")
  const [destination, setDestination] = React.useState("")
  const [content, setContent] = React.useState("")
  const [editing, setEditing] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const [notice, setNotice] = React.useState("")
  const [error, setError] = React.useState("")
  const combine = (name: string) => [folder, name].filter(Boolean).join("/")
  // Never carry the previous file's text into another path.
  const chooseTarget = (path: string) => {
    setTarget(path)
    setContent("")
    setEditing(false)
  }
  const load = React.useCallback(async (selected: Root, relative: string) => {
    setBusy(true); setError("")
    try {
      const data = await browse(selected, relative)
      currentLocation.current = { root: selected, folder: relative }
      setRoot(selected); setFolder(relative); setListing(data)
      setEditing(false); setTarget(""); setContent(""); setDestination(""); setNotice("")
    } catch (e) { setError(e instanceof Error ? e.message : "Browsing failed") }
    finally { setBusy(false) }
  }, [])
  React.useEffect(() => {
    let active = true
    const location = currentLocation.current
    void Promise.all([
      fetch(api + "?mode=file-roots", { credentials: "same-origin" }).then(res => {
        if (!res.ok) throw new Error("Filesystem roots unavailable")
        return res.json() as Promise<{ roots: { id: Root; available: boolean }[] }>
      }),
      browse(location.root, location.folder),
    ]).then(([roots, data]) => {
      if (!active || currentLocation.current.root !== location.root ||
        currentLocation.current.folder !== location.folder) return
      setAvailable(roots.roots); setListing(data); setError("")
    }).catch(() => { if (active) setError("File inventory unavailable. Last listing retained.") })
    return () => { active = false }
  }, [refreshToken])
  const read = async (name: string) => {
    setBusy(true); setError("")
    try {
      const current = combine(name)
      const result = await operate<{ content: string }>({ name: "read", root, path: current })
      setTarget(current); setContent(result.content); setEditing(true)
    } catch { setError("Only bounded UTF-8 text files are editable.") }
    finally { setBusy(false) }
  }
  const perform = async (operation: "mkdir"|"save"|"copy"|"copy-tree"|"move"|"delete"|"delete-tree", relative: string) => {
    if (busy || !relative) return
    if (!window.confirm("Apply " + operation + " in " + root + ": " + relative + "?")) return
    if (operation === "delete-tree" &&
        !window.confirm("PERMANENTLY DELETE this entire directory tree? " + root + "/" + relative))
      return
    setBusy(true); setNotice(""); setError("")
    try {
      await operate({ name: operation, root, path: relative,
        destination: operation === "move" || operation === "copy" || operation === "copy-tree" ? destination : undefined,
        content: operation === "save" ? content : undefined })
      setNotice(operation + " completed")
      setListing(await browse(root, folder))
    } catch {
      setError(operation + " result unconfirmed. Refresh the directory before retrying.")
      void browse(root, folder).then(setListing).catch(() => undefined)
    }
    finally { setBusy(false) }
  }
  const upload = async (file: File | undefined) => {
    if (!file || busy) return
    if (file.size > 2 * 1024 * 1024) { setError("Maximum file upload is 2 MiB."); return }
    setBusy(true); setNotice(""); setError("")
    try {
      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onerror = () => reject(new Error("File read failed"))
        reader.onload = () => typeof reader.result === "string"
          ? resolve(reader.result.slice(reader.result.indexOf(",") + 1))
          : reject(new Error("File data missing"))
        reader.readAsDataURL(file)
      })
      await operate({ name: "upload", root, path: combine(file.name), base64: data })
      setListing(await browse(root, folder)); setNotice("Imported " + file.name)
    } catch { setError("Upload failed or destination exists.") }
    finally { setBusy(false) }
  }
  const exportFile = async (name: string) => {
    setBusy(true); setError("")
    try {
      const result = await operate<{ name: string; base64: string }>({ name: "export", root, path: combine(name) })
      const binary = atob(result.base64)
      const bytes = Uint8Array.from(binary, char => char.charCodeAt(0))
      const link = document.createElement("a")
      const url = URL.createObjectURL(new Blob([bytes], { type: "application/octet-stream" }))
      try { link.href = url; link.download = result.name; link.click() }
      finally { URL.revokeObjectURL(url) }
      setNotice("Exported " + result.name)
    } catch { setError("Cannot export this file.") }
    finally { setBusy(false) }
  }
  return <section className="space-y-3 rounded-md border p-3">
    <h3 className="font-medium">Files</h3>
    <p className="text-xs text-muted-foreground">Symlinks are never followed. Deletion is permanent.</p>
    <div className="flex flex-wrap items-center gap-2">
      <label htmlFor="h34-root" className="text-sm">Filesystem</label>
      <select id="h34-root" aria-label="Filesystem root" className="rounded border bg-background p-2"
        value={root} disabled={busy} onChange={event => void load(event.target.value as Root, "")}>
        {(["home", "prefix", "shared"] as const).map(value => <option key={value} value={value}
          disabled={available?.find(item => item.id === value)?.available === false}>{value}</option>)}
      </select>
      <Badge variant="outline">{root}/{folder}</Badge>
      <Button size="sm" variant="outline" disabled={busy || available?.find(item => item.id === "home")?.available === false}
        onClick={() => void load("home", "Projects/PocketHost-H3-Workspace")}>Workspace</Button>
      <Button size="sm" variant="outline" disabled={busy || !folder} onClick={() =>
        void load(root, folder.split("/").slice(0, -1).join("/"))}>Up</Button>

    </div>
    <div className="max-h-72 overflow-auto rounded border">
      {listing?.entries.map(item => <div className="flex items-center justify-between gap-2 border-b p-2 text-xs"
        key={item.name}>
        <span className="break-all">{item.kind === "directory" ? "📁" : item.kind === "file" ? "📄" : "🔗"} {item.name}
          {item.kind === "file" ? " (" + item.bytes + " B)" : ""}</span>
        <div className="flex flex-wrap gap-1">
          {item.kind === "directory" && <>
            <Button size="sm" variant="outline" disabled={busy}
              onClick={() => void load(root, combine(item.name))}>Open</Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => chooseTarget(combine(item.name))}>
              Select folder
            </Button>
            <Button size="sm" variant="outline" disabled={busy}
              onClick={() => void perform("delete-tree", combine(item.name))}>Delete tree</Button>
          </>}
          {item.kind === "file" && <>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => void read(item.name)}>Edit</Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => void exportFile(item.name)}>Export</Button>
          </>}
          {item.kind !== "link" && item.kind !== "other" && <Button size="sm" variant="outline" disabled={busy}
            onClick={() => void perform("delete", combine(item.name))}>Delete</Button>}
        </div>
      </div>)}
      {listing?.truncated && <p className="p-2 text-xs">Directory listing limited to 300 entries.</p>}
    </div>
    <Input placeholder="New folder, file, or source path" aria-label="Termux file source"
      value={target} onChange={event => chooseTarget(event.target.value)} />
    <Input placeholder="Destination path for copy/move" aria-label="Termux destination"
      value={destination} onChange={event => setDestination(event.target.value)} />
    <div className="flex flex-wrap gap-2">
      <Button size="sm" disabled={busy || !target} onClick={() => void perform("mkdir", target)}>New directory</Button>
      <Button size="sm" variant="outline" disabled={busy || !target || !destination}
        onClick={() => void perform("copy", target)}>Copy file</Button>
      <Button size="sm" variant="outline" disabled={busy || !target || !destination}
        onClick={() => void perform("copy-tree", target)}>Copy folder</Button>
      <Button size="sm" variant="outline" disabled={busy || !target || !destination}
        onClick={() => void perform("move", target)}>Move</Button>
      <label className="flex items-center gap-2 text-sm">Import (2 MiB)
        <input type="file" aria-label="Import Termux file" disabled={busy}
          onChange={event => { void upload(event.target.files?.[0]); event.target.value = "" }} />
      </label>
    </div>
    <Button size="sm" variant="outline" disabled={!target || busy} onClick={() => setEditing(true)}>
      New / Edit text file
    </Button>
    {editing && <div className="space-y-2">
      <p className="text-sm">Text editor: {target || "(choose file)"}</p>
      <Textarea aria-label="Termux text editor" rows={9} value={content}
        onChange={event => setContent(event.target.value)} />
      <Button size="sm" disabled={!target || busy} onClick={() => void perform("save", target)}>Save text</Button>
    </div>}
    {notice && <p role="status" className="text-sm">{notice}</p>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </section>
}
