import * as React from "react"
import { Link } from "react-router-dom"
import { Database, FolderArchive, HardDrive, RefreshCw, ShieldCheck } from "lucide-react"

import { BaseLayout } from "@/components/layouts/base-layout"
import { parseOwnedProject, type OwnedProject } from "@/lib/owned-project-schema"
import {
  parseManagedPhotoMapResponse,
  parseLegacyPhotoMapEvents,
  type ManagedPhotoMapProject,
  type LegacyPhotoMapEventResponse,
} from "@/lib/managed-photomap-schema"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

async function readProject(signal?: AbortSignal): Promise<ManagedPhotoMapProject> {
  const response = await fetch("/api/v1/managed-photomap", {
    cache: "no-store",
    credentials: "same-origin",
    signal,
  })
  if (!response.ok) throw new Error("Managed PhotoMap inventory could not be verified.")
  const data: unknown = await response.json()
  return parseManagedPhotoMapResponse(data)
}

async function readOwned(signal?: AbortSignal): Promise<OwnedProject> {
  const response = await fetch("/api/v1/owned-site/project", {
    cache: "no-store", credentials: "same-origin", signal,
  })
  if (!response.ok) throw new Error("Owned demo not enabled")
  return parseOwnedProject(await response.json())
}

export default function ManagedProjectsPage() {
  const [project, setProject] = React.useState<ManagedPhotoMapProject | null>(null)
  const [owned, setOwned] = React.useState<OwnedProject | null>(null)
  const [ownedError, setOwnedError] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [legacyEvents, setLegacyEvents] = React.useState<LegacyPhotoMapEventResponse | null>(null)
  const [eventsLoading, setEventsLoading] = React.useState(false)
  const [eventsError, setEventsError] = React.useState<string | null>(null)

  React.useEffect(() => {
    const controller = new AbortController()
    void readOwned(controller.signal)
      .then((value) => { if (!controller.signal.aborted) setOwned(value) })
      .catch(() => { if (!controller.signal.aborted) setOwnedError(true) })
    void readProject(controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) setProject(value)
      })
      .catch(() => {
        if (!controller.signal.aborted) setError("Cannot read managed project state.")
      })
    return () => controller.abort()
  }, [])

  async function refresh() {
    setLoading(true)
    setError(null)
    try {
      const [own, imported] = await Promise.allSettled([readOwned(), readProject()])
      if (own.status === "fulfilled") {
        setOwned(own.value)
        setOwnedError(false)
      } else {
        setOwned(null)
        setOwnedError(true)
      }
      if (imported.status === "fulfilled") setProject(imported.value)
      else setError("Cannot read the separate PhotoMap TEST inventory.")
    } catch {
      setError("Cannot read managed project state.")
    } finally {
      setLoading(false)
    }
  }

  async function inspectEvents() {
    if (eventsLoading) return
    setEventsLoading(true)
    setEventsError(null)
    try {
      const response = await fetch("/api/v1/managed-photomap/events", {
        method: "GET", cache: "no-store", credentials: "same-origin",
      })
      if (!response.ok) throw new Error("Legacy runtime diagnostics unavailable")
      setLegacyEvents(parseLegacyPhotoMapEvents(await response.json()))
    } catch {
      setLegacyEvents(null)
      setEventsError("Legacy runtime event inventory unavailable; no processes were changed.")
    } finally {
      setEventsLoading(false)
    }
  }

  const imported = project?.ownership === "pockethost" && project.importState === "verified-copy"

  return (
    <BaseLayout
      title="Managed projects"
      description="Private instances adopted by PocketHost. Discovered external services remain read-only."
    >
      <div className="flex flex-col gap-6 px-4 lg:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Badge variant="secondary"><ShieldCheck /> Local managed catalog</Badge>
          <Button variant="outline" disabled={loading} onClick={() => void refresh()}>
            <RefreshCw className={loading ? "animate-spin" : ""} /> Refresh
          </Button>
        </div>
        {error && (
          <Card><CardContent role="alert" className="text-destructive">{error}</CardContent></Card>
        )}
        {owned && (
          <Card>
            <CardHeader>
              <CardTitle>{owned.name}</CardTitle>
              <CardDescription>{owned.description} · {owned.dataDirectory}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center gap-3">
              <Badge variant="secondary">{owned.state}</Badge>
              <Badge variant="outline">Port {owned.port}</Badge>
              <Badge variant="outline">{owned.contentVersion === null ? "Not created" : `Release v${owned.contentVersion}`}</Badge>
              <Button nativeButton={false} render={<Link to="/owned-site" />}>Manage project</Button>
            </CardContent>
          </Card>
        )}
        {ownedError && <p className="text-muted-foreground text-sm">PocketHost demo controls are disabled or unavailable in this session.</p>}
        {!project && !error && <p className="text-muted-foreground">Reading imported project inventory…</p>}
        {project && (
          <>
            <Card>
              <CardHeader>
                <CardTitle>{project.label}</CardTitle>
                <CardDescription>
                  First real imported project · Samsung Termux test instance · no autostart.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-5">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">Ownership: {project.ownership}</Badge>
                  <Badge variant="secondary">Import: {project.importState}</Badge>
                  <Badge variant="outline">Runtime: {project.runtimeState}</Badge>
                  {project.release && <Badge variant="outline">Release: {project.release}</Badge>}
                </div>
                {imported && project.data ? (
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="rounded-lg border p-4">
                      <Database className="text-muted-foreground mb-2 size-5" />
                      <p className="text-2xl font-semibold">
                        {(project.data.databaseBytes / 1048576).toFixed(1)} MiB
                      </p>
                      <p className="text-muted-foreground text-sm">SQLite copy</p>
                    </div>
                    <div className="rounded-lg border p-4">
                      <FolderArchive className="text-muted-foreground mb-2 size-5" />
                      <p className="text-2xl font-semibold">{project.data.privateMediaFiles.toLocaleString()}</p>
                      <p className="text-muted-foreground text-sm">Private media files</p>
                    </div>
                    <div className="rounded-lg border p-4">
                      <HardDrive className="text-muted-foreground mb-2 size-5" />
                      <p className="text-2xl font-semibold">{project.data.publicMediaFiles.toLocaleString()}</p>
                      <p className="text-muted-foreground text-sm">Public media files</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-muted-foreground">
                    No accepted PhotoMap import found. No automatic adoption is attempted.
                  </p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Runtime and dependencies</CardTitle>
                <CardDescription>Capabilities are enabled only after a separate device safety gate.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p>Expected localhost port: <strong>{project.port}</strong>. No public PhotoMap endpoint is opened.</p>
                <p>Python / Debian PRoot: <strong>{project.dependencies?.prootEnvironment ?? "not imported"}</strong>.</p>
                {project.tools.length > 0 && (
                  <div className="rounded-lg border p-4">
                    <p className="font-medium mb-3">Imported tool inventory</p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {project.tools.map((tool) => (
                        <div className="flex justify-between gap-2" key={tool.name}>
                          <span>{tool.name}</span>
                          <span className="text-muted-foreground text-right">{tool.version ?? tool.state}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {project.lockfiles.length > 0 && (
                  <div className="rounded-lg border p-4">
                    <p className="font-medium mb-3">Preserved project dependency locks</p>
                    <div className="space-y-2">
                      {project.lockfiles.map((file) => (
                        <div key={file.path} className="flex flex-col gap-1 sm:flex-row sm:justify-between sm:gap-4">
                          <span className="break-all">{file.path}</span>
                          <code className="text-muted-foreground text-xs" title={file.sha256}>
                            SHA-256 {file.sha256.slice(0, 12)}…
                          </code>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="space-y-3 rounded-lg border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">Legacy runtime events</p>
                      <p className="text-muted-foreground text-xs">
                        Read-only PhotoMap TEST records, separate from system monitoring.
                      </p>
                    </div>
                    <Button variant="outline" disabled={eventsLoading}
                      onClick={() => void inspectEvents()}>
                      {eventsLoading ? "Reading events…" : "Inspect events"}
                    </Button>
                  </div>
                  {eventsError && <p role="alert">{eventsError}</p>}
                  {legacyEvents?.state === "unavailable" && <p>Events unavailable in this session.</p>}
                  {legacyEvents?.state === "ok" && (legacyEvents.events.length === 0
                    ? <p>No structured runtime events.</p>
                    : <ol className="max-h-48 space-y-1 overflow-auto text-xs">
                      {legacyEvents.events.map((event, index) => <li key={event.timestamp + index}
                        className="flex flex-wrap justify-between gap-2 border-b py-1">
                        <span>{event.code}</span>
                        <time>{event.timestamp}</time>
                      </li>)}
                    </ol>)}
                </div>
                <p>Project start / stop: <strong>{project.capabilities.startStop ? "available" : "not enabled"}</strong>.</p>
                <p>Project-scoped package updates: <strong>{project.capabilities.packages ? "available" : "not enabled"}</strong>.</p>
                <p>Full-instance rollback: <strong>{project.capabilities.rollback ? "available" : "not enabled"}</strong>.</p>
                <p className="text-muted-foreground">
                  The imported source and data are preserved. This MVP only inspects the verified
                  registry and manifests; it does not claim a running site or a restorable PRoot image.
                </p>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </BaseLayout>
  )
}
