import { Button } from "@/components/ui/button"
import type { Candidate } from "./node-project-client"
import { releaseRole, shortRelease } from "./node-project-display"

type Props = {
  releases: Candidate[]
  loading: boolean
  error: boolean
  checked: boolean
  busy: boolean
  activeRelease: string | null | undefined
  running: boolean
  onRefresh: () => void
}

/** Releases are read-only here; the parent owns fetches and selection state. */
export function NodeReleaseInventory({
  releases, loading, error, checked, busy, activeRelease, running, onRefresh,
}: Props) {
  return (
    <section id="node-candidates" aria-label="Source candidates" className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Releases</h3>
        <Button size="sm" variant="outline" disabled={busy || loading}
          onClick={() => onRefresh()}>Refresh releases</Button>
      </div>
      {loading && <p role="status" className="text-xs text-muted-foreground">
        Reading releases for selected Node project…
      </p>}
      {error && <div className="flex flex-wrap items-center gap-3">
        <p role="alert" className="text-xs text-destructive">
          Could not read source releases for this project.
        </p>
        <Button variant="outline" size="sm" disabled={busy}
          onClick={() => onRefresh()}>Retry releases</Button>
      </div>}
      {!loading && !error && checked && releases.length === 0 &&
        <p role="status" className="text-xs text-muted-foreground">
          No source releases yet. Stage project source to prepare the first version.
        </p>}
      {!loading && !error && !checked &&
        <p className="text-xs text-muted-foreground">Releases not checked yet.</p>}
      <div className="space-y-2 text-sm">
        {releases.map(release => <div key={release.id} className="rounded-md border px-3 py-2">
          <details>
            <summary className="cursor-pointer">
              <span className="font-medium">{releaseRole(release, activeRelease, running)}</span>
              <span className="ml-2 text-xs text-muted-foreground" title={release.id}>{shortRelease(release.id)}</span>
            </summary>
            <p className="mt-2 text-xs text-muted-foreground">
              {release.dependencyPlan.packageName}@{release.dependencyPlan.packageVersion} · {release.dependencyPlan.dependencyCount} dependencies
            </p>
          </details>
          {release.sourceIntegrity === "legacy-needs-restaging" &&
            <p className="mt-1 text-xs text-destructive">Restaging required before use.</p>}
        </div>)}
      </div>
    </section>
  )
}
