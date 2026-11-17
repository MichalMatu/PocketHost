import * as React from "react"
import { Link } from "react-router-dom"

import { BaseLayout } from "@/components/layouts/base-layout"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { readNodeRuntimeCatalog, type NodeRuntimeEntry } from "@/lib/node-hosting-client"
import { parseFleetSites, type FleetSite } from "@/lib/site-fleet-schema"

type InventoryStatus = "loading" | "enabled" | "disabled" | "unavailable"
type Inventory<T> = { status: InventoryStatus; items: T[] }

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
          <Button size="sm" variant="outline" onClick={() => setGeneration(value => value + 1)}
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
                        <span className="min-w-0 break-words font-medium">{site.name}</span>
                        <Badge variant={site.state === "running" ? "secondary" : "outline"}>{site.state}</Badge>
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span title={site.activeRelease ?? undefined}>Release: {releaseLabel(site.activeRelease)}</span>
                        <span>{site.releases} releases</span>
                        {site.state === "running" && (
                          <span>HTTP: {site.healthy === true ? "healthy" : site.healthy === false ? "unavailable" : "not checked"}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <Button render={<Link to="/sites" />}>Manage static websites</Button>
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
                        <span className="min-w-0 break-words font-medium">{project.name}</span>
                        <Badge variant={project.state === "running" ? "secondary" : "outline"}>{project.state}</Badge>
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span title={project.activeRelease ?? undefined}>Release: {releaseLabel(project.activeRelease)}</span>
                        {project.port !== null && <span>Port: {project.port}</span>}
                        <span>Desired: {project.desired}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <Button variant="outline" render={<Link to="/projects" />}>Manage Node.js projects</Button>
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
