import * as React from "react"
import { Link } from "react-router-dom"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { parseFleetHealth, parseFleetSites, type FleetSite } from "@/lib/site-fleet-schema"
import { readNodeRuntimeCatalog, type NodeRuntimeEntry } from "@/lib/node-hosting-client"

type Catalog<T> = {
  state: "loading" | "ready" | "disabled" | "unavailable"
  items: T[]
}
type Probe = "checking" | "ready" | "not-ready" | "unavailable"

async function readStatic(signal: AbortSignal): Promise<Catalog<FleetSite>> {
  const response = await fetch("/api/v1/sites", {
    credentials: "same-origin", cache: "no-store", signal,
  })
  if (response.status === 404) return { state: "disabled", items: [] }
  if (!response.ok) throw Error("Static Hosting inventory unavailable")
  return { state: "ready", items: parseFleetSites(await response.json()) }
}

async function readNode(signal: AbortSignal): Promise<Catalog<NodeRuntimeEntry>> {
  const result = await readNodeRuntimeCatalog(signal)
  return { state: result.enabled ? "ready" : "disabled", items: result.projects }
}

/**
 * A read-only host-wide Hosting view, deliberately separate from the generic
 * runit registry. No discovered service grants lifecycle ownership.
 * HTTP readiness is checked only after an explicit button action.
 */
export function HostingWorkloads({ refreshToken = 0 }: { refreshToken?: number }) {
  const [staticSites, setStaticSites] = React.useState<Catalog<FleetSite>>({
    state: "loading", items: [],
  })
  const [nodeProjects, setNodeProjects] = React.useState<Catalog<NodeRuntimeEntry>>({
    state: "loading", items: [],
  })
  const [probes, setProbes] = React.useState<Record<string, Probe>>({})
  const current = React.useRef<AbortController | null>(null)

  React.useEffect(() => {
    const controller = new AbortController()
    current.current = controller
    setStaticSites({ state: "loading", items: [] })
    setNodeProjects({ state: "loading", items: [] })
    setProbes({})
    void readStatic(controller.signal).then(value => {
      if (!controller.signal.aborted) setStaticSites(value)
    }).catch(() => {
      if (!controller.signal.aborted)
        setStaticSites({ state: "unavailable", items: [] })
    })
    void readNode(controller.signal).then(value => {
      if (!controller.signal.aborted) setNodeProjects(value)
    }).catch(() => {
      if (!controller.signal.aborted)
        setNodeProjects({ state: "unavailable", items: [] })
    })
    return () => {
      controller.abort()
      if (current.current === controller) current.current = null
    }
  }, [refreshToken])

  const health = async (kind: "node" | "static", id: string, release: string | null) => {
    const controller = current.current
    if (!controller) return
    const key = kind + ":" + id
    if (probes[key] === "checking") return
    setProbes(previous => ({ ...previous, [key]: "checking" }))
    try {
      const url = kind === "node"
        ? "/api/v1/node-projects/" + id + "/health"
        : "/api/v1/sites/" + id + "/health"
      const response = await fetch(url, {
        credentials: "same-origin", cache: "no-store", signal: controller.signal,
      })
      if (!response.ok) throw Error("readiness-unavailable")
      const payload: unknown = await response.json()
      let ready: boolean
      if (kind === "static") {
        ready = parseFleetHealth(payload)
      } else {
        if (!payload || typeof payload !== "object" || Array.isArray(payload))
          throw Error("invalid-node-health")
        const report = (payload as Record<string, unknown>).health
        if (!report || typeof report !== "object" || Array.isArray(report))
          throw Error("invalid-node-health")
        const result = report as Record<string, unknown>
        if (result.state !== "running" || result.release !== release ||
            typeof result.ready !== "boolean") throw Error("node-identity-unverified")
        ready = result.ready
      }
      if (!controller.signal.aborted)
        setProbes(previous => ({ ...previous, [key]: ready ? "ready" : "not-ready" }))
    } catch {
      if (!controller.signal.aborted)
        setProbes(previous => ({ ...previous, [key]: "unavailable" }))
    }
  }

  const diagnostic = (kind: "node" | "static", id: string, running: boolean,
    release: string | null) => {
    const value = probes[kind + ":" + id]
    return <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-muted-foreground" role="status">
        HTTP readiness: {value === "checking" ? "checking…" :
          value === "ready" ? "ready" : value === "not-ready" ? "not ready" :
          value === "unavailable" ? "unavailable / identity uncertain" : "not checked"}
      </span>
      <Button variant="outline" size="sm"
        disabled={!running || !release || value === "checking"}
        onClick={() => void health(kind, id, release)}>
        Check health
      </Button>
    </div>
  }

  return <div className="space-y-4">
    <p className="text-xs text-muted-foreground">
      Owned Hosting workloads are listed separately from the runit service registry.
      Runtime status is not an HTTP health check. No background polling, service
      adoption or automatic restart occurs here.
    </p>
    <section className="space-y-2" aria-label="Node Hosting workloads">
      <h3 className="text-sm font-medium">Node.js projects</h3>
      {nodeProjects.state === "loading" && <p role="status" className="text-xs">Loading Node projects…</p>}
      {nodeProjects.state === "disabled" && <p className="text-xs text-muted-foreground">
        Node Hosting is not enabled on this panel.
      </p>}
      {nodeProjects.state === "unavailable" && <p role="alert" className="text-xs">
        Node runtime inventory unavailable. No service changes were made.
      </p>}
      {nodeProjects.state === "ready" && nodeProjects.items.length === 0 &&
        <p className="text-xs text-muted-foreground">No PocketHost Node projects yet.</p>}
      {nodeProjects.items.map(project => <div key={project.id}
        className="space-y-2 rounded-md border p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-medium">{project.name}</p>
            <p className="break-all font-mono text-xs text-muted-foreground">{project.id}</p>
          </div>
          <Badge variant="outline">Node · {project.state}</Badge>
        </div>
        <p className="break-all text-xs text-muted-foreground">
          Desired: {project.desired} · Observed: {project.state} · Port: {project.port ?? "not assigned"}
        </p>
        <p className="break-all text-xs text-muted-foreground">
          Active release: {project.activeRelease ?? "none"} · Last good: {project.lastGoodRelease ?? "none"}
        </p>
        {project.desired === "running" && project.state !== "running" &&
          <p role="alert" className="text-xs">
            Desired/observed state differs. Policy: {project.healthDecision.action}
            {" ("}{project.healthDecision.reason}{")."} No automatic recovery was requested.
          </p>}
        <div className="flex flex-wrap items-center justify-between gap-3">
          {diagnostic("node", project.id, project.state === "running", project.activeRelease)}
          <Link className="text-xs underline underline-offset-4" to="/projects">
            Manage project
          </Link>
        </div>
        {project.state === "unknown" && <p role="alert" className="text-xs">
          Process identity is uncertain. Use the project page to review ownership before any action.
        </p>}
      </div>)}
    </section>
    <section className="space-y-2" aria-label="Static Hosting workloads">
      <h3 className="text-sm font-medium">Static sites</h3>
      {staticSites.state === "loading" && <p role="status" className="text-xs">Loading static sites…</p>}
      {staticSites.state === "disabled" && <p className="text-xs text-muted-foreground">
        Static Hosting is not enabled on this panel.
      </p>}
      {staticSites.state === "unavailable" && <p role="alert" className="text-xs">
        Static site inventory unavailable. No service changes were made.
      </p>}
      {staticSites.state === "ready" && staticSites.items.length === 0 &&
        <p className="text-xs text-muted-foreground">No PocketHost static sites yet.</p>}
      {staticSites.items.map(site => <div key={site.id}
        className="space-y-2 rounded-md border p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-medium">{site.name}</p>
            <p className="break-all font-mono text-xs text-muted-foreground">{site.id}</p>
          </div>
          <Badge variant="outline">Static · {site.state}</Badge>
        </div>
        <p className="break-all text-xs text-muted-foreground">
          Active release: {site.activeRelease ?? "none"} · Releases: {site.releases}
        </p>
        <div className="flex flex-wrap items-center justify-between gap-3">
          {diagnostic("static", site.id, site.state === "running", site.activeRelease)}
          <Link className="text-xs underline underline-offset-4" to="/sites">
            Manage site
          </Link>
        </div>
        {site.state === "unknown" && <p role="alert" className="text-xs">
          Process identity is uncertain. Review the site before any action.
        </p>}
      </div>)}
    </section>
  </div>
}
