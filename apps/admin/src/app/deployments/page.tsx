import * as React from "react"
import { Link } from "react-router-dom"
import { BaseLayout } from "@/components/layouts/base-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { parseOwnedProject, type OwnedProject } from "@/lib/owned-project-schema"
import { readNodeRuntimeCatalog, type NodeRuntimeEntry } from "@/lib/node-hosting-client"

export default function DeploymentsPage() {
  const [project, setProject] = React.useState<OwnedProject | null>(null)
  const [demoEnabled, setDemoEnabled] = React.useState<boolean | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [nodeLoading, setNodeLoading] = React.useState(true)
  const [nodeProjects, setNodeProjects] = React.useState<NodeRuntimeEntry[]>([])
  const [nodeEnabled, setNodeEnabled] = React.useState<boolean | null>(null)
  const [nodeError, setNodeError] = React.useState<string | null>(null)
  const refresh = React.useCallback(async (signal?: AbortSignal) => {
    const response = await fetch("/api/v1/owned-site/project", {
      cache: "no-store", credentials: "same-origin", signal,
    })
    if (response.status === 404) {
      if (!signal?.aborted) { setProject(null); setDemoEnabled(false); setError(null) }
      return
    }
    if (!response.ok) throw new Error("Deployment history unavailable")
    const data = parseOwnedProject(await response.json())
    if (!signal?.aborted) { setProject(data); setDemoEnabled(true); setError(null) }
  }, [])
  const refreshNodes = React.useCallback(async (signal?: AbortSignal) => {
    const report = await readNodeRuntimeCatalog(signal)
    if (!signal?.aborted) {
      setNodeEnabled(report.enabled)
      setNodeProjects(report.projects)
      setNodeError(null)
    }
  }, [])
  React.useEffect(() => {
    const controller = new AbortController()
    void Promise.resolve().then(() => refreshNodes(controller.signal))
      .catch(() => {
        if (!controller.signal.aborted) setNodeError("Owned Node deployment history unavailable.")
      })
      .finally(() => { if (!controller.signal.aborted) setNodeLoading(false) })
    return () => controller.abort()
  }, [refreshNodes])
  React.useEffect(() => {
    const controller = new AbortController()
    void Promise.resolve().then(() => refresh(controller.signal))
      .catch(() => { if (!controller.signal.aborted) setError("Owned deployment history is unavailable.") })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [refresh])
  return (
    <BaseLayout title="Deployments" description="Release history of explicitly managed PocketHost projects">
      <div className="space-y-4 px-4 pb-8 lg:px-6">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" disabled={loading || nodeLoading} onClick={() => {
            setLoading(true); setNodeLoading(true)
            void Promise.allSettled([refresh(), refreshNodes()]).then(([demo, node]) => {
              if (demo.status === "rejected") setError("Could not refresh demo releases.")
              if (node.status === "rejected") setNodeError("Could not refresh Node deployments.")
            }).finally(() => { setLoading(false); setNodeLoading(false) })
          }}>Refresh</Button>
          {demoEnabled && <Link className="text-sm underline" to="/owned-site">Open demo release</Link>}
        </div>
        {loading && <p role="status">Reading deployment journal…</p>}
        {error && <p role="alert" className="text-destructive text-sm">{error}</p>}
        {demoEnabled === false && <p className="text-sm text-muted-foreground">
          Optional demo deployment history is not configured.
        </p>}
        <Card>
          <CardHeader>
            <CardTitle>Node.js deployments</CardTitle>
            <CardDescription>Only user-created Node projects and verified release journals.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">

              <Link to="/projects" className="text-sm underline">Manage Node projects</Link>
            </div>
            {nodeLoading && <p role="status">Reading Node deployment journal…</p>}
            {nodeError && <p role="alert" className="text-destructive text-sm">{nodeError}</p>}
            {nodeEnabled === false && <p className="text-muted-foreground text-sm">Node Hosting is disabled; no Node release history is available.</p>}
            {nodeEnabled && nodeProjects.length === 0 && <p className="text-muted-foreground text-sm">No user-created Node projects yet.</p>}
            {nodeProjects.map((node) => (
              <section className="rounded-md border p-3" key={node.id}>
                <p className="text-sm font-medium">{node.name}</p>
                <p className="text-muted-foreground text-xs">Observed: {node.state} · Active: {node.activeRelease ?? "none"} · Previous good: {node.previousGoodRelease ?? "none"}</p>
                {node.history.length > 0
                  ? <ol className="mt-2 space-y-1 text-xs">
                      {node.history.slice().reverse().map((entry, i) => (
                        <li key={entry.at + i}>{entry.at} · {entry.action} · {entry.release}</li>
                      ))}
                    </ol>
                  : <p className="mt-2 text-muted-foreground text-xs">No verified runtime deployments.</p>}
              </section>
            ))}
          </CardContent>
        </Card>
        {project && <Card>
          <CardHeader>
            <CardTitle>{project.name}</CardTitle>
            <CardDescription>Active: {project.contentVersion === null ? "not created" : `v${project.contentVersion}`} · Previous: {project.previousVersion === null ? "none" : `v${project.previousVersion}`}</CardDescription>
          </CardHeader>
          <CardContent>
            {project.history.length === 0 ? <p className="text-muted-foreground text-sm">No journal entries. Older deployments are not fabricated.</p> : (
              <ol className="space-y-3 text-sm">
                {project.history.map((entry, i) => (
                  <li key={entry.at + i} className="flex flex-wrap justify-between gap-2 border-b pb-2 last:border-b-0 last:pb-0">
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
