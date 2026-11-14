import * as React from "react"
import { Link } from "react-router-dom"
import { RefreshCw, ShieldCheck } from "lucide-react"
import { BaseLayout } from "@/components/layouts/base-layout"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  parseManagedPhotoMapResponse, parseLegacyPhotoMapEvents,
  type ManagedPhotoMapProject, type LegacyPhotoMapEventResponse,
} from "@/lib/managed-photomap-schema"

export default function PhotoMapServicePage() {
  const [project, setProject] = React.useState<ManagedPhotoMapProject | null>(null)
  const [events, setEvents] = React.useState<LegacyPhotoMapEventResponse | null>(null)
  const [revision, setRevision] = React.useState(0)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState(false)
  const [eventError, setEventError] = React.useState(false)
  const [eventLoading, setEventLoading] = React.useState(false)

  React.useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError(false)
    void fetch("/api/v1/managed-photomap", {
      method: "GET", credentials: "same-origin", cache: "no-store", signal: controller.signal,
    }).then(async response => {
      if (!response.ok) throw Error("unavailable")
      return parseManagedPhotoMapResponse(await response.json() as unknown)
    }).then(data => {
      if (!controller.signal.aborted) setProject(data)
    }).catch(() => {
      if (!controller.signal.aborted) { setProject(null); setError(true) }
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false)
    })
    return () => controller.abort()
  }, [revision])

  async function inspectEvents() {
    if (eventLoading) return
    setEventLoading(true)
    setEventError(false)
    try {
      const response = await fetch("/api/v1/managed-photomap/events", {
        method: "GET", credentials: "same-origin", cache: "no-store",
      })
      if (!response.ok) throw Error("unavailable")
      setEvents(parseLegacyPhotoMapEvents(await response.json() as unknown))
    } catch {
      setEvents(null)
      setEventError(true)
    } finally {
      setEventLoading(false)
    }
  }

  const imported = project?.ownership === "pockethost" &&
    project.importState === "verified-copy"

  return <BaseLayout title="PhotoMap TEST" description="Independent read-only service workspace">
    <div className="space-y-4 px-4 pb-8 lg:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="gap-1">
            <ShieldCheck className="size-3" />TEST · read-only
          </Badge>
          <Link to="/services" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
            All services
          </Link>
        </div>
        <Button variant="outline" disabled={loading} onClick={() => {
          setEvents(null)
          setEventError(false)
          setRevision(value => value + 1)
        }}>
          <RefreshCw className={loading ? "size-4 animate-spin" : "size-4"} />Refresh
        </Button>
      </div>
      {loading && <p role="status">Reading PhotoMap TEST inventory…</p>}
      {error && <p role="alert">PhotoMap TEST inventory unavailable. No changes were made.</p>}
      {project && <Card>
        <CardHeader><CardTitle className="text-base">{project.label}</CardTitle></CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="grid gap-3 sm:grid-cols-3">
            <div><p className="text-xs text-muted-foreground">Ownership</p>
              <p>{project.ownership}</p></div>
            <div><p className="text-xs text-muted-foreground">Import</p>
              <p>{project.importState}</p></div>
            <div><p className="text-xs text-muted-foreground">Runtime</p>
              <p>{project.runtimeState} · live health unverified</p></div>
          </div>
          {project.release && <p>Registered release: {project.release}</p>}
          {imported && project.data && <div className="space-y-1 rounded-lg border p-3">
            <h3 className="font-medium">Verified imported copy</h3>
            <p>SQLite: {(project.data.databaseBytes / 1048576).toFixed(1)} MiB</p>
            <p>Private media: {project.data.privateMediaFiles.toLocaleString()} files</p>
            <p>Public media: {project.data.publicMediaFiles.toLocaleString()} files</p>
          </div>}
          {!imported && <p className="text-muted-foreground">
            No verified PocketHost-owned copy. The external process has not been adopted.
          </p>}
          <div className="space-y-2 rounded-lg border p-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="font-medium">Sanitized runtime events</h3>
              <Button size="sm" variant="outline" disabled={eventLoading}
                onClick={() => void inspectEvents()}>
                {eventLoading ? "Reading…" : "Inspect events"}
              </Button>
            </div>
            {eventError && <p role="alert">Events unavailable.</p>}
            {events?.state === "unavailable" && <p>Events unavailable.</p>}
            {events?.state === "ok" && (events.events.length === 0
              ? <p>No recorded events.</p>
              : <ul className="space-y-1 text-xs">{events.events.map((event, i) =>
                <li key={event.timestamp + i} className="flex justify-between gap-2">
                  <span>{event.code}</span><time>{event.timestamp}</time>
                </li>)}</ul>)}
          </div>
          <p className="text-xs text-muted-foreground">
            Start, stop, package changes and rollback are not enabled for PhotoMap TEST.
          </p>
        </CardContent>
      </Card>}
    </div>
  </BaseLayout>
}
