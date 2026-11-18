import * as React from "react"
import { Link } from "react-router-dom"

import { BaseLayout } from "@/components/layouts/base-layout"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { readNodeRuntimeCatalog, readNodeHealth, type NodeRuntimeEntry } from "@/lib/node-hosting-client"
import { parseFleetSites, type FleetSite } from "@/lib/site-fleet-schema"

type InventoryStatus = "loading" | "enabled" | "disabled" | "unavailable"
type Inventory<T> = { status: InventoryStatus; items: T[] }
type Readiness = "checking" | "ready" | "not-ready" | "not-probed" | "unavailable"

const loadingSites: Inventory<FleetSite> = { status: "loading", items: [] }
const loadingNodes: Inventory<NodeRuntimeEntry> = { status: "loading", items: [] }

async function readStaticHosting(signal: AbortSignal): Promise<Inventory<FleetSite>> {
  const response = await fetch("/api/v1/sites", {
    credentials: "same-origin", cache: "no-store", signal,
  })
  if (response.status === 404) return { status: "disabled", items: [] }
  if (!response.ok) throw new Error("Static hosting inventory unavailable")
  return { status: "enabled", items: parseFleetSites(await response.json()) }
}

async function readNodeHosting(signal: AbortSignal): Promise<Inventory<NodeRuntimeEntry>> {
  // Shared read-only contract also used by Deployments; runtime is needed for real state.
  const catalog = await readNodeRuntimeCatalog(signal)
  return { status: catalog.enabled ? "enabled" : "disabled", items: catalog.projects }
}

function statusText<T extends { state: string }>(inventory: Inventory<T>): string {
  if (inventory.status === "loading") return "Checking live inventory…"
  if (inventory.status === "disabled") return "Not enabled on this panel"
  if (inventory.status === "unavailable") return "Status unavailable — retry Refresh"
  const running = inventory.items.filter(item => item.state === "running").length
  const unknown = inventory.items.filter(item => item.state === "unknown").length
  return `${running} running · ${inventory.items.length} total${unknown ? ` · ${unknown} unknown` : ""}`
}

function releaseLabel(release: string | null): string {
  return release ? release.slice(0, 12) + "…" : "None published"
}

export default function HostingPage() {
  const [staticInventory, setStaticInventory] = React.useState<Inventory<FleetSite>>(loadingSites)
  const [nodeInventory, setNodeInventory] = React.useState<Inventory<NodeRuntimeEntry>>(loadingNodes)
  const [generation, setGeneration] = React.useState(0)
  const [readiness, setReadiness] = React.useState<Record<string, Readiness>>({})
  const checks = React.useRef(new Map<string, AbortController>())

  React.useEffect(() => {
    const pending = checks.current
    return () => {
      for (const controller of pending.values()) controller.abort()
      pending.clear()
    }
  }, [])

  const checkReadiness = async (project: NodeRuntimeEntry) => {
    const controller = new AbortController()
    checks.current.get(project.id)?.abort()
    checks.current.set(project.id, controller)
    setReadiness(prev => ({ ...prev, [project.id]: "checking" }))
    try {
      const health = await readNodeHealth(project.id, controller.signal)
      if (controller.signal.aborted) return
      // Never show ready based on a release other than the inventory's active release.
      const status: Readiness = health.ready === true
        ? health.release === project.activeRelease && health.state === "running"
          ? "ready" : "unavailable"
        : health.ready === false ? "not-ready" : "not-probed"
      setReadiness(prev => ({ ...prev, [project.id]: status }))
    } catch {
      if (!controller.signal.aborted)
        setReadiness(prev => ({ ...prev, [project.id]: "unavailable" }))
    } finally {
      if (checks.current.get(project.id) === controller) checks.current.delete(project.id)
    }
  }

  React.useEffect(() => {
    const controller = new AbortController()
    // Invalidate prior inventory when Refresh starts, without an effect-time sync setState.
    void Promise.resolve().then(() => {
      if (controller.signal.aborted) return
      setStaticInventory(loadingSites)
      setNodeInventory(loadingNodes)
    })
    void readStaticHosting(controller.signal)
      .then(value => { if (!controller.signal.aborted) setStaticInventory(value) })
      .catch(() => {
        if (!controller.signal.aborted) setStaticInventory({ status: "unavailable", items: [] })
      })
    void readNodeHosting(controller.signal)
      .then(value => { if (!controller.signal.aborted) setNodeInventory(value) })
      .catch(() => {
        if (!controller.signal.aborted) setNodeInventory({ status: "unavailable", items: [] })
      })
    return () => controller.abort()
  }, [generation])

  return (
    <BaseLayout title="Hosting" description="Manage websites and Node.js applications hosted on this device.">
      <div className="space-y-5 px-4 pb-8 lg:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            Current inventory from PocketHost-owned hosting APIs. Refresh after publishing or changing a runtime.
          </p>
          <Button size="sm" variant="outline" onClick={() => {
              for (const controller of checks.current.values()) controller.abort()
              checks.current.clear()
              setReadiness({})
              setGeneration(value => value + 1)
            }}
            disabled={staticInventory.status === "loading" || nodeInventory.status === "loading"}>
            Refresh
          </Button>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Static Hosting</CardTitle>
              <CardDescription>HTML websites and prebuilt frontend files.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p role="status" aria-busy={staticInventory.status === "loading"} className="text-sm">
                Static hosting: {statusText(staticInventory)}
              </p>
              {staticInventory.status === "enabled" && (
                <div className="space-y-2">
                  {staticInventory.items.length === 0 && (
                    <p className="text-sm text-muted-foreground">No static websites yet.</p>
                  )}
                  {staticInventory.items.map(site => (
                    <div key={site.id} className="space-y-1 rounded-md border p-3 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <Link to={"/sites?site=" + encodeURIComponent(site.id)} className="min-w-0 break-words font-medium underline underline-offset-4">{site.name}</Link>
                        <Badge variant={site.state === "running" ? "secondary" : "outline"}>{site.state}</Badge>
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span title={site.activeRelease ?? undefined}>Release: {releaseLabel(site.activeRelease)}</span>
                        <span>{site.releases} releases</span>
                        <Link to={"/runtime-logs?project=" + encodeURIComponent("static:" + site.id)} className="underline underline-offset-4">Logs</Link>
                        {site.state === "running" && (
                          <span>HTTP: {site.healthy === true ? "healthy" : site.healthy === false ? "unavailable" : "not checked"}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <Button nativeButton={false} render={<Link to="/sites" />}>Manage static websites</Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Node.js Hosting</CardTitle>
              <CardDescription>Backend services, APIs and server-side JavaScript.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p role="status" aria-busy={nodeInventory.status === "loading"} className="text-sm">
                Node hosting: {statusText(nodeInventory)}
              </p>
              {nodeInventory.status === "enabled" && (
                <div className="space-y-2">
                  {nodeInventory.items.length === 0 && (
                    <p className="text-sm text-muted-foreground">No Node.js projects yet.</p>
                  )}
                  {nodeInventory.items.map(project => (
                    <div key={project.id} className="space-y-1 rounded-md border p-3 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <Link to={"/projects?project=" + encodeURIComponent(project.id)} className="min-w-0 break-words font-medium underline underline-offset-4">{project.name}</Link>
                        <Badge variant={project.state === "running" ? "secondary" : "outline"}>{project.state}</Badge>
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span title={project.activeRelease ?? undefined}>Release: {releaseLabel(project.activeRelease)}</span>
                        {project.port !== null && <span>Port: {project.port}</span>}
                        <span>Desired: {project.desired}</span>
                        <Link to={"/runtime-logs?project=" + encodeURIComponent("node:" + project.id)} className="underline underline-offset-4">Logs</Link>
                      </div>
                      {project.state === "running" && (
                        <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                          <span role="status" aria-live="polite">
                            HTTP: {readiness[project.id] === "checking" ? "checking…" :
                              readiness[project.id] === "ready" ? "ready" :
                              readiness[project.id] === "not-ready" ? "not ready" :
                              readiness[project.id] === "not-probed" ? "not probed" :
                              readiness[project.id] === "unavailable" ? "unavailable" : "not checked"}
                          </span>
                          <Button size="xs" variant="outline"
                            aria-label={"Check readiness for " + project.name}
                            disabled={readiness[project.id] === "checking"}
                            onClick={() => { void checkReadiness(project) }}>
                            Check readiness
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              <Button variant="outline" nativeButton={false} render={<Link to="/projects" />}>Manage Node.js projects</Button>
            </CardContent>
          </Card>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Operations</CardTitle>
            <CardDescription>Inspect published releases and runtime output.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-x-6 gap-y-3 text-sm">
            <Link to="/deployments" className="underline underline-offset-4">Deployment history</Link>
            <Link to="/runtime-logs" className="underline underline-offset-4">Project logs</Link>
          </CardContent>
        </Card>
      </div>
    </BaseLayout>
  )
}
