import * as React from "react"
import { Link } from "react-router-dom"
import { BaseLayout } from "@/components/layouts/base-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { parseFleetSites, type FleetSite } from "@/lib/site-fleet-schema"
import { readNodeRuntimeCatalog, type NodeRuntimeEntry } from "@/lib/node-hosting-client"

type CatalogState = "loading" | "ready" | "disabled" | "error"

export default function DeploymentsPage() {
  const [sites, setSites] = React.useState<FleetSite[]>([])
  const [staticState, setStaticState] = React.useState<CatalogState>("loading")
  const [staticError, setStaticError] = React.useState<string | null>(null)
  const [nodeProjects, setNodeProjects] = React.useState<NodeRuntimeEntry[]>([])
  const [nodeState, setNodeState] = React.useState<CatalogState>("loading")
  const [nodeError, setNodeError] = React.useState<string | null>(null)

  const loadSites = React.useCallback(async (signal?: AbortSignal) => {
    setStaticState("loading")
    setStaticError(null)
    try {
      const response = await fetch("/api/v1/sites", {
        cache: "no-store", credentials: "same-origin", signal,
      })
      if (signal?.aborted) return
      if (response.status === 404) {
        setSites([])
        setStaticState("disabled")
        return
      }
      if (response.status === 403) throw new Error("Static hosting access denied.")
      if (!response.ok) throw new Error("Could not load static deployments.")
      let items: FleetSite[]
      try {
        items = parseFleetSites(await response.json())
      } catch {
        throw new Error("Invalid static site inventory.")
      }
      if (!signal?.aborted) {
        setSites(items)
        setStaticState("ready")
      }
    } catch (cause) {
      if (!signal?.aborted) {
        setSites([])
        setStaticState("error")
        setStaticError(cause instanceof Error ? cause.message : "Could not load static deployments.")
      }
    }
  }, [])

  const loadNodes = React.useCallback(async (signal?: AbortSignal) => {
    setNodeState("loading")
    setNodeError(null)
    try {
      const report = await readNodeRuntimeCatalog(signal)
      if (!signal?.aborted) {
        setNodeProjects(report.projects)
        setNodeState(report.enabled ? "ready" : "disabled")
      }
    } catch {
      if (!signal?.aborted) {
        setNodeProjects([])
        setNodeState("error")
        setNodeError("Could not load Node deployments.")
      }
    }
  }, [])

  React.useEffect(() => {
    const controller = new AbortController()
    void loadSites(controller.signal)
    void loadNodes(controller.signal)
    return () => controller.abort()
  }, [loadSites, loadNodes])

  return (
    <BaseLayout title="Deployments" description="Deployment history for your hosted projects.">
      <div className="space-y-4 px-4 pb-8 lg:px-6">
        <Button variant="outline" disabled={staticState === "loading" || nodeState === "loading"}
          onClick={() => { void loadSites(); void loadNodes() }}>Refresh</Button>
        <Card>
          <CardHeader>
            <CardTitle>Static sites</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Link to="/sites" className="text-sm underline">Manage static sites</Link>
            {staticState === "loading" && <p role="status">Loading static deployments…</p>}
            {staticState === "disabled" && <p role="status" className="text-muted-foreground text-sm">
              Static hosting is not enabled on this panel.
            </p>}
            {staticError && <p role="alert" className="text-destructive text-sm">{staticError}</p>}
            {staticState === "ready" && sites.length === 0 &&
              <p className="text-muted-foreground text-sm">No static sites yet.</p>}
            {staticState === "ready" && sites.map(site => (
              <section className="rounded-md border p-3" key={site.id}>
                <p className="text-sm font-medium">{site.name}</p>
                <p className="text-muted-foreground text-xs">
                  {site.state} · Active: {site.activeRelease ?? "none"} · {site.releases} releases
                </p>
                {site.history.length > 0
                  ? <ol className="mt-2 space-y-1 text-xs">
                      {site.history.slice().reverse().map((entry, i) => (
                        <li key={entry.at + i}>{entry.at} · {entry.action} · {entry.to}</li>
                      ))}
                    </ol>
                  : <p className="mt-2 text-muted-foreground text-xs">No deployments yet.</p>}
              </section>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Node.js applications</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Link to="/projects" className="text-sm underline">Manage Node projects</Link>
            {nodeState === "loading" && <p role="status">Loading Node deployments…</p>}
            {nodeState === "disabled" && <p role="status" className="text-muted-foreground text-sm">
              Node Hosting is not enabled on this panel.
            </p>}
            {nodeError && <p role="alert" className="text-destructive text-sm">{nodeError}</p>}
            {nodeState === "ready" && nodeProjects.length === 0 &&
              <p className="text-muted-foreground text-sm">No Node projects yet.</p>}
            {nodeState === "ready" && nodeProjects.map(node => (
              <section className="rounded-md border p-3" key={node.id}>
                <p className="text-sm font-medium">{node.name}</p>
                <p className="text-muted-foreground text-xs">
                  {node.state} · Active: {node.activeRelease ?? "none"} · Previous: {node.previousGoodRelease ?? "none"}
                </p>
                {node.history.length > 0
                  ? <ol className="mt-2 space-y-1 text-xs">
                      {node.history.slice().reverse().map((entry, i) => (
                        <li key={entry.at + i}>{entry.at} · {entry.action} · {entry.release}</li>
                      ))}
                    </ol>
                  : <p className="mt-2 text-muted-foreground text-xs">No deployments yet.</p>}
              </section>
            ))}
          </CardContent>
        </Card>
      </div>
    </BaseLayout>
  )
}
