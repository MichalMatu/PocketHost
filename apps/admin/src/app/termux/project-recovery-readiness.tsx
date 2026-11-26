import { siteDetailPath } from "@/app/sites/site-route"
import * as React from "react"
import { Link } from "react-router-dom"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { parseFleetSites, type FleetSite } from "@/lib/site-fleet-schema"
import { readNodeRuntimeCatalog, type NodeRuntimeEntry } from "@/lib/node-hosting-client"

type Result<T> =
  | { state: "available"; items: T[] }
  | { state: "unavailable" }

async function readSites(signal: AbortSignal): Promise<FleetSite[]> {
  const response = await fetch("/api/v1/sites", {
    credentials: "same-origin", cache: "no-store", signal,
  })
  if (!response.ok) throw new Error("Static catalog unavailable")
  return parseFleetSites(await response.json() as unknown)
}

/** A recovered release and a local backup are different things. */
export function ProjectRecoveryReadiness({ refreshToken = 0 }: {
  refreshToken?: number
}) {
  const [staticSites, setStaticSites] = React.useState<Result<FleetSite> | null>(null)
  const [nodeProjects, setNodeProjects] = React.useState<Result<NodeRuntimeEntry> | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [checkedAt, setCheckedAt] = React.useState<string | null>(null)
  const request = React.useRef<AbortController | null>(null)

  const inspect = React.useCallback(async () => {
    request.current?.abort()
    const controller = new AbortController()
    request.current = controller
    setBusy(true)
    setCheckedAt(null)
    setStaticSites(null)
    setNodeProjects(null)
    try {
      const [staticResult, nodeResult] = await Promise.allSettled([
        readSites(AbortSignal.any([controller.signal, AbortSignal.timeout(10000)])),
        readNodeRuntimeCatalog(AbortSignal.any([controller.signal, AbortSignal.timeout(10000)])),
      ])
      if (controller.signal.aborted) return
      setStaticSites(staticResult.status === "fulfilled"
        ? { state: "available", items: staticResult.value }
        : { state: "unavailable" })
      setNodeProjects(nodeResult.status === "fulfilled" && nodeResult.value.enabled
        ? { state: "available", items: nodeResult.value.projects }
        : { state: "unavailable" })
      setCheckedAt(new Date().toISOString())
    } finally {
      if (request.current === controller) {
        request.current = null
        setBusy(false)
      }
    }
  }, [])

  React.useEffect(() => {
    const controller = new AbortController()
    void Promise.resolve().then(() => {
      if (!controller.signal.aborted) void inspect()
    })
    return () => { controller.abort(); request.current?.abort() }
  }, [inspect, refreshToken])

  return <Card>
    <CardHeader>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <CardTitle className="text-base">Project recovery coverage</CardTitle>
        <Button variant="outline" disabled={busy} onClick={() => void inspect()}>
          {busy ? "Checking…" : "Refresh project coverage"}
        </Button>
      </div>
    </CardHeader>
    <CardContent className="space-y-3 text-sm">
      <p className="text-xs text-muted-foreground">
        Read-only inventories. An immutable local release allows rollback but is not
        an independent backup; a detected Restic tool does not prove that a project
        has a restorable snapshot. No data is copied, restored or exported here.
      </p>
      {!checkedAt && <p role="status" className="text-xs text-muted-foreground">
        {busy ? "Reading owned project inventories…" : "Not checked"}
      </p>}
      <div className="grid gap-3 lg:grid-cols-2">
        <section className="space-y-2 rounded-md border p-3" aria-label="Static recovery coverage">
          <h3 className="font-medium">Static sites</h3>
          {!staticSites && <p className="text-xs">Not checked</p>}
          {staticSites?.state === "unavailable" &&
            <p role="alert" className="text-xs">Inventory unavailable — backup coverage unknown.</p>}
          {staticSites?.state === "available" && <>
            <p className="text-xs">
              {staticSites.items.length} owned site(s),{" "}
              {staticSites.items.filter(item => item.canRollback).length} with a local rollback target.
            </p>
            {staticSites.items.length === 0 && <p className="text-xs">No owned sites.</p>}
            {staticSites.items.map(item =>
              <div key={item.id} className="space-y-1 border-t pt-2 text-xs">
                <Link className={buttonVariants({ variant: "link", className: "underline max-w-full whitespace-normal text-left" })}
                  to={siteDetailPath(item.id)}>{item.name}</Link>
                <p>{item.releases} local release(s) · {item.canRollback
                  ? "Rollback available" : "No immediate rollback target"}</p>
                <p className="text-muted-foreground">Download the active ZIP from the site page and keep it separately; off-device recovery remains unverified.</p>
              </div>)}
          </>}
        </section>
        <section className="space-y-2 rounded-md border p-3" aria-label="Node recovery coverage">
          <h3 className="font-medium">Node projects</h3>
          {!nodeProjects && <p className="text-xs">Not checked</p>}
          {nodeProjects?.state === "unavailable" &&
            <p role="alert" className="text-xs">Inventory unavailable — backup coverage unknown.</p>}
          {nodeProjects?.state === "available" && <>
            <p className="text-xs">{nodeProjects.items.length} owned Node project(s).</p>
            {nodeProjects.items.length === 0 && <p className="text-xs">No owned projects.</p>}
            {nodeProjects.items.map(item =>
              <div key={item.id} className="space-y-1 border-t pt-2 text-xs">
                <Link className={buttonVariants({ variant: "link", className: "underline max-w-full whitespace-normal text-left" })}
                  to={"/projects?project=" + encodeURIComponent(item.id)}>{item.name}</Link>
                <p>{item.activeRelease ? "Release present" : "No deployed release"}
                  {item.previousGoodRelease ? " · Previous good release present" : ""}</p>
                <p className="text-muted-foreground">
                  Restic project snapshot and independent recovery: not verified by this inventory
                </p>
              </div>)}
          </>}
        </section>
      </div>
      <p className="text-xs text-muted-foreground">
        Project backups are not equivalent to HOME/PREFIX snapshots.
        Persistent databases, uploads, and off-device recovery require
        their own verified backup and restore flow.
      </p>
      {checkedAt && <p className="text-xs text-muted-foreground">
        Inventory observed {new Date(checkedAt).toLocaleString()}; contents may change after this read.
      </p>}
    </CardContent>
  </Card>
}
