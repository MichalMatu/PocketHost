import * as React from "react"
import { Activity, FolderOpen, Globe2, History, Play, RefreshCw, RotateCcw, Square, Upload } from "lucide-react"
import { Link } from "react-router-dom"

import { BaseLayout } from "@/components/layouts/base-layout"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { parseOwnedSiteLogs, parseOwnedSiteState, type OwnedSiteStateResponse } from "@/lib/owned-site-schema"
import { parseOwnedHealth, parseOwnedProject, type OwnedProject } from "@/lib/owned-project-schema"

const base = "/api/v1/owned-site"

async function readState(signal?: AbortSignal): Promise<OwnedSiteStateResponse> {
  const response = await fetch(base, { cache: "no-store", credentials: "same-origin", signal })
  if (!response.ok) throw new Error("Site state unavailable")
  return parseOwnedSiteState(await response.json())
}

async function readProject(signal?: AbortSignal): Promise<OwnedProject> {
  const response = await fetch(base + "/project", { cache: "no-store", credentials: "same-origin", signal })
  if (!response.ok) throw new Error("Project metadata unavailable")
  return parseOwnedProject(await response.json())
}

async function readLogs(signal?: AbortSignal): Promise<string[]> {
  const response = await fetch(base + "/logs", { cache: "no-store", credentials: "same-origin", signal })
  if (!response.ok) throw new Error("Runtime logs unavailable")
  return parseOwnedSiteLogs(await response.json())
}

async function readHealth(signal?: AbortSignal): Promise<boolean> {
  const response = await fetch(base + "/health", { cache: "no-store", credentials: "same-origin", signal })
  if (!response.ok) throw new Error("HTTP verification unavailable")
  return parseOwnedHealth(await response.json())
}

type Action = "create" | "start" | "stop" | "restart" | "publish/v1" | "publish/v2" | "rollback"
const confirmation: Partial<Record<Action, string>> = {
  stop: "Stop the verified PocketHost demo process? External services will not be touched.",
  restart: "Restart only the PocketHost-owned test application?",
  rollback: "Restore the previous demo release? This rollback can be used only once.",
}

export default function OwnedSitePage() {
  const [state, setState] = React.useState<OwnedSiteStateResponse | null>(null)
  const [project, setProject] = React.useState<OwnedProject | null>(null)
  const [logs, setLogs] = React.useState<string[]>([])
  const [health, setHealth] = React.useState<boolean | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [success, setSuccess] = React.useState<string | null>(null)
  const [selectedVersion, setSelectedVersion] = React.useState<"1" | "2" | null>(null)

  const refresh = React.useCallback(async (signal?: AbortSignal) => {
    const current = await readState(signal)
    if (signal?.aborted) return
    setState(current)
    setSelectedVersion(null)
    if (!current.enabled) {
      setProject(null)
      setLogs([])
      setHealth(null)
      return
    }
    const details = await readProject(signal)
    if (signal?.aborted) return
    setProject(details)
    if (details.state === "absent") {
      setLogs([])
      setHealth(null)
      return
    }
    const [logEntries, ready] = await Promise.all([readLogs(signal), readHealth(signal)])
    if (signal?.aborted) return
    setLogs(logEntries)
    setHealth(ready)
  }, [])

  React.useEffect(() => {
    const controller = new AbortController()
    void refresh(controller.signal)
      .catch(() => {
        if (!controller.signal.aborted) setError("Cannot read the owned application. Existing services are unchanged.")
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [refresh])

  const reload = async () => {
    setLoading(true)
    setError(null)
    try {
      await refresh()
    } catch {
      setError("Could not refresh project details, health or logs.")
    } finally {
      setLoading(false)
    }
  }

  const act = async (action: Action) => {
    if (!state?.enabled || busy) return
    const message = confirmation[action]
    if (message && !window.confirm(message)) return
    setBusy(true)
    setError(null)
    setSuccess(null)
    try {
      const response = await fetch(base + "/" + action, {
        method: "POST",
        credentials: "same-origin",
        headers: { "X-PocketHost-Intent": "owned-demo" },
      })
      if (!response.ok) throw new Error("Operation refused. Check ownership, process identity and port availability.")
      await refresh()
      setSuccess(action === "restart" ? "Verified own process restarted." : "Action completed on the owned demo.")
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Operation rejected safely.")
    } finally {
      setBusy(false)
    }
  }

  const site = state?.site
  const owned = site?.ownership === "pockethost"
  const running = site?.state === "running"
  const unknown = site?.state === "unknown"
  const targetVersion = selectedVersion ?? String(site?.contentVersion ?? 1)
  const siteUrl = typeof window !== "undefined" && window.location.port === "18878"
    ? `${window.location.protocol}//${window.location.hostname}:18879/`
    : site?.url

  return (
    <BaseLayout title="Project details" description="One real, isolated test application on the Samsung Termux host.">
      <div className="flex flex-col gap-5 px-4 pb-8 lg:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary"><Globe2 className="size-3" /> PocketHost-owned</Badge>
            <Badge variant="outline">Manual session · no autostart</Badge>
          </div>
          <Button variant="outline" disabled={busy || loading} onClick={() => void reload()}>
            <RefreshCw className={loading ? "animate-spin" : ""} /> Refresh
          </Button>
        </div>
        {loading && <p role="status" className="text-muted-foreground">Reading project and checking HTTP…</p>}
        {error && <p role="alert" className="text-destructive text-sm">{error}</p>}
        {success && <p role="status" className="text-sm">{success}</p>}
        {state && !state.enabled && (
          <Card>
            <CardHeader>
              <CardTitle>Project controls unavailable</CardTitle>
              <CardDescription>This session did not enable the owned-demo DEV adapter. Enable it only through the manual PocketHost launch procedure; no other services are managed here.</CardDescription>
            </CardHeader>
          </Card>
        )}
        {project && site && state?.enabled && (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><FolderOpen className="size-5" /> {project.name}</CardTitle>
                <CardDescription>{project.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">Status: {project.state}</Badge>
                  <Badge variant="outline">{project.type}</Badge>
                  <Badge variant="outline">HTTP: {health === null ? "not checked" : health ? "healthy" : "unavailable"}</Badge>
                </div>
                <dl className="grid gap-3 text-sm sm:grid-cols-2">
                  <div><dt className="text-muted-foreground">Project ID</dt><dd className="font-mono">{project.id}</dd></div>
                  <div><dt className="text-muted-foreground">Local port</dt><dd>{project.port} · loopback only</dd></div>
                  <div><dt className="text-muted-foreground">Data directory</dt><dd className="break-all font-mono">{project.dataDirectory}</dd></div>
                  <div><dt className="text-muted-foreground">Active release</dt><dd>{project.contentVersion === null ? "not created" : `v${project.contentVersion}`}</dd></div>
                  <div><dt className="text-muted-foreground">Verified PID / start ticks</dt><dd className="font-mono">{project.pid === null ? "none" : `${project.pid} / ${project.startTicks}`}</dd></div>
                  <div><dt className="text-muted-foreground">Rollback release</dt><dd>{project.previousVersion === null ? "not available" : `v${project.previousVersion}`}</dd></div>
                </dl>
                {running && siteUrl && (
                  <a className="inline-flex text-sm underline underline-offset-4" href={siteUrl} target="_blank" rel="noopener noreferrer">Open hosted application</a>
                )}
                {unknown && <p role="alert" className="text-destructive text-sm">Process ownership is uncertain. Start, Stop and Restart are blocked; no unverified PID will be signalled.</p>}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Application lifecycle</CardTitle><CardDescription>Create → start → verify → publish → rollback → restart or stop.</CardDescription></CardHeader>
              <CardContent className="flex flex-wrap items-center gap-3">
                {!owned && <Button disabled={busy} onClick={() => void act("create")}><Globe2 /> Create demo project</Button>}
                {owned && !running && !unknown && <Button disabled={busy} onClick={() => void act("start")}><Play /> Start</Button>}
                {owned && running && <Button variant="outline" disabled={busy} onClick={() => void act("restart")}><RotateCcw /> Restart</Button>}
                {owned && running && <Button variant="outline" disabled={busy} onClick={() => void act("stop")}><Square /> Stop</Button>}
                {owned && !unknown && (
                  <>
                    <label htmlFor="pockethost-demo-version" className="text-sm">Target release</label>
                    <Select value={targetVersion} onValueChange={(v) => {
                      if (v === "1" || v === "2") setSelectedVersion(v)
                    }} disabled={busy}>
                      <SelectTrigger id="pockethost-demo-version" aria-label="Target release"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">v1 — First local site</SelectItem>
                        <SelectItem value="2">v2 — Updated local site</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button variant="outline" disabled={busy || targetVersion === String(site.contentVersion)}
                      onClick={() => void act(targetVersion === "1" ? "publish/v1" : "publish/v2")}>
                      <Upload /> Publish
                    </Button>
                  </>
                )}
                {owned && <Button variant="outline" disabled={busy || unknown || !site.canRollback}
                  title={site.canRollback ? "Undo last different-version publish" : "No rollback available"}
                  onClick={() => void act("rollback")}>
                  <History /> Rollback
                </Button>}
                {owned && <Button variant="secondary" disabled={busy || loading}
                  onClick={() => void reload()}><Activity /> Verify HTTP</Button>}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Deployment history</CardTitle><CardDescription>Durable, bounded history of this exact owned application only.</CardDescription></CardHeader>
              <CardContent>
                {project.history.length === 0 ? <p className="text-muted-foreground text-sm">No recorded deployments yet. Earlier legacy releases are not reconstructed.</p> : (
                  <ol className="space-y-2 text-sm">
                    {project.history.map((entry, index) => (
                      <li key={entry.at + index} className="flex flex-wrap justify-between gap-2 border-b pb-2">
                        <span>{entry.action} · {entry.from === null ? "new" : `v${entry.from}`} → v{entry.to}</span>
                        <time className="text-muted-foreground">{entry.at}</time>
                      </li>
                    ))}
                  </ol>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Runtime logs</CardTitle><CardDescription>Last 25 bounded lines from the owned process. <Link className="underline" to="/observability">Host observability</Link></CardDescription></CardHeader>
              <CardContent>
                {logs.length ? <pre className="max-h-80 overflow-auto rounded-md bg-muted p-4 text-xs">{logs.join("\n")}</pre> :
                  <p className="text-muted-foreground text-sm">No owned process logs available.</p>}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </BaseLayout>
  )
}
