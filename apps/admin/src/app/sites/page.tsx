import * as React from "react"
import { useSearchParams } from "react-router-dom"
import { Activity, FolderOpen, History, Play, RefreshCw, RotateCcw, Square, Upload, FileArchive } from "lucide-react"

import { BaseLayout } from "@/components/layouts/base-layout"
import { SiteProcessSummary, SiteVersionHistory, SiteDeploymentHistory } from "./site-card-details"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { formatBytes } from "@/lib/format-memory"
import { parseFleetHealth, parseFleetLogs, parseFleetReleases, parseFleetSite, type FleetRelease, type FleetSite } from "@/lib/site-fleet-schema"
import { parseH3Files, type H3Files } from "@/lib/termux-center-schema"
import { endpoint, maxZip, maxStarterHtml, readSignal, starterHtml, readSites, mutate, siteAddress, encodeBase64, encodeStaticFolder, StaticSiteInputRejected, validateStaticZipSelection, inspectInitialStaticZip } from "./site-client"

function SiteCard({ site, onChange }: { site: FleetSite; onChange: () => Promise<void> }) {
  const [busy, setBusy] = React.useState(false)
  const [outcomeUnknown, setOutcomeUnknown] = React.useState(false)
  // Only a fresh owned-site inventory can unlock actions after a
  // potentially committed mutation. Read-only requests cannot.
  React.useEffect(() => setOutcomeUnknown(false), [site])
  const [error, setError] = React.useState<string | null>(null)
  const [message, setMessage] = React.useState<string | null>(null)
  const [health, setHealth] = React.useState<boolean | null>(null)
  const [logs, setLogs] = React.useState<string[] | null>(null)
  const [versions, setVersions] = React.useState<FleetRelease[] | null>(null)
  const [versionsLoading, setVersionsLoading] = React.useState(false)
  const [assets, setAssets] = React.useState<H3Files | null>(null)
  const [assetsLoading, setAssetsLoading] = React.useState(false)
  const [html, setHtml] = React.useState(starterHtml)
  const [showHtmlEditor, setShowHtmlEditor] = React.useState(false)
  const [htmlLoading, setHtmlLoading] = React.useState(false)
  const [editorRelease, setEditorRelease] = React.useState<string | null | undefined>(undefined)
  const editorVisible = showHtmlEditor &&
    (editorRelease === undefined || editorRelease === site.activeRelease)
  const editorReady = editorVisible && editorRelease !== undefined
  const folderInput = React.useRef<HTMLInputElement>(null)
  React.useEffect(() => {
    folderInput.current?.setAttribute("webkitdirectory", "")
    folderInput.current?.setAttribute("directory", "")
  }, [])

  const readVersions = async () => {
    const response = await fetch(endpoint + "/" + site.id + "/releases", {
      credentials: "same-origin", cache: "no-store", signal: readSignal(),
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
      method: "GET", credentials: "same-origin", cache: "no-store", signal: readSignal(),
    }).then(async response => {
      if (!response.ok) throw new Error("Active site files are unavailable.")
      setAssets(parseH3Files(await response.json()))
    }).catch(cause => {
      setAssets(null)
      setError(cause instanceof Error ? cause.message : "Asset inventory unavailable.")
    }).finally(() => setAssetsLoading(false))
  }
  const toggleHtmlEditor = () => {
    if (editorVisible) {
      setShowHtmlEditor(false)
      setEditorRelease(undefined)
      return
    }
    if (busy || htmlLoading || site.state === "unknown" || site.fileCount > 1) return
    setShowHtmlEditor(true)
    setEditorRelease(undefined)
    setError(null)
    if (!site.activeRelease) {
      setHtml(starterHtml)
      setEditorRelease(null)
      return
    }
    setHtmlLoading(true)
    void fetch(endpoint + "/" + site.id + "/html", {
      credentials: "same-origin", cache: "no-store", signal: readSignal(),
    }).then(async response => {
      if (!response.ok) throw new Error("Could not load the published HTML for editing.")
      const result: unknown = await response.json()
      if (!result || typeof result !== "object" || Array.isArray(result))
        throw new Error("Invalid HTML source response.")
      const source = result as { release?: unknown; html?: unknown }
      if (source.release !== site.activeRelease || typeof source.html !== "string")
        throw new Error("Active release changed. Refresh before editing.")
      if (new TextEncoder().encode(source.html).length > maxStarterHtml)
        throw new Error("Current HTML is larger than the 32 KiB editor limit.")
      setHtml(source.html)
      setEditorRelease(site.activeRelease)
    }).catch(cause => {
      setError(cause instanceof Error ? cause.message : "Could not load the published HTML.")
    }).finally(() => setHtmlLoading(false))
  }

  const versionAction = (release: FleetRelease, action: "restore" | "prune") => {
    if (site.state === "unknown" || busy || outcomeUnknown) return
    const verb = action === "restore" ? "Restore this archived version" : "Permanently delete this archived version"
    if (!window.confirm(verb + " (" + release.id + ") of " + site.name + "?")) return
    void execute(
      () => mutate(endpoint + "/" + site.id + "/releases/" + release.id + "/" + action,
        action === "restore" ? "POST" : "DELETE"),
      action === "restore" ? "Selected release restored. You can still use one-step Rollback." : "Archived release permanently removed.", true,
      observed => action === "restore"
        ? observed.activeRelease === release.id
        : observed.releases === site.releases - 1 && observed.activeRelease === site.activeRelease,
    )
  }
  const execute = async (
    job: () => Promise<unknown>, success: string, mutation = false,
    expected?: (observed: FleetSite) => boolean,
  ) => {
    if (busy || (mutation && outcomeUnknown)) return
    setBusy(true)
    setError(null)
    setMessage(null)
    setHealth(null)
    try {
      let receipt: unknown
      try {
        receipt = await job()
      } catch (cause) {
        if (mutation && !(cause instanceof StaticSiteInputRejected))
          setOutcomeUnknown(true)
        setError(mutation
          ? (cause instanceof StaticSiteInputRejected
            ? cause.message
            : "Result unconfirmed. Refresh the site state before retrying; no automatic retry.")
          : cause instanceof Error ? cause.message : "Read failed.")
        return
      }
      if (mutation) {
        try {
          // The POST/PUT acknowledgement is not enough. Read back the exact
          // owned site independently, without reissuing the mutation.
          const response = await fetch(endpoint + "/" + site.id, {
            credentials: "same-origin", cache: "no-store", signal: readSignal(),
          })
          if (!response.ok) throw new Error("site-readback-unavailable")
          const observed = parseFleetSite(await response.json())
          const ack = receipt as FleetSite | null
          if (!ack || ack.id !== site.id || observed.id !== site.id ||
              ack.state !== observed.state || ack.activeRelease !== observed.activeRelease ||
              ack.previousRelease !== observed.previousRelease ||
              ack.releases !== observed.releases || ack.canRollback !== observed.canRollback ||
              ack.history.length !== observed.history.length ||
              (expected && !expected(observed)))
            throw new Error("site-state-drift")
          // A release change must invalidate the open editor. Otherwise a
          // rollback can resurrect stale HTML under an earlier release ID.
          if (observed.activeRelease !== site.activeRelease) {
            setShowHtmlEditor(false)
            setEditorRelease(undefined)
          }
        } catch {
          setOutcomeUnknown(true)
          setError("Site action result unconfirmed. Refresh the exact site state before retrying.")
          return
        }
      }
      if (mutation) {
        try {
          await onChange()
        } catch {
          // Exact site readback succeeded but the owned inventory did not:
          // never keep using an old site card for another write.
          setOutcomeUnknown(true)
          setError("Site action confirmed, but the owned inventory could not be refreshed. Refresh before another write.")
          return
        }
        setAssets(null)
        if (versions !== null) {
          try {
            await readVersions()
          } catch {
            // This is an optional read. The owned-site inventory was refreshed.
            setVersions(null)
            setError("Site action confirmed, but saved versions are unavailable. Reopen versions to refresh.")
            return
          }
        }
      }
      setMessage(success)
    } finally {
      setBusy(false)
    }
  }
  const action = (name: "start" | "stop" | "restart" | "rollback") => {
    if (site.state === "unknown" || outcomeUnknown) return
    if ((name === "stop" || name === "restart" || name === "rollback") &&
        !window.confirm("Apply " + name + " only to " + site.name + "?")) return
    void execute(() => mutate(endpoint + "/" + site.id + "/" + name, "POST"),
      name[0].toUpperCase() + name.slice(1) + " completed.", true,
      observed => name === "stop" ? observed.state === "stopped" :
        name === "rollback" ? observed.activeRelease === site.previousRelease :
        observed.state === "running")
  }
  const zip = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ""
    if (!file || busy || outcomeUnknown || site.state === "unknown") return
    const invalid = validateStaticZipSelection(file)
    if (invalid) {
      setError(invalid)
      setMessage(null)
      return
    }
    if (site.activeRelease && !window.confirm("Publish a new release of " + site.name + "?")) return
    void execute(() => mutate(endpoint + "/" + site.id + "/deploy", "PUT", file, "application/zip"),
      "ZIP was published as a new immutable release.", true,
      observed => observed.activeRelease !== null && observed.activeRelease !== site.activeRelease &&
        observed.fileCount > 0 && observed.bytes > 0)
  }
  const folder = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.currentTarget.files ?? [])
    event.currentTarget.value = ""
    if (!files.length || busy || outcomeUnknown || site.state === "unknown") return
    if (site.activeRelease && !window.confirm("Publish a new release of " + site.name + "?")) return
    void execute(async () => {
      const payload = await encodeStaticFolder(files)
      return await mutate(endpoint + "/" + site.id + "/deploy", "PUT",
        payload, "application/json")
    }, "Folder was published as a new immutable release.", true,
    observed => observed.activeRelease !== null && observed.activeRelease !== site.activeRelease)
  }
  const publishHtml = () => {
    if (busy || outcomeUnknown || !editorReady || site.state === "unknown" || site.fileCount > 1 || !html.trim()) return
    const bytes = new TextEncoder().encode(html)
    if (bytes.length > maxStarterHtml) {
      setError("HTML is larger than 32 KiB. Use Upload folder or ZIP instead.")
      return
    }
    if (site.activeRelease && !window.confirm(
      "Publish new index.html release of " + site.name + "?")) return
    void execute(async () => mutate(endpoint + "/" + site.id + "/deploy", "PUT",
      JSON.stringify({
        files: [{ name: "index.html", base64: encodeBase64(bytes) }],
      }), "application/json"),
    "HTML was published as a new immutable release. Press Start if the site is stopped.",
    true, observed =>
      observed.activeRelease !== null &&
      observed.activeRelease !== site.activeRelease &&
      observed.fileCount === 1)
  }
  const verify = () => {
    void execute(async () => {
      const response = await fetch(endpoint + "/" + site.id + "/health", {
        credentials: "same-origin", cache: "no-store", signal: readSignal(),
      })
      if (!response.ok) throw new Error("HTTP verification is unavailable.")
      const ready = parseFleetHealth(await response.json())
      setHealth(ready)
    }, "HTTP check completed.")
  }
  const loadLogs = () => {
    void execute(async () => {
      const response = await fetch(endpoint + "/" + site.id + "/logs", {
        credentials: "same-origin", cache: "no-store", signal: readSignal(),
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
          <Badge variant="outline">{site.fileCount} files · {formatBytes(site.bytes)}</Badge>
          <Badge variant="outline">{site.releases} releases</Badge>
          {health !== null && <Badge variant="outline">HTTP: {health ? "healthy" : "unavailable"}</Badge>}
        </div>
        <SiteProcessSummary site={site} />
        {site.state === "unknown" && <p role="alert" className="text-destructive text-sm">
          Process identity is uncertain. All mutations are blocked; no unverified process is signalled.
        </p>}
        {site.state === "running" && <div className="pb-2 pt-1">
          <a className="inline-flex py-1 text-sm underline underline-offset-4"
            target="_blank" rel="noopener noreferrer" href={siteAddress(site)}>Open hosted site</a>
        </div>}
        <section className="space-y-3 rounded-md border p-3" aria-label={"Quick HTML starter for " + site.name}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-medium">Quick HTML website</p>
              <p className="text-xs text-muted-foreground">
                Edit index.html → Publish HTML → Start → Open hosted site.
                Open the editor again to update; each publish creates a rollback version.
              </p>
            </div>
            <Button size="sm" variant="outline"
              disabled={busy || outcomeUnknown || htmlLoading || site.state === "unknown" || site.fileCount > 1}
              onClick={toggleHtmlEditor}>
              {editorVisible ? "Hide HTML editor" :
                site.activeRelease ? "Edit current HTML" : "Edit starter HTML"}
            </Button>
          </div>
          {site.fileCount > 1 && <p className="text-xs text-muted-foreground">
            The quick editor is for single-file HTML sites. Existing multi-file releases are left unchanged.
          </p>}
          {editorVisible && htmlLoading && <p role="status" className="text-xs">Loading active index.html…</p>}
          {editorReady && <div className="space-y-2">
            <label className="block text-xs font-medium" htmlFor={site.id + "-html"}>
              index.html source
            </label>
            <p className="text-xs text-muted-foreground">
              {editorRelease ? "Editing active release " + editorRelease.slice(0, 12) + "…" : "Editing new starter page"}
            </p>
            <textarea id={site.id + "-html"} rows={11} maxLength={maxStarterHtml}
              value={html} onChange={event => setHtml(event.target.value)}
              disabled={busy || outcomeUnknown || site.state === "unknown"}
              className="w-full rounded-md border bg-background p-3 font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground">
              One static index.html, maximum 32 KiB. Publishing does not start a stopped site.
              Each publish creates a new version you can roll back.
            </p>
            <Button size="sm" disabled={busy || outcomeUnknown || !editorReady || site.state === "unknown" || !html.trim() ||
              new TextEncoder().encode(html).length > maxStarterHtml}
              onClick={publishHtml}>
              Publish HTML
            </Button>
          </div>}
        </section>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium" htmlFor={site.id + "-zip"}>
              <FileArchive className="size-4" /> Upload static ZIP
            </label>
            <Input id={site.id + "-zip"} type="file" accept=".zip,application/zip"
              disabled={busy || outcomeUnknown || site.state === "unknown"} onChange={zip} />
            <p className="text-xs text-muted-foreground">
              Max 9 MiB compressed, root index.html required. Upload publishes a new immutable release.
            </p>
          </div>
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium" htmlFor={site.id + "-folder"}>
              <Upload className="size-4" /> Upload folder
            </label>
            <Input ref={folderInput} id={site.id + "-folder"} type="file" multiple
              disabled={busy || outcomeUnknown || site.state === "unknown"} onChange={folder} />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {site.state === "running" ? <>
            <Button variant="outline" disabled={busy || outcomeUnknown} onClick={() => action("restart")}><RotateCcw /> Restart</Button>
            <Button variant="outline" disabled={busy || outcomeUnknown} onClick={() => action("stop")}><Square /> Stop</Button>
          </> : <Button disabled={busy || outcomeUnknown || site.state === "unknown" || !site.activeRelease}
            onClick={() => action("start")}><Play /> Start</Button>}
          <Button variant="outline" disabled={busy || outcomeUnknown || site.state === "unknown" || !site.canRollback}
            onClick={() => action("rollback")}><History /> Rollback</Button>
          <Button variant="outline" disabled={busy} onClick={verify}><Activity /> Verify HTTP</Button>
          <Button variant="outline" disabled={busy} onClick={loadLogs}><RefreshCw /> Read logs</Button>
          {site.activeRelease && <a
            className="inline-flex min-h-9 items-center justify-center rounded-md border px-3 text-sm font-medium hover:bg-muted"
            href={endpoint + "/" + site.id + "/export"}
            download={site.id + "-" + site.activeRelease + ".zip"}>
            <FileArchive className="mr-2 size-4" /> Download active ZIP
          </a>}
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
        <SiteVersionHistory site={site} versions={versions} busy={busy || outcomeUnknown}
          previewBase={siteAddress(site)} onVersionAction={versionAction} />
        {busy && <p role="status" className="text-sm">Working with this owned site…</p>}
        {outcomeUnknown && <p role="alert" className="text-destructive text-sm">
          Write actions are paused for this site until the owned inventory is refreshed.
          Read-only logs and HTTP checks remain available.
        </p>
        {error && <p role="alert" className="text-destructive text-sm">{error}</p>}
        {message && <p role="status" className="text-sm">{message}</p>}
        <SiteDeploymentHistory site={site} />
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
  const [searchParams, setSearchParams] = useSearchParams()
  const selectedSiteId = searchParams.get("site")
  const [sites, setSites] = React.useState<FleetSite[]>([])
  const [name, setName] = React.useState("")
  const [initialZip, setInitialZip] = React.useState<File | null>(null)
  const [initialFolder, setInitialFolder] = React.useState<File[]>([])
  const [publishStarter, setPublishStarter] = React.useState(false)
  const initialZipInput = React.useRef<HTMLInputElement>(null)
  const initialFolderInput = React.useRef<HTMLInputElement>(null)
  React.useEffect(() => {
    initialFolderInput.current?.setAttribute("webkitdirectory", "")
    initialFolderInput.current?.setAttribute("directory", "")
  }, [])
  const [loading, setLoading] = React.useState(true)
  const [creating, setCreating] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [inputError, setInputError] = React.useState<string | null>(null)
  const [notice, setNotice] = React.useState<string | null>(null)

  const reload = React.useCallback(async (signal?: AbortSignal) => {
    const entries = await readSites(signal).catch(cause => {
      if (!signal?.aborted) {
        setSites([])
        setError(cause instanceof Error ? cause.message : "Could not load static sites.")
      }
      throw cause
    })
    if (!signal?.aborted) { setSites(entries); setError(null) }
  }, [])
  React.useEffect(() => {
    const controller = new AbortController()
    void Promise.resolve().then(() => reload(controller.signal))
      .catch(() => {})
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [reload])
  const refresh = async () => {
    setLoading(true)
    await reload().catch(() => undefined)
    setLoading(false)
  }
  const createSite = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (creating || loading || error !== null || sites.length >= 8) return
    const firstRelease = initialZip
    const firstFolder = initialFolder
    const starter = publishStarter && firstRelease === null && firstFolder.length === 0
    const hasFirstFiles = firstRelease !== null || firstFolder.length > 0 || starter
    if (firstRelease) {
      const invalid = validateStaticZipSelection(firstRelease)
      if (invalid) {
        setInputError(invalid)
        setNotice(null)
        return
      }
    }
    setCreating(true)
    setInputError(null)
    setNotice(null)
    try {
      if (firstRelease) {
        const structuralError = await inspectInitialStaticZip(firstRelease)
        if (structuralError) {
          setInputError(structuralError)
          return
        }
      }
      let created: FleetSite
      try {
        // Both initial import formats use the same single server-validated
        // create-and-publish endpoint. Prepare folder data before any POST.
        const folderPayload = firstFolder.length ? await encodeStaticFolder(firstFolder) : null
        const starterPayload = starter ? JSON.stringify({ files: [{
          name: "index.html", base64: encodeBase64(new TextEncoder().encode(starterHtml)),
        }] }) : null
        const importEndpoint = endpoint + "/import?name=" + encodeURIComponent(name.trim())
        created = firstRelease
          ? await mutate(importEndpoint, "POST", firstRelease, "application/zip")
          : folderPayload !== null || starterPayload !== null
            ? await mutate(importEndpoint, "POST", folderPayload ?? starterPayload!, "application/json")
            : await mutate(endpoint + "/", "POST",
              JSON.stringify({ name }), "application/json")
      } catch (cause) {
        if (cause instanceof StaticSiteInputRejected) {
          setInputError(cause.message)
        } else {
          setSites([])
          setError(hasFirstFiles
            ? "Create and import result unconfirmed. Refresh the site list before retrying; no automatic retry."
            : "Create result unconfirmed. Refresh the site list before retrying.")
        }
        return
      }
      try {
        const observed = await readSites()
        const matching = observed.filter(site => site.id === created.id)
        const current = matching[0]
        if (matching.length !== 1 || !current ||
            current.name !== name.trim() ||
            current.kind !== "static-site" ||
            current.state !== "stopped" || current.pid !== null ||
            current.startTicks !== null ||
            current.previousRelease !== null || current.canRollback ||
            created.id !== current.id || created.name !== current.name ||
            created.port !== current.port || created.state !== current.state ||
            created.activeRelease !== current.activeRelease ||
            created.fileCount !== current.fileCount ||
            created.bytes !== current.bytes ||
            created.releases !== current.releases)
          throw new Error("create-readback-mismatch")
        if (hasFirstFiles) {
          // A single POST acknowledgment is insufficient. Confirm the exact
          // owned site independently before exposing controls for its release.
          const response = await fetch(endpoint + "/" + created.id, {
            credentials: "same-origin", cache: "no-store", signal: readSignal(),
          })
          if (!response.ok) throw new Error("first-release-readback-unavailable")
          const exact = parseFleetSite(await response.json())
          if (created.activeRelease === null || created.releases !== 1 ||
              created.fileCount < 1 || created.bytes < 1 ||
              exact.id !== created.id || exact.name !== created.name ||
              exact.port !== created.port || exact.state !== "stopped" ||
              exact.pid !== null || exact.previousRelease !== null ||
              exact.activeRelease !== created.activeRelease ||
              exact.fileCount !== created.fileCount || exact.bytes !== created.bytes ||
              exact.releases !== created.releases ||
              exact.history.length !== created.history.length)
            throw new Error("first-release-readback-mismatch")
        } else if (created.activeRelease !== null || created.releases !== 0 ||
                   created.fileCount !== 0 || created.bytes !== 0) {
          throw new Error("unexpected initial site release")
        }
        setSites(observed)
        setName("")
        setInitialZip(null)
        setInitialFolder([])
        setPublishStarter(false)
        if (initialZipInput.current) initialZipInput.current.value = ""
        if (initialFolderInput.current) initialFolderInput.current.value = ""
        setNotice(hasFirstFiles
          ? 'Site "' + created.name + '" created and ' +
            (firstRelease ? "ZIP" : firstFolder.length ? "folder" : "starter HTML") +
            ' published as its first immutable release. Press Start when ready.'
          : 'Site "' + created.name + '" created. Edit HTML to publish the first release.')
      } catch {
        setSites([])
        setError(hasFirstFiles
          ? 'Initial import was acknowledged, but its site/release could not be confirmed. Refresh before retrying; no automatic retry.'
          : "Creation was acknowledged, but the new site's identity and stopped state could not be confirmed. Refresh before retrying; no automatic retry.")
      }
    } finally { setCreating(false) }
  }

  return (
    <BaseLayout title="Hosted sites" description="Create and operate your own static sites on Samsung Termux, without a shell.">
      <div className="space-y-5 px-4 pb-8 lg:px-6">
        <div className="flex min-h-10 items-center justify-end">
          <Button type="button" variant="outline" disabled={loading} onClick={() => void refresh()}>
            <RefreshCw className="size-4" /> Refresh
          </Button>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>New hosted site</CardTitle>
            <CardDescription>HTML, CSS and JavaScript. Import a ZIP or folder; up to eight sites.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={createSite} className="space-y-3">
              <div className="flex flex-col gap-3 sm:flex-row">
                <label htmlFor="new-owned-site" className="sr-only">Site name</label>
                <Input id="new-owned-site" value={name}
                  disabled={creating || loading}
                  onChange={event => {
                    setName(event.target.value)
                    setInputError(null)
                  }}
                  placeholder="My first site" minLength={2} maxLength={60} required />
                <Button type="submit"
                  disabled={creating || loading || error !== null || sites.length >= 8 || name.trim().length < 2}>
                  <FolderOpen /> {initialZip ? "Create and import ZIP" :
                    initialFolder.length ? "Create and import folder" :
                    publishStarter ? "Create with starter HTML" : "Create site"}
                </Button>
              </div>
              <div className="space-y-1">
                <label htmlFor="initial-owned-site-zip" className="text-sm font-medium">
                  Initial ZIP (optional)
                </label>
                <Input id="initial-owned-site-zip" type="file" ref={initialZipInput}
                  accept=".zip,application/zip" disabled={creating || loading}
                  onChange={event => {
                    const picked = event.currentTarget.files?.[0] ?? null
                    setInitialZip(picked)
                    if (picked) {
                      setInitialFolder([])
                      setPublishStarter(false)
                      if (initialFolderInput.current) initialFolderInput.current.value = ""
                    }
                    setInputError(null)
                  }} />
                <p className="text-xs text-muted-foreground">
                  ZIP up to 9 MiB compressed, or choose a folder below. Only one source is imported.
                </p>
              </div>
              <div className="space-y-1">
                <label htmlFor="initial-owned-site-folder" className="text-sm font-medium">
                  Initial folder (optional)
                </label>
                <Input id="initial-owned-site-folder" type="file" multiple ref={initialFolderInput}
                  disabled={creating || loading}
                  onChange={event => {
                    const selected = Array.from(event.currentTarget.files ?? [])
                    setInitialFolder(selected)
                    if (selected.length) {
                      setInitialZip(null)
                      setPublishStarter(false)
                      if (initialZipInput.current) initialZipInput.current.value = ""
                    }
                    setInputError(null)
                  }} />
                <p className="text-xs text-muted-foreground">
                  Up to 100 files, 2 MiB each, 8 MiB total. Include index.html.
                  The server validates all files before creating the stopped site.
                  No automatic retry or start.
                </p>
              </div>
              <div className="space-y-1">
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input type="checkbox" className="size-4"
                    checked={publishStarter}
                    disabled={creating || loading || initialZip !== null || initialFolder.length > 0}
                    onChange={event => {
                      setPublishStarter(event.currentTarget.checked)
                      setInputError(null)
                    }} />
                  Publish starter HTML on creation
                </label>
                <p className="text-xs text-muted-foreground">
                  Instead of uploading files, publish a sample index.html as the first stopped release.
                  You can edit it after creation. No automatic start.
                </p>
                {inputError && <p role="alert" className="text-destructive text-sm">{inputError}</p>}
              </div>
            </form>
          </CardContent>
        </Card>
        {selectedSiteId && <div className="flex flex-wrap items-center gap-3 text-sm">
          <span>{sites.some(site => site.id === selectedSiteId)
            ? "Selected static site: " + sites.find(site => site.id === selectedSiteId)?.name
            : "Selected static site: " + selectedSiteId}</span>
          <Button variant="outline" size="sm" onClick={() => setSearchParams({})}>Show all sites</Button>
        </div>}
        {loading && <p role="status" className="text-sm">Reading owned site inventory…</p>}
        {error && <p role="alert" className="text-destructive text-sm">{error}</p>}
        {notice && <p role="status" className="text-sm">{notice}</p>}
        {!loading && sites.length === 0 && !error && <p className="text-muted-foreground text-sm">
          No static sites yet. Create your first site above.
        </p>}
        {!loading && selectedSiteId && !sites.some(site => site.id === selectedSiteId) && !error &&
          <p role="alert" className="text-sm">This static site was not found in the owned inventory.</p>}
        <div className="grid gap-5">
          {sites.filter(site => !selectedSiteId || site.id === selectedSiteId)
            .map(site => <SiteCard key={site.id} site={site} onChange={reload} />)}
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
