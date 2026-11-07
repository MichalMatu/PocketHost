import * as React from "react"
import { Globe2, Play, Square, RotateCcw, RefreshCw, Upload } from "lucide-react"

import { BaseLayout } from "@/components/layouts/base-layout"
import {
  parseOwnedSiteLogs,
  parseOwnedSiteState,
  type OwnedSiteStateResponse,
} from "@/lib/owned-site-schema"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

async function getState(signal?: AbortSignal): Promise<OwnedSiteStateResponse> {
  const response = await fetch("/api/v1/owned-site", {
    cache: "no-store",
    credentials: "same-origin",
    signal,
  })
  if (!response.ok) throw new Error("Site state unavailable")
  const data: unknown = await response.json()
  return parseOwnedSiteState(data)
}

export default function OwnedSitePage() {
  const [state, setState] = React.useState<OwnedSiteStateResponse | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [logs, setLogs] = React.useState<string[]>([])
  const [selectedVersion, setSelectedVersion] = React.useState<"1" | "2" | null>(null)

  const refresh = async () => {
    const current = await getState()
    setState(current)
    // Reset to the server's actual version after refresh or a successful action.
    setSelectedVersion(null)
    if (current.enabled && current.site?.state !== "absent") {
      const response = await fetch("/api/v1/owned-site/logs", {
        credentials: "same-origin",
        cache: "no-store",
      })
      if (response.ok) {
        const data: unknown = await response.json()
        setLogs(parseOwnedSiteLogs(data))
      }
    } else {
      setLogs([])
    }
  }

  React.useEffect(() => {
    const controller = new AbortController()
    void getState(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setState(data)
      })
      .catch(() => {
        if (!controller.signal.aborted) setError("Could not read site state.")
      })
    return () => controller.abort()
  }, [])

  const act = async (name: "create" | "start" | "stop" | "publish/v1" | "publish/v2" | "rollback") => {
    if (!state?.enabled || busy) return
    setBusy(true)
    setError(null)
    try {
      const response = await fetch(`/api/v1/owned-site/${name}`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "X-PocketHost-Intent": "owned-demo" },
      })
      if (!response.ok) throw new Error("Operation refused. Check ownership or port availability.")
      await refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Operation failed safely.")
    } finally {
      setBusy(false)
    }
  }

  const site = state?.site
  const targetVersion = selectedVersion ?? (site?.contentVersion === 2 ? "2" : "1")
  const isOwned = site?.ownership === "pockethost"
  const running = site?.state === "running"
  const unknown = site?.state === "unknown"
  const testSiteUrl =
    typeof window !== "undefined" && window.location.port === "18878"
      ? `${window.location.protocol}//${window.location.hostname}:18879/`
      : site?.url

  return (
    <BaseLayout
      title="My test site"
      description="One isolated PocketHost-owned site; observed Termux services remain read-only."
    >
      <div className="flex flex-col gap-6 px-4 lg:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Badge variant="secondary"><Globe2 /> Owned demo only</Badge>
          <Button variant="outline" disabled={busy} onClick={() => void refresh().catch(() => setError("Refresh failed."))}>
            <RefreshCw /> Refresh
          </Button>
        </div>
        {!state && !error && <p className="text-muted-foreground">Reading site state…</p>}
        {!state?.enabled && state && (
          <Card>
            <CardHeader>
              <CardTitle>Site management not enabled in this session</CardTitle>
              <CardDescription>
                This is a DEV-only experiment. Start PocketHost explicitly with its isolated-site
                feature flag after passing hardware quality gates. No services have been changed.
              </CardDescription>
            </CardHeader>
          </Card>
        )}
        {error && (
          <Card><CardContent role="alert" className="text-destructive">{error}</CardContent></Card>
        )}
        {state?.enabled && site && (
          <>
            <Card>
              <CardHeader>
                <CardTitle>PocketHost local demo</CardTitle>
                <CardDescription>
                  Explicitly owned test data on a dedicated loopback port. No external service control.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-5">
                <div className="flex flex-wrap gap-3">
                  <Badge variant="outline">Ownership: {site.ownership}</Badge>
                  <Badge variant="secondary">State: {site.state}</Badge>
                  {isOwned && <Badge variant="outline">Content v{site.contentVersion}</Badge>}
                </div>
                <div className="flex flex-wrap gap-2">
                  {!isOwned && (
                    <Button disabled={busy} onClick={() => void act("create")}>
                      <Globe2 /> Create test site
                    </Button>
                  )}
                  {isOwned && !running && !unknown && (
                    <Button disabled={busy} onClick={() => void act("start")}>
                      <Play /> Start site
                    </Button>
                  )}
                  {isOwned && running && (
                    <Button variant="outline" disabled={busy} onClick={() => void act("stop")}>
                      <Square /> Stop site
                    </Button>
                  )}
                  {isOwned && !unknown && (
                    <div className="flex flex-wrap items-center gap-2">
                      <label htmlFor="pockethost-demo-version" className="text-sm text-muted-foreground">
                        Target version
                      </label>
                      <Select
                        value={targetVersion}
                        onValueChange={(value) => {
                          if (value === "1" || value === "2") setSelectedVersion(value)
                        }}
                        disabled={busy}
                      >
                        <SelectTrigger id="pockethost-demo-version" aria-label="Target version">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">v1 — First local site</SelectItem>
                          <SelectItem value="2">v2 — Updated local site</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        variant="outline"
                        disabled={busy || targetVersion === String(site.contentVersion)}
                        onClick={() => void act(targetVersion === "1" ? "publish/v1" : "publish/v2")}
                      >
                        <Upload /> Publish selected version
                      </Button>
                    </div>
                  )}
                  {isOwned && (
                    <Button
                      variant="outline"
                      disabled={busy || unknown || !site.canRollback}
                      title={site.canRollback ? "Undo last sample publish" : "No recent sample publish to undo"}
                      onClick={() => void act("rollback")}
                    >
                      <RotateCcw /> Rollback version
                    </Button>
                  )}
                </div>
                {running && (
                  <p className="text-sm text-muted-foreground">
                    <a href={testSiteUrl} target="_blank" rel="noopener noreferrer" className="underline">
                      Open locally hosted test page
                    </a>
                  </p>
                )}
                {unknown && (
                  <p role="alert" className="text-destructive">
                    Process identity cannot be verified. Actions are blocked; no process will be killed.
                  </p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Activity logs</CardTitle>
                <CardDescription>Bounded output from this PocketHost-owned site only.</CardDescription>
              </CardHeader>
              <CardContent>
                {logs.length
                  ? <pre className="overflow-x-auto rounded-lg bg-muted p-4 text-xs">{logs.join("\n")}</pre>
                  : <p className="text-muted-foreground">No own-site logs available.</p>}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </BaseLayout>
  )
}
