import { siteDetailPath } from "@/app/sites/site-route"
import * as React from "react"
import { Link } from "react-router-dom"

import { StandardPageLayout, pageActionClass } from "@/components/layouts/standard-page-layout"
import { InventoryCard, InventoryList, InventoryRow } from "@/components/inventory-card"
import { buttonVariants } from "@/components/ui/button"
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
  return release ? "Active release" : "None published"
}

export default function HostingPage() {
  const [staticInventory, setStaticInventory] = React.useState<Inventory<FleetSite>>(loadingSites)
  const [nodeInventory, setNodeInventory] = React.useState<Inventory<NodeRuntimeEntry>>(loadingNodes)
  const [generation, setGeneration] = React.useState(0)
  React.useEffect(() => {
    const controller = new AbortController()
    const requestSignal = AbortSignal.any([controller.signal, AbortSignal.timeout(10_000)])
    // Invalidate prior inventory when Refresh starts, without an effect-time sync setState.
    void Promise.resolve().then(() => {
      if (controller.signal.aborted) return
      setStaticInventory(loadingSites)
      setNodeInventory(loadingNodes)
    })
    void readStaticHosting(requestSignal)
      .then(value => { if (!controller.signal.aborted) setStaticInventory(value) })
      .catch(() => {
        if (!controller.signal.aborted) setStaticInventory({ status: "unavailable", items: [] })
      })
    void readNodeHosting(requestSignal)
      .then(value => { if (!controller.signal.aborted) setNodeInventory(value) })
      .catch(() => {
        if (!controller.signal.aborted) setNodeInventory({ status: "unavailable", items: [] })
      })
    return () => controller.abort()
  }, [generation])

  return (
    <StandardPageLayout title="Hosting" onRefresh={() => setGeneration(value => value + 1)}>
      <div className="grid gap-4 lg:grid-cols-2">
        <InventoryCard headingId="static-hosting-heading" title="Static Hosting"
          statusLabel="Static hosting status" status={statusText(staticInventory)}
          loading={staticInventory.status === "loading"} manageTo="/sites" manageLabel="Manage static websites">
          {staticInventory.status === "enabled" && (
            staticInventory.items.length === 0
              ? <p className="text-muted-foreground">No static websites yet.</p>
              : <InventoryList>
                {staticInventory.items.map(site => (
                  <InventoryRow key={site.id} name={site.name} to={siteDetailPath(site.id)} state={site.state}
                    logsTo={"/runtime-logs?project=" + encodeURIComponent("static:" + site.id)}>
                    <span title={site.activeRelease ?? undefined}>{releaseLabel(site.activeRelease)}</span>
                    <span>{site.releases} releases</span>
                    {site.state === "running" && (
                      <span>HTTP: {site.healthy === true ? "healthy" : site.healthy === false ? "unavailable" : "not checked"}</span>
                    )}
                  </InventoryRow>
                ))}
              </InventoryList>
          )}
        </InventoryCard>
        <InventoryCard headingId="node-hosting-heading" title="Node.js Hosting"
          statusLabel="Node hosting status" status={statusText(nodeInventory)}
          loading={nodeInventory.status === "loading"} manageTo="/projects" manageLabel="Manage Node.js projects">
          {nodeInventory.status === "enabled" && (
            nodeInventory.items.length === 0
              ? <p className="text-muted-foreground">No Node.js projects yet.</p>
              : <InventoryList>
                {nodeInventory.items.map(project => (
                  <InventoryRow key={project.id} name={project.name}
                    to={"/projects?project=" + encodeURIComponent(project.id)} state={project.state}
                    logsTo={"/runtime-logs?project=" + encodeURIComponent("node:" + project.id)}>
                    <span title={project.activeRelease ?? undefined}>{releaseLabel(project.activeRelease)}</span>
                    {project.port !== null && <span>Port: {project.port}</span>}
                    {project.state !== project.desired && <span>Desired: {project.desired}</span>}
                  </InventoryRow>
                ))}
              </InventoryList>
          )}
        </InventoryCard>
      </div>
      <Card>
        <CardHeader>
          <CardTitle><h2>Hosting operations</h2></CardTitle>
          <CardDescription>Review release history and application output.</CardDescription>
        </CardHeader>
        <CardContent>
          <nav aria-label="Hosting operations" className="flex flex-wrap gap-2">
            <Link to="/deployments" className={buttonVariants({ variant: "outline", className: pageActionClass })}>Deployment history</Link>
            <Link to="/runtime-logs" className={buttonVariants({ variant: "outline", className: pageActionClass })}>Project logs</Link>
          </nav>
        </CardContent>
      </Card>
    </StandardPageLayout>
  )
}
