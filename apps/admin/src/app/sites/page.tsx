import * as React from "react"
import { Activity, FolderOpen, History, Play, RefreshCw, RotateCcw, Square, Upload, FileArchive } from "lucide-react"

import { BaseLayout } from "@/components/layouts/base-layout"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { parseFleetHealth, parseFleetLogs, parseFleetReleases, parseFleetSite, parseFleetSites, type FleetRelease, type FleetSite } from "@/lib/site-fleet-schema"
import { parseH3Files, type H3Files } from "@/lib/termux-center-schema"

const endpoint = "/api/v1/sites"
const intent = "owned-sites"
const maxZip = 6 * 1024 * 1024
const maxFolder = 8 * 1024 * 1024

async function readSites(signal?: AbortSignal): Promise<FleetSite[]> {
  const response = await fetch(endpoint, { credentials: "same-origin", cache: "no-store", signal })
  if (!response.ok) throw new Error("Site management is not available in this PocketHost session.")
  return parseFleetSites(await response.json())
}
async function mutate(url: string, method: "POST" | "PUT" | "DELETE", body?: BodyInit, type?: string): Promise<FleetSite> {
  const response = await fetch(url, {
    method, credentials: "same-origin",
    headers: { "X-PocketHost-Intent": intent, ...(type ? { "Content-Type": type } : {}) },
    body,
  })
  if (!response.ok) throw new Error(response.status === 400
    ? "Unsupported files, unsafe path or upload budget exceeded."
    : "Operation was safely refused. Check the process identity, site port and release.")
  return parseFleetSite(await response.json())
}
function siteAddress(site: FleetSite): string {
  if (typeof window !== "undefined" && window.location.port === "18878") {
    return window.location.protocol + "//" + window.location.hostname + ":18879/h2/" + site.id + "/"
  }
  return "http://127.0.0.1:" + site.port + "/"
}
function encodeBase64(bytes: Uint8Array): string {
  let text = ""
  for (let offset = 0; offset < bytes.length; offset += 32768) {
    text += String.fromCharCode(...bytes.subarray(offset, offset + 32768))
  }
  return btoa(text)
}
function formatSize(bytes: number | null): string {
  return bytes === null ? "unavailable" : (bytes / 1024).toFixed(1) + " KiB"
}

function SiteCard({ site, onChange }: { site: FleetSite; onChange: () => Promise<void> }) {
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [message, setMessage] = React.useState<string | null>(null)
  const [health, setHealth] = React.useState<boolean | null>(null)
  const [logs, setLogs] = React.useState<string[] | null>(null)
  const [versions, setVersions] = React.useState<FleetRelease[] | null>(null)
  const [versionsLoading, setVersionsLoading] = React.useState(false)
  const [assets, setAssets] = React.useState<H3Files | null>(null)
  const [assetsLoading, setAssetsLoading] = React.useState(false)
  const folderInput = React.useRef<HTMLInputElement>(null)
  React.useEffect(() => {
    folderInput.current?.setAttribute("webkitdirectory", "")
    folderInput.current?.setAttribute("directory", "")
  }, [])

  const readVersions = async () => {
    const response = await fetch(endpoint + "/" + site.id + "/releases", {
      credentials: "same-origin", cache: "no-store",
    })
    if (!response.ok) throw new Error("Version history is unavailable.")
    setVersions(parseFleetReleases(await response.json()))
  }
  const toggleVersions = () => {
    if (versions !== null) { setVersions(null); return }
    if (versionsLoading || busy) return
    setVersionsLoading(true)
    setError(null)
    void readVersions()
      .catch(cause => setError(cause instanceof Error ? cause.message : "Version inventory unavailable."))
      .finally(() => setVersionsLoading(false))
  }
  const toggleAssets = () => {
    if (assets !== null) { setAssets(null); return }
    if (busy || assetsLoading || site.state === "unknown" || !site.activeRelease) return
    setAssetsLoading(true)
    setError(null)
    void fetch(endpoint + "/" + site.id + "/files", {
      method: "GET", credentials: "same-origin", cache: "no-store",
    }).then(async response => {
      if (!response.ok) throw new Error("Active site files are unavailable.")
      setAssets(parseH3Files(await response.json()))
    }).catch(cause => {
      setAssets(null)
      setError(cause instanceof Error ? cause.message : "Asset inventory unavailable.")
    }).finally(() => setAssetsLoading(false))
  }
  const versionAction = (release: FleetRelease, action: "restore" | "prune") => {
    if (site.state === "unknown" || busy) return
    const verb = action === "restore" ? "Restore this archived version" : "Permanently delete this archived version"
    if (!window.confirm(verb + " (" + release.id + ") of " + site.name + "?")) return
    void execute(
      () => mutate(endpoint + "/" + site.id + "/releases/" + release.id + "/" + action,
        action === "restore" ? "POST" : "DELETE"),
      action === "restore" ? "Selected release restored. You can still use one-step Rollback." : "Archived release permanently removed.", true,
    )
  }
  const execute = async (job: () => Promise<unknown>, success: string, mutation = false) => {
    if (busy) return
    setBusy(true)
    setError(null)
    setMessage(null)
    setHealth(null)
    try {
      try {
        await job()
      } catch (cause) {
        setError(mutation
          ? "Result unconfirmed. Refresh the site state before retrying; no automatic retry."
          : cause instanceof Error ? cause.message : "Read failed.")
        return
      }
      try {
        await onChange()
        setAssets(null)
        if (versions !== null) await readVersions()
        setMessage(success)
      } catch {
        setMessage("Operation acknowledged, but inventory refresh failed. Verify the site state.")
      }
    } finally {
      setBusy(false)
    }
  }
  const action = (name: "start" | "stop" | "restart" | "rollback") => {
    if (site.state === "unknown") return
    if ((name === "stop" || name === "restart" || name === "rollback") &&
        !window.confirm("Apply " + name + " only to " + site.name + "?")) return
    void execute(() => mutate(endpoint + "/" + site.id + "/" + name, "POST"),
      name[0].toUpperCase() + name.slice(1) + " completed.", true)
  }
  const zip = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ""
    if (!file) return
    if (site.activeRelease && !window.confirm("Publish a new release of " + site.name + "?")) return
    void execute(async () => {
      if (file.size > maxZip) throw new RangeError("ZIP is larger than 6 MiB.")
      await mutate(endpoint + "/" + site.id + "/deploy", "PUT", file, "application/zip")
    }, "ZIP was published as a new immutable release.", true)
  }
  const folder = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.currentTarget.files ?? [])
    event.currentTarget.value = ""
    if (!files.length) return
    if (site.activeRelease && !window.confirm("Publish a new release of " + site.name + "?")) return
    void execute(async () => {
      if (files.length > 100 || files.some(file => file.size > 2 * 1024 * 1024) ||
          files.reduce((sum, file) => sum + file.size, 0) > maxFolder)
        throw new RangeError("Folder exceeds the safe limit of 100 files, 2 MiB per file, 8 MiB total.")
      const entries = await Promise.all(files.map(async file => ({
        name: file.webkitRelativePath || file.name,
        base64: encodeBase64(new Uint8Array(await file.arrayBuffer())),
      })))
      await mutate(endpoint + "/" + site.id + "/deploy", "PUT",
        JSON.stringify({ files: entries }), "application/json")
    }, "Folder was published as a new immutable release.", true)
  }
  const verify = () => {
    void execute(async () => {
      const response = await fetch(endpoint + "/" + site.id + "/health", {
        credentials: "same-origin", cache: "no-store",
      })
      if (!response.ok) throw new Error("HTTP verification is unavailable.")
      const ready = parseFleetHealth(await response.json())
      setHealth(ready)
    }, "HTTP check completed.")
  }
  const loadLogs = () => {
    void execute(async () => {
      const response = await fetch(endpoint + "/" + site.id + "/logs", {
        credentials: "same-origin", cache: "no-store",
      })
      if (!response.ok) throw new Error("Owned logs are not available.")
      setLogs(parseFleetLogs(await response.json()))
    }, "Owned logs refreshed.")
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          <FolderOpen className="size-5" /> {site.name}
          <Badge variant="outline">Owned static site</Badge>
        </CardTitle>
        <CardDescription className="break-all font-mono text-xs">{site.id}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex flex-wrap gap-2">
          <Badge variant={site.state === "running" ? "secondary" : "outline"}>{site.state}</Badge>
          <Badge variant="outline">127.0.0.1:{site.port}</Badge>
          <Badge variant="outline">{site.fileCount} files · {formatSize(site.bytes)}</Badge>
          <Badge variant="outline">{site.releases} releases</Badge>
          {health !== null && <Badge variant="outline">HTTP: {health ? "healthy" : "unavailable"}</Badge>}
        </div>
        <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div><dt className="text-muted-foreground">Active release</dt>
            <dd className="break-all font-mono text-xs">{site.activeRelease ?? "not published"}</dd></div>
          <div><dt className="text-muted-foreground">Verified PID / ticks</dt>
            <dd className="font-mono text-xs">{site.pid === null ? "none" : site.pid + " / " + site.startTicks}</dd></div>
          <div><dt className="text-muted-foreground">Memory (verified child)</dt>
            <dd>{formatSize(site.memoryBytes)}</dd></div>
          <div><dt className="text-muted-foreground">Uptime</dt>
            <dd>{site.uptimeSeconds === null ? "not running" : site.uptimeSeconds + " seconds"}</dd></div>
        </dl>
        {site.state === "unknown" && <p role="alert" className="text-destructive text-sm">
          Process identity is uncertain. All mutations are blocked; no unverified process is signalled.
        </p>}
        {site.state === "running" && <div className="pb-2 pt-1">
          <a className="inline-flex py-1 text-sm underline underline-offset-4"
            target="_blank" rel="noopener noreferrer" href={siteAddress(site)}>Open hosted site</a>
        </div>}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium" htmlFor={site.id + "-zip"}>
              <FileArchive className="size-4" /> Upload static ZIP
            </label>
            <Input id={site.id + "-zip"} type="file" accept=".zip,application/zip"
              disabled={busy || site.state === "unknown"} onChange={zip} />
          </div>
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium" htmlFor={site.id + "-folder"}>
              <Upload className="size-4" /> Upload folder
            </label>
            <Input ref={folderInput} id={site.id + "-folder"} type="file" multiple
              disabled={busy || site.state === "unknown"} onChange={folder} />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {site.state === "running" ? <>
            <Button variant="outline" disabled={busy} onClick={() => action("restart")}><RotateCcw /> Restart</Button>
            <Button variant="outline" disabled={busy} onClick={() => action("stop")}><Square /> Stop</Button>
          </> : <Button disabled={busy || site.state === "unknown" || !site.activeRelease}
            onClick={() => action("start")}><Play /> Start</Button>}
          <Button variant="outline" disabled={busy || site.state === "unknown" || !site.canRollback}
            onClick={() => action("rollback")}><History /> Rollback</Button>
          <Button variant="outline" disabled={busy} onClick={verify}><Activity /> Verify HTTP</Button>
          <Button variant="outline" disabled={busy} onClick={loadLogs}><RefreshCw /> Read logs</Button>
          <Button variant="outline" disabled={busy || assetsLoading || site.state === "unknown" || !site.activeRelease}
            onClick={toggleAssets}>
            <FolderOpen /> {assets !== null ? "Hide assets" : assetsLoading ? "Reading assets…" : "Inspect assets"}
          </Button>
          <Button variant="outline" disabled={busy || versionsLoading} onClick={toggleVersions}>
            <History /> {versions !== null ? "Hide versions" : versionsLoading ? "Reading versions…" : "Manage versions"}
          </Button>
        </div>
        {assets !== null && <section className="space-y-2 rounded-lg border p-4" aria-label={"Active assets of " + site.name}>
          <h3 className="text-sm font-semibold">Active release assets ({assets.length})</h3>
          <div className="max-h-72 overflow-auto">
            {assets.map(item => <div key={item.name} className="flex justify-between gap-3 border-b py-2 text-xs">
              <span className="break-all font-mono">{item.name}</span>
              <span className="shrink-0">{item.bytes} B</span>
            </div>)}
            {assets.length === 0 && <p className="text-muted-foreground text-xs">No active files.</p>}
          </div>
        </section>}
        {versions !== null && <section className="space-y-3 rounded-lg border p-4" aria-label={"Saved versions of " + site.name}>
          <div>
            <h3 className="text-sm font-semibold">Saved releases</h3>
            <p className="text-muted-foreground text-xs">Preview older snapshots, restore any saved release or remove unused archives. Active and quick-rollback versions are protected.</p>
          </div>
          {versions.length === 0 && <p className="text-muted-foreground text-xs">No versions published yet.</p>}
          <ol className="space-y-2">
            {versions.map(release => <li key={release.id}
              className="flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 space-y-1 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="break-all font-mono">{release.id}</span>
                  {release.active && <Badge variant="secondary">Active</Badge>}
                  {release.rollbackTarget && <Badge variant="outline">Quick rollback</Badge>}
                </div>
                <p className="text-muted-foreground">
                  <time dateTime={release.createdAt}>{new Date(release.createdAt).toLocaleString()}</time>
                  {" · "}{release.fileCount} files{" · "}{formatSize(release.bytes)}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {site.state === "running" && <a
                  href={siteAddress(site) + "__versions/" + release.id + "/"}
                  target="_blank" rel="noopener noreferrer"
                  className="inline-flex rounded-md border px-3 py-2 text-xs font-medium hover:bg-muted"
                >Preview</a>}
                <Button size="sm" variant="outline"
                  disabled={busy || site.state === "unknown" || release.active}
                  onClick={() => versionAction(release, "restore")}>Restore</Button>
                <Button size="sm" variant="outline"
                  disabled={busy || site.state === "unknown" || release.active || release.rollbackTarget}
                  onClick={() => versionAction(release, "prune")}>Delete archive</Button>
              </div>
            </li>)}
          </ol>
          <p className="text-muted-foreground text-xs">Pre-existing running sites may need a manual Restart once to enable archived preview links. Restore works without a restart.</p>
        </section>}
        {busy && <p role="status" className="text-sm">Working with this owned site…</p>}
        {error && <p role="alert" className="text-destructive text-sm">{error}</p>}
        {message && <p role="status" className="text-sm">{message}</p>}
        {site.history.length > 0 && <section className="space-y-2">
          <h3 className="text-sm font-semibold">Deployment history</h3>
          <ol className="max-h-48 space-y-1 overflow-auto text-xs">
            {site.history.map((event, i) => <li key={event.at + i} className="flex flex-wrap justify-between gap-2 border-b py-1">
              <span>{event.action} · {event.from?.slice(0, 11) ?? "new"} → {event.to.slice(0, 11)}</span>
              <time className="text-muted-foreground">{event.at}</time>
            </li>)}
          </ol>
        </section>}
        {logs && <section className="space-y-2">
          <h3 className="text-sm font-semibold">Owned runtime logs</h3>
          <pre className="max-h-48 overflow-auto rounded-md bg-muted p-3 text-xs">
            {logs.length ? logs.join("\n") : "No owned logs"}
          </pre>
        </section>}
      </CardContent>
    </Card>
  )
}

export default function SitesPage() {
  const [sites, setSites] = React.useState<FleetSite[]>([])
  const [name, setName] = React.useState("")
  const [loading, setLoading] = React.useState(true)
  const [creating, setCreating] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const reload = React.useCallback(async (signal?: AbortSignal) => {
    const entries = await readSites(signal)
    if (!signal?.aborted) { setSites(entries); setError(null) }
  }, [])
  React.useEffect(() => {
    const controller = new AbortController()
    void Promise.resolve().then(() => reload(controller.signal))
      .catch(() => { if (!controller.signal.aborted) setError("Owned site management unavailable; existing services unchanged.") })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [reload])
  const refresh = async () => {
    setLoading(true)
    try { await reload() } catch { setError("Could not read owned sites.") }
    finally { setLoading(false) }
  }
  const createSite = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (creating || sites.length >= 8) return
    setCreating(true)
    setError(null)
    try {
      try {
        await mutate(endpoint + "/", "POST", JSON.stringify({ name }), "application/json")
      } catch {
        setError("Create result unconfirmed. Refresh the site list before retrying.")
        return
      }
      setName("")
      try { await reload() } catch {
        setError("Creation acknowledged; site list refresh failed. Refresh before retrying.")
      }
    } finally { setCreating(false) }
  }

  return (
    <BaseLayout title="Hosted sites" description="Create and operate your own static sites on Samsung Termux, without a shell.">
      <div className="space-y-5 px-4 pb-8 lg:px-6">
        <Card>
          <CardHeader>
            <CardTitle>New hosted site</CardTitle>
            <CardDescription>Up to eight explicitly owned static sites. ZIP or folder, then Start.
              Only HTML, CSS, JS, images, fonts and other allowlisted static assets.
              Use relative asset paths. No server-side code or package installation.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={createSite} className="flex flex-col gap-3 sm:flex-row">
              <label htmlFor="new-owned-site" className="sr-only">Site name</label>
              <Input id="new-owned-site" value={name} onChange={event => setName(event.target.value)}
                placeholder="My first site" minLength={2} maxLength={60} required />
              <Button type="submit" disabled={creating || sites.length >= 8 || name.trim().length < 2}>
                <FolderOpen /> Create site
              </Button>
              <Button type="button" variant="outline" disabled={loading} onClick={() => void refresh()}>
                <RefreshCw /> Refresh
              </Button>
            </form>
          </CardContent>
        </Card>
        {loading && <p role="status" className="text-sm">Reading owned site inventory…</p>}
        {error && <p role="alert" className="text-destructive text-sm">{error}</p>}
        {!loading && sites.length === 0 && !error && <p className="text-muted-foreground text-sm">
          No user sites created yet. Your existing PocketHost demo and imported services are untouched.
        </p>}
        <div className="grid gap-5">
          {sites.map(site => <SiteCard key={site.id} site={site} onChange={refresh} />)}
        </div>
        <p className="text-muted-foreground text-xs">
          Each site is bound to its own local-only port; the manually enabled trusted-LAN gateway
          publishes GET/HEAD-only previews on its separate site origin. No authentication is provided
          on this development LAN; never expose it on untrusted networks.
        </p>
      </div>
    </BaseLayout>
  )
}
