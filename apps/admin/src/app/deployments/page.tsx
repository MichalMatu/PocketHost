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
    setSites([])
    setStaticState("loading")
    setStaticError(null)
    try {
      const response = await fetch("/api/v1/sites", {
        cache: "no-store", credentials: "same-origin", signal,
      })
      if (signal?.aborted) return
      if (response.status === 404) {
        setStaticState("disabled")
        return
      }
      if (response.status === 403) throw new Error("Static hosting access denied.")
      if (!response.ok) throw new Error("Could not load static deployments.")
      let items: FleetSite[]
      try { items = parseFleetSites(await response.json()) }
      catch { throw new Error("Invalid static site inventory.") }
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
    setNodeProjects([])
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
        setNodeError("Could not load verified Node deployments.")
      }
    }
  }, [])

  React.useEffect(() => {
    const controller = new AbortController()
    void Promise.resolve().then(() => {
      if (controller.signal.aborted) return
      void loadSites(controller.signal)
      void loadNodes(controller.signal)
    })
    return () => controller.abort()
  }, [loadSites, loadNodes])

  return (
    <BaseLayout title="Deployments" description="Current releases and real deployment events for owned projects">
      <div className="space-y-4 px-4 pb-8 lg:px-6">
        <Button variant="outline" disabled={staticState === "loading" || nodeState === "loading"}
          onClick={() => { void loadSites(); void loadNodes() }}>Refresh deployments</Button>
        <Card>
          <CardHeader><CardTitle>Static sites</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Link to="/sites" className="text-sm underline">Manage static sites</Link>
            {staticState === "loading" && <p role="status">Loading static deployments…</p>}
            {staticState === "disabled" && <p role="status" className="text-muted-foreground text-sm">
              Static hosting is not enabled on this panel.
            </p>}
            {staticError && <p role="alert" className="text-destructive text-sm">{staticError}</p>}
            {staticState === "ready" && sites.length === 0 &&
              <p className="text-muted-foreground text-sm">No static sites yet.</p>}
            {staticState === "ready" && sites.map(site => {
              // SiteFleetHost.inspect returns history newest first.
              const latest = site.history[0]
              return <section className="rounded-md border p-3 space-y-2" key={site.id}>
                <p className="text-sm font-semibold">{site.name}</p>
                <p className="text-muted-foreground text-xs">
                  Static HTML · State: {site.state} · Active: {site.activeRelease ?? "none"} ·
                  Previous: {site.previousRelease ?? "none"} · Saved releases: {site.releases}
                </p>
                <p className="text-muted-foreground text-xs">
                  Last operation: {latest ? latest.action + " · " + latest.at : "No deployment recorded"}
                </p>
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <Link className="underline" to="/sites">Manage {site.name} in Sites</Link>
                  <Link className="underline" to={"/runtime-logs?project=" + encodeURIComponent("static:" + site.id)}>Read project logs</Link>
                  {site.canRollback && site.state !== "unknown"
                    ? <span className="text-muted-foreground text-xs">
                        Rollback target saved — review and execute in Sites
                      </span>
                    : <span className="text-muted-foreground text-xs">
                        {site.state === "unknown" ? "Runtime unverified; rollback not offered" : "No rollback target"}
                      </span>}
                </div>
                {site.history.length > 0
                  ? <ol className="max-h-44 overflow-auto space-y-1 text-xs" aria-label={"Deployment history for " + site.name}>
                      {site.history.slice(0, 8).map((entry, i) => (
                        <li key={entry.at + i}>{entry.at} · {entry.action} ·
                          {entry.from ?? "new"} → {entry.to}</li>
                      ))}
                    </ol>
                  : <p className="text-muted-foreground text-xs">No deployment history.</p>}
              </section>
            })}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Node.js applications</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Link to="/projects" className="text-sm underline">Manage Node projects</Link>
            {nodeState === "loading" && <p role="status">Loading Node deployments…</p>}
            {nodeState === "disabled" && <p role="status" className="text-muted-foreground text-sm">
              Node Hosting is not enabled on this panel.
            </p>}
            {nodeError && <p role="alert" className="text-destructive text-sm">{nodeError}</p>}
            {nodeState === "ready" && nodeProjects.length === 0 &&
              <p className="text-muted-foreground text-sm">No Node projects yet.</p>}
            {nodeState === "ready" && nodeProjects.map(node => {
              const latest = node.history[node.history.length - 1]
              const projectUrl = "/projects?project=" + encodeURIComponent(node.id)
              return <section className="rounded-md border p-3 space-y-2" key={node.id}>
                <p className="text-sm font-semibold">{node.name}</p>
                <p className="text-muted-foreground text-xs">
                  Node.js · State: {node.state} · Desired: {node.desired} ·
                  Active: {node.activeRelease ?? "none"} · Previous good: {node.previousGoodRelease ?? "none"}
                </p>
                <p className="text-muted-foreground text-xs">
                  Last operation: {latest ? latest.action + " · " + latest.at : "No deployment recorded"}
                </p>
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <Link className="underline" to={projectUrl}>Open {node.name}</Link>
                  <Link className="underline" to={"/runtime-logs?project=" + encodeURIComponent("node:" + node.id)}>Read project logs</Link>
                  {node.previousGoodRelease && node.state !== "unknown"
                    ? <Link className="underline" to={projectUrl}>Review rollback in project</Link>
                    : <span className="text-muted-foreground text-xs">
                        {node.state === "unknown" ? "Runtime unverified; rollback not offered" : "No previous good release"}
                      </span>}
                </div>
                {node.history.length > 0
                  ? <ol className="max-h-44 overflow-auto space-y-1 text-xs" aria-label={"Deployment history for " + node.name}>
                      {node.history.slice(-8).reverse().map((entry, i) => (
                        <li key={entry.at + i}>{entry.at} · {entry.action} · {entry.release}</li>
                      ))}
                    </ol>
                  : <p className="text-muted-foreground text-xs">No deployment history.</p>}
              </section>
            })}
          </CardContent>
        </Card>
      </div>
    </BaseLayout>
  )
}
