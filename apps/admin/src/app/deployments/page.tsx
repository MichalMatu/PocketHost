import { siteDetailPath } from "@/app/sites/site-route"
import * as React from "react"
import { Link } from "react-router-dom"
import { StandardPageLayout, pageActionClass } from "@/components/layouts/standard-page-layout"
import { Badge } from "@/components/ui/badge"
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { buttonVariants } from "@/components/ui/button"
import { parseFleetSites, type FleetSite } from "@/lib/site-fleet-schema"
import { readNodeRuntimeCatalog, type NodeRuntimeEntry } from "@/lib/node-hosting-client"

type CatalogState = "loading" | "ready" | "disabled" | "error"

function readSignal(signal?: AbortSignal): AbortSignal {
  const timeout = AbortSignal.timeout(10_000)
  return signal ? AbortSignal.any([signal, timeout]) : timeout
}

function shortRelease(id: string | null): string {
  return id ? id.slice(0, 12) + "…" : "none"
}

function localTime(value: string): string {
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? new Date(parsed).toLocaleString() : value
}

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
        cache: "no-store", credentials: "same-origin", signal: readSignal(signal),
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
      const report = await readNodeRuntimeCatalog(readSignal(signal))
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
    <StandardPageLayout title="Deployments" refreshDisabled={staticState === "loading" || nodeState === "loading"}
      onRefresh={() => { void loadSites(); void loadNodes() }}>
        <Card>
          <CardHeader>
            <CardTitle><h2>Static sites</h2></CardTitle>
            <CardAction><Link to="/sites" aria-label="Manage static sites" className={buttonVariants({ variant: "outline", className: pageActionClass })}>Manage</Link></CardAction>
          </CardHeader>
          <CardContent className="divide-y">
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
              return <section className="space-y-3 py-4 first:pt-0 last:pb-0" key={site.id}>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="min-w-0 break-words text-base font-semibold">{site.name}</h3>
                  <Badge variant={site.state === "unknown" ? "destructive" : site.state === "running" ? "secondary" : "outline"}>{site.state}</Badge>
                </div>
                <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                  <span>{site.activeRelease ? "Active release" : "No active release"}</span>
                  <span>Saved releases: {site.releases}</span>
                </p>
                <p className="text-muted-foreground text-sm">
                  Last operation: {latest ? latest.action + " · " + localTime(latest.at) : "No deployment recorded"}
                </p>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <Link className={buttonVariants({ variant: "secondary" })} to={siteDetailPath(site.id)}>Open site settings</Link>
                  <Link className={buttonVariants({ variant: "ghost" })} to={"/runtime-logs?project=" + encodeURIComponent("static:" + site.id)}>Logs</Link>
                  {site.state === "unknown"
                    ? <span className="text-muted-foreground text-xs">Runtime unverified; rollback unavailable</span>
                    : site.canRollback
                      ? <span className="text-muted-foreground text-xs">Rollback available in Sites</span>
                      : null}
                </div>
                <details className="border-t pt-2 text-sm">
                      <summary className="cursor-pointer rounded py-2 font-medium focus-visible:outline-2 focus-visible:outline-ring">{site.history.length > 0 ? "Deployment history (" + site.history.length + ")" : "Release details"}</summary>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 py-2 text-sm text-muted-foreground">
                        <span title={site.activeRelease ?? undefined}>Active: {shortRelease(site.activeRelease)}</span>
                        <span title={site.previousRelease ?? undefined}>Previous: {shortRelease(site.previousRelease)}</span>
                      </div>
                      {site.history.length > 0 ? <ol className="mt-2 max-h-44 overflow-auto space-y-1" aria-label={"Deployment history for " + site.name}>
                        {site.history.slice(0, 8).map((entry, i) => (
                          <li key={entry.at + i}>
                            <span className="text-muted-foreground">{localTime(entry.at)}</span> · {entry.action} ·
                            <span title={entry.from ?? undefined}> {entry.from ? shortRelease(entry.from) : "new"}</span>
                            {" → "}<span title={entry.to}>{shortRelease(entry.to)}</span>
                          </li>
                        ))}
                      </ol> : <p className="text-muted-foreground text-sm">No deployment history.</p>}
                </details>
              </section>
            })}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle><h2>Node.js applications</h2></CardTitle>
            <CardAction><Link to="/projects" aria-label="Manage Node projects" className={buttonVariants({ variant: "outline", className: pageActionClass })}>Manage</Link></CardAction>
          </CardHeader>
          <CardContent className="divide-y">
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
              return <section className="space-y-3 py-4 first:pt-0 last:pb-0" key={node.id}>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="min-w-0 break-words text-base font-semibold">{node.name}</h3>
                  <Badge variant={node.state === "unknown" ? "destructive" : node.state === "running" ? "secondary" : "outline"}>{node.state}</Badge>
                </div>
                <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                  <span>{node.activeRelease ? "Active release" : "No active release"}</span>
                  {node.state !== node.desired && <span>Desired: {node.desired}</span>}
                </p>
                <p className="text-muted-foreground text-sm">
                  Last operation: {latest ? latest.action + " · " + localTime(latest.at) : "No deployment recorded"}
                </p>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <Link className={buttonVariants({ variant: "secondary" })} to={projectUrl}>Open project</Link>
                  <Link className={buttonVariants({ variant: "ghost" })} to={"/runtime-logs?project=" + encodeURIComponent("node:" + node.id)}>Logs</Link>
                  {node.state === "unknown"
                    ? <span className="text-muted-foreground text-xs">Runtime unverified; rollback unavailable</span>
                    : node.previousGoodRelease
                      ? <Link className={buttonVariants({ variant: "outline" })} to={projectUrl}>Review rollback in project</Link>
                      : null}
                </div>
                <details className="border-t pt-2 text-sm">
                      <summary className="cursor-pointer rounded py-2 font-medium focus-visible:outline-2 focus-visible:outline-ring">{node.history.length > 0 ? "Deployment history (" + node.history.length + ")" : "Release details"}</summary>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 py-2 text-sm text-muted-foreground">
                        <span title={node.activeRelease ?? undefined}>Active: {shortRelease(node.activeRelease)}</span>
                        <span title={node.previousGoodRelease ?? undefined}>Previous good: {shortRelease(node.previousGoodRelease)}</span>
                        <span>Desired: {node.desired}</span>
                      </div>
                      {node.history.length > 0 ? <ol className="mt-2 max-h-44 overflow-auto space-y-1" aria-label={"Deployment history for " + node.name}>
                        {node.history.slice(-8).reverse().map((entry, i) => (
                          <li key={entry.at + i}>
                            <span className="text-muted-foreground">{localTime(entry.at)}</span> · {entry.action} ·
                            <span title={entry.release}> {shortRelease(entry.release)}</span>
                          </li>
                        ))}
                      </ol> : <p className="text-muted-foreground text-sm">No deployment history.</p>}
                </details>
              </section>
            })}
          </CardContent>
        </Card>
    </StandardPageLayout>
  )
}
