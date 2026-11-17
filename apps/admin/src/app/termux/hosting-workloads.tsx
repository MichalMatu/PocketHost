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
type ProbeSample = { state: Probe; release: string | null; checkedAtMs: number | null }

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
export function HostingWorkloads({
  refreshToken = 0, view = "inventory",
}: { refreshToken?: number; view?: "inventory" | "health" }) {
  const [staticSites, setStaticSites] = React.useState<Catalog<FleetSite>>({
    state: "loading", items: [],
  })
  const [nodeProjects, setNodeProjects] = React.useState<Catalog<NodeRuntimeEntry>>({
    state: "loading", items: [],
  })
  const [probes, setProbes] = React.useState<Record<string, ProbeSample>>({})
  const current = React.useRef<AbortController | null>(null)

  React.useEffect(() => {
    const controller = new AbortController()
    current.current = controller
    void Promise.resolve().then(() => {
      if (controller.signal.aborted) return
      setStaticSites({ state: "loading", items: [] })
      setNodeProjects({ state: "loading", items: [] })
      setProbes({})
    })
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
    if (probes[key]?.state === "checking") return
    // A readiness sample is valid only for the exact active release
    // selected at the time of the explicit user request.
    setProbes(previous => ({ ...previous, [key]: {
      state: "checking", release, checkedAtMs: null,
    } }))
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
        setProbes(previous => ({ ...previous, [key]: {
          state: ready ? "ready" : "not-ready", release,
          checkedAtMs: Date.now(),
        } }))
    } catch {
      if (!controller.signal.aborted)
        setProbes(previous => ({ ...previous, [key]: {
          state: "unavailable", release, checkedAtMs: Date.now(),
        } }))
    }
  }

  const diagnostic = (kind: "node" | "static", id: string, running: boolean,
    release: string | null) => {
    const sample = probes[kind + ":" + id]
    const value = sample?.release === release ? sample : null
    return <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-muted-foreground" role="status">
        HTTP readiness snapshot: {value?.state === "checking" ? "checking…" :
          value?.state === "ready" ? "ready at last check" :
          value?.state === "not-ready" ? "not ready at last check" :
          value?.state === "unavailable" ? "unavailable / identity uncertain" :
          "not checked for this release"}
        {value?.checkedAtMs !== null && value?.checkedAtMs !== undefined &&
          " · " + new Date(value.checkedAtMs).toLocaleTimeString()}
      </span>
      <Button variant="outline" size="sm"
        disabled={!running || !release || value?.state === "checking"}
        onClick={() => void health(kind, id, release)}>
        Check health
      </Button>
    </div>
  }

  return <div className="space-y-4">
    <p className="text-xs text-muted-foreground">
      {view === "health"
        ? "Manually probe the current verified release. Unknown or stopped workloads cannot be marked healthy. No periodic health polling or restart is enabled."
        : "PocketHost-owned Hosting workloads, independent of runit inventory. Runtime state does not prove HTTP readiness; health checks are on their own Services page."}
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
        {view === "inventory" && <>
          <p className="break-all text-xs text-muted-foreground">
            Desired: {project.desired} · Observed: {project.state} · Port: {project.port ?? "not assigned"}
          </p>
          <p className="break-all text-xs text-muted-foreground">
            Active release: {project.activeRelease ?? "none"} · Last good: {project.lastGoodRelease ?? "none"}
          </p>
        </>}
        {project.desired === "running" && project.state !== "running" &&
          <p role="alert" className="text-xs">
            Desired/observed state differs. Policy: {project.healthDecision.action}
            {" ("}{project.healthDecision.reason}{")."} No automatic recovery was requested.
          </p>}
        {view === "health" ? <>
          {diagnostic("node", project.id, project.state === "running", project.activeRelease)}
          <div className="space-y-1 border-t pt-2">
            <p className="text-xs text-muted-foreground">
              Rollback record: {project.previousGoodRelease &&
                project.previousGoodRelease !== project.activeRelease &&
                project.state !== "unknown"
                  ? "previous release recorded; local preflight required"
                  : project.state === "unknown"
                    ? "blocked: process identity unknown"
                    : "no distinct previous good release recorded"}.
            </p>
            {project.previousGoodRelease &&
              project.previousGoodRelease !== project.activeRelease &&
              <p className="break-all font-mono text-xs text-muted-foreground">
                Candidate: {project.previousGoodRelease}
              </p>}
            <Link className="text-xs underline underline-offset-4" to="/projects">
              Review deployment and rollback in Projects
            </Link>
            <p className="text-xs text-muted-foreground">
              This is an inventory hint, not rollback approval. Source/dependency
              preflight and explicit local-only deployment remain required.
            </p>
          </div>
        </> :
          <Link className="text-xs underline underline-offset-4" to="/projects">
            Manage project
          </Link>}
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
        {view === "inventory" &&
          <p className="break-all text-xs text-muted-foreground">
            Active release: {site.activeRelease ?? "none"} · Releases: {site.releases}
          </p>}
        {view === "health" ?
          diagnostic("static", site.id, site.state === "running", site.activeRelease) :
          <Link className="text-xs underline underline-offset-4" to="/sites">
            Manage site
          </Link>}
        {site.state === "unknown" && <p role="alert" className="text-xs">
          Process identity is uncertain. Review the site before any action.
        </p>}
      </div>)}
    </section>
  </div>
}
