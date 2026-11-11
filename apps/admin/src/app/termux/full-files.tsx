import * as React from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { FileIcon, FileTextIcon, FolderIcon, LinkIcon, MoreHorizontalIcon } from "lucide-react"

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
  const [pendingTransfer, setPendingTransfer] = React.useState<"copy" | "copy-tree" | "move" | null>(null)
  const [activeMenu, setActiveMenu] = React.useState<string | null>(null)
  const [notice, setNotice] = React.useState("")
  const [error, setError] = React.useState("")
  const combine = (name: string) => [folder, name].filter(Boolean).join("/")
  // Never carry the previous file's text into another path.
  const chooseTarget = (path: string) => {
    setTarget(path)
    setContent("")
    setEditing(false)
    setPendingTransfer(null)
  }
  const stageTransfer = (operation: "copy" | "copy-tree" | "move", path: string) => {
    chooseTarget(path)
    setPendingTransfer(operation)
    setNotice("")
  }
  const load = React.useCallback(async (selected: Root, relative: string) => {
    setBusy(true); setError("")
    try {
      const data = await browse(selected, relative)
      currentLocation.current = { root: selected, folder: relative }
      setRoot(selected); setFolder(relative); setListing(data)
      setEditing(false); setTarget(""); setContent(""); setDestination(""); setNotice("")
      setPendingTransfer(null); setActiveMenu(null)
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
    const current = combine(name)
    chooseTarget(current)
    try {
      const result = await operate<{ content: string }>({ name: "read", root, path: current })
      setContent(result.content); setEditing(true)
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
      try {
        await operate({ name: operation, root, path: relative,
          destination: operation === "move" || operation === "copy" || operation === "copy-tree" ? destination : undefined,
          content: operation === "save" ? content : undefined })
      } catch {
        setError(operation + " result unconfirmed. Inspect the directory before retrying.")
        return
      }
      setNotice(operation + " completed")
      setPendingTransfer(null)
      try { setListing(await browse(root, folder)) }
      catch { setError("Change acknowledged; directory refresh failed.") }
    } finally { setBusy(false) }
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
  const crumbs = folder.split("/").filter(Boolean)
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
      <Button size="sm" variant="outline" disabled={busy || available?.find(item => item.id === "home")?.available === false}
        onClick={() => void load("home", "Projects/PocketHost-H3-Workspace")}>Workspace</Button>
      <Button size="sm" variant="outline" disabled={busy || !folder} onClick={() =>
        void load(root, crumbs.slice(0, -1).join("/"))}>Up</Button>
    </div>
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          {crumbs.length ? <button type="button" disabled={busy}
            className="hover:text-foreground underline-offset-4 hover:underline disabled:opacity-50"
            onClick={() => void load(root, "")}>{root}</button> : <BreadcrumbPage>{root}</BreadcrumbPage>}
        </BreadcrumbItem>
        {crumbs.map((part, index) => <React.Fragment key={index}>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            {index === crumbs.length - 1 ? <BreadcrumbPage>{part}</BreadcrumbPage> :
              <button type="button" disabled={busy}
                className="hover:text-foreground underline-offset-4 hover:underline disabled:opacity-50"
                onClick={() => void load(root, crumbs.slice(0, index + 1).join("/"))}>{part}</button>}
          </BreadcrumbItem>
        </React.Fragment>)}
      </BreadcrumbList>
    </Breadcrumb>
    <div className="max-h-96 overflow-auto rounded-md border" aria-label="Files in current directory">
      {listing?.entries.map(item => {
        const relative = combine(item.name)
        const navigable = item.kind === "directory" || item.kind === "file"
        return <div key={item.name} className={"flex items-center gap-1 border-b px-1 py-0.5 last:border-b-0 " +
          (target === relative ? "bg-accent/60" : "hover:bg-accent/30")}
          onContextMenu={event => {
            if (!navigable || busy) return
            event.preventDefault()
            setActiveMenu(item.name)
          }}>
          {navigable ? <button type="button" disabled={busy}
            aria-label={item.kind === "directory" ? "Open folder " + item.name : "Open file " + item.name}
            className="flex min-w-0 flex-1 items-center gap-2 rounded px-2 py-2 text-left text-sm focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50"
            onClick={() => item.kind === "directory" ? void load(root, relative) : void read(item.name)}>
            {item.kind === "directory" ? <FolderIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" /> :
              <FileTextIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />}
            <span className="break-all">{item.name}{item.kind === "file" ? " (" + item.bytes + " B)" : ""}</span>
          </button> :
            <div className="flex min-w-0 flex-1 items-center gap-2 px-2 py-2 text-sm text-muted-foreground">
              {item.kind === "link" ? <LinkIcon className="size-4 shrink-0" aria-hidden="true" /> :
                <FileIcon className="size-4 shrink-0" aria-hidden="true" />}
              <span className="break-all">{item.name} ({item.kind})</span>
            </div>}
          {navigable && <DropdownMenu open={activeMenu === item.name}
            onOpenChange={open => setActiveMenu(open ? item.name : null)}>
            <DropdownMenuTrigger type="button" disabled={busy}
              aria-label={"Actions for " + item.name}
              className="flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50">
              <MoreHorizontalIcon className="size-4" aria-hidden="true" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {item.kind === "directory" && <DropdownMenuItem onClick={() => chooseTarget(relative)}>
                Select folder
              </DropdownMenuItem>}
              {item.kind === "file" && <DropdownMenuItem onClick={() => void exportFile(item.name)}>
                Download
              </DropdownMenuItem>}
              <DropdownMenuItem onClick={() => stageTransfer(item.kind === "directory" ? "copy-tree" : "copy", relative)}>
                Copy to…
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => stageTransfer("move", relative)}>
                Move to…
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={() =>
                void perform(item.kind === "directory" ? "delete-tree" : "delete", relative)}>
                {item.kind === "directory" ? "Delete folder tree" : "Delete file"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>}
        </div>
      })}
      {!listing?.entries.length && <p className="p-3 text-sm text-muted-foreground">No files in this directory.</p>}
      {listing?.truncated && <p className="p-2 text-xs">Directory listing limited to 300 entries.</p>}
    </div>
    <Input placeholder="New folder, file, or source path" aria-label="Termux file source"
      value={target} onChange={event => chooseTarget(event.target.value)} />
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" disabled={busy || !target} onClick={() => void perform("mkdir", target)}>New directory</Button>
      <label className="flex items-center gap-2 text-sm">Import (2 MiB)
        <input type="file" aria-label="Import Termux file" disabled={busy}
          onChange={event => { void upload(event.target.files?.[0]); event.target.value = "" }} />
      </label>
      <Button size="sm" variant="outline" disabled={!target || busy} onClick={() => {
        setPendingTransfer(null); setEditing(true)
      }}>New / Edit text file</Button>
    </div>
    {pendingTransfer && <div className="space-y-2 rounded-md border p-3">
      <p className="text-sm">{
        pendingTransfer === "move" ? "Move" : pendingTransfer === "copy-tree" ? "Copy folder" : "Copy file"
      }: {root}/{target}</p>
      <Input placeholder="Destination path" aria-label="Termux destination"
        value={destination} onChange={event => setDestination(event.target.value)} />
      <div className="flex gap-2">
        <Button size="sm" disabled={busy || !target || !destination.trim()} onClick={() =>
          pendingTransfer && void perform(pendingTransfer, target)}>
          {pendingTransfer === "move" ? "Move" : "Copy"}
        </Button>
        <Button size="sm" variant="outline" disabled={busy}
          onClick={() => setPendingTransfer(null)}>Cancel</Button>
      </div>
    </div>}
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
