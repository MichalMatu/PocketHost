import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { formatBytes } from "@/lib/format-memory"
import { formatUptime } from "@/lib/format-uptime"
import type { FleetRelease, FleetSite } from "@/lib/site-fleet-schema"

export function SiteProcessSummary({ site }: { site: FleetSite }) {
  return (
        <dl className="grid gap-4 rounded-lg border p-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div className="min-w-0 space-y-1">
            <dt className="text-xs text-muted-foreground">Active release</dt>
            <dd className="truncate font-mono text-sm font-medium"
              title={site.activeRelease ?? "No release published"}>
              {site.activeRelease ? site.activeRelease.slice(0, 12) + "…" : "Not published"}
            </dd>
          </div>
          <div className="min-w-0 space-y-1">
            <dt className="text-xs text-muted-foreground">Verified process</dt>
            <dd className="font-mono text-sm font-medium tabular-nums">
              {site.pid === null ? "Not running" : "PID " + site.pid}
            </dd>
            {site.startTicks !== null && <dd className="text-xs text-muted-foreground tabular-nums">
              Start ticks: {site.startTicks}
            </dd>}
          </div>
          <div className="min-w-0 space-y-1">
            <dt className="text-xs text-muted-foreground">Process memory</dt>
            <dd className="text-lg font-semibold tabular-nums">
              {site.memoryBytes === null ? "Not measured" : formatBytes(site.memoryBytes)}
            </dd>
            <dd className="text-xs text-muted-foreground">Verified child process</dd>
          </div>
          <div className="min-w-0 space-y-1">
            <dt className="text-xs text-muted-foreground">Uptime</dt>
            <dd className="text-lg font-semibold tabular-nums">
              {site.uptimeSeconds === null ? "Not running" : formatUptime(site.uptimeSeconds)}
            </dd>
            <dd className="text-xs text-muted-foreground">Since process start</dd>
          </div>
        </dl>
  )
}

type VersionProps = {
  site: FleetSite
  versions: FleetRelease[] | null
  busy: boolean
  previewBase: string
  onVersionAction: (release: FleetRelease, action: "restore" | "prune") => void
}

export function SiteVersionHistory({ site, versions, busy, previewBase, onVersionAction }: VersionProps) {
  return (
    <>
        {versions !== null && <section className="space-y-3 rounded-lg border p-4" aria-label={"Saved versions of " + site.name}>
          <div>
            <h3 className="text-sm font-semibold">Saved releases</h3>
            <p className="text-muted-foreground text-xs">Preview, restore or remove saved releases. Active and rollback versions are protected.</p>
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
                  {" · "}{release.fileCount} files{" · "}{formatBytes(release.bytes)}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {site.state === "running" && <a
                  href={previewBase + "__versions/" + release.id + "/"}
                  target="_blank" rel="noopener noreferrer"
                  className="inline-flex rounded-md border px-3 py-2 text-xs font-medium hover:bg-muted"
                >Preview</a>}
                <Button size="sm" variant="outline"
                  disabled={busy || site.state === "unknown" || release.active}
                  onClick={() => onVersionAction(release, "restore")}>Restore</Button>
                <Button size="sm" variant="outline"
                  disabled={busy || site.state === "unknown" || release.active || release.rollbackTarget}
                  onClick={() => onVersionAction(release, "prune")}>Delete archive</Button>
              </div>
            </li>)}
          </ol>
          <p className="text-muted-foreground text-xs">Pre-existing running sites may need a manual Restart once to enable archived preview links. Restore works without a restart.</p>
        </section>}
    </>
  )
}

export function SiteDeploymentHistory({ site }: { site: FleetSite }) {
  return (
    <>
        {site.history.length > 0 && <section className="space-y-2">
          <h3 className="text-sm font-semibold">Deployment history</h3>
          <ol className="max-h-48 space-y-1 overflow-auto text-xs">
            {site.history.map((event, i) => <li key={event.at + i} className="flex flex-wrap justify-between gap-2 border-b py-1">
              <span>{event.action} · {event.from?.slice(0, 11) ?? "new"} → {event.to.slice(0, 11)}</span>
              <time className="text-muted-foreground">{event.at}</time>
            </li>)}
          </ol>
        </section>}
    </>
  )
}
