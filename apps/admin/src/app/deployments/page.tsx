import * as React from "react"
import { Link } from "react-router-dom"
import { BaseLayout } from "@/components/layouts/base-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { parseOwnedProject, type OwnedProject } from "@/lib/owned-project-schema"

export default function DeploymentsPage() {
  const [project, setProject] = React.useState<OwnedProject | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(true)
  const refresh = React.useCallback(async (signal?: AbortSignal) => {
    const response = await fetch("/api/v1/owned-site/project", {
      cache: "no-store", credentials: "same-origin", signal,
    })
    if (!response.ok) throw new Error("Deployment history unavailable or disabled")
    const data = parseOwnedProject(await response.json())
    if (!signal?.aborted) { setProject(data); setError(null) }
  }, [])
  React.useEffect(() => {
    const controller = new AbortController()
    void Promise.resolve().then(() => refresh(controller.signal))
      .catch(() => { if (!controller.signal.aborted) setError("Owned deployment history is unavailable.") })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [refresh])
  return (
    <BaseLayout title="Deployments" description="Actual, bounded release history of the registered PocketHost demo.">
      <div className="space-y-4 px-4 pb-8 lg:px-6">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" disabled={loading} onClick={() => {
            setLoading(true)
            void refresh().catch(() => setError("Could not refresh releases.")).finally(() => setLoading(false))
          }}>Refresh history</Button>
          <Link className="text-sm underline" to="/owned-site">Publish or rollback a release</Link>
        </div>
        {loading && <p role="status">Reading deployment journal…</p>}
        {error && <p role="alert" className="text-destructive text-sm">{error}</p>}
        {project && <Card>
          <CardHeader>
            <CardTitle>{project.name}</CardTitle>
            <CardDescription>Active: {project.contentVersion === null ? "not created" : `v${project.contentVersion}`} · Previous: {project.previousVersion === null ? "none" : `v${project.previousVersion}`}</CardDescription>
          </CardHeader>
          <CardContent>
            {project.history.length === 0 ? <p className="text-muted-foreground text-sm">No journal entries. Older deployments are not fabricated.</p> : (
              <ol className="space-y-3 text-sm">
                {project.history.map((entry, i) => (
                  <li key={entry.at + i} className="flex flex-wrap justify-between gap-2 border-b pb-2">
                    <span>{entry.action}: {entry.from === null ? "new project" : `v${entry.from}`} → v{entry.to}</span>
                    <time className="text-muted-foreground">{entry.at}</time>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>}
      </div>
    </BaseLayout>
  )
}
