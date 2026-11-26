import * as React from "react"
import { Link } from "react-router-dom"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
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
  const [retryToken, setRetryToken] = React.useState(0)
  const current = React.useRef<AbortController | null>(null)

  React.useEffect(() => {
    const controller = new AbortController()
    const requestSignal = AbortSignal.any([controller.signal, AbortSignal.timeout(10_000)])
    current.current = controller
    void Promise.resolve().then(() => {
      if (controller.signal.aborted) return
      setStaticSites({ state: "loading", items: [] })
      setNodeProjects({ state: "loading", items: [] })
      setProbes({})
    })
    void readStatic(requestSignal).then(value => {
      if (!controller.signal.aborted) setStaticSites(value)
    }).catch(() => {
      if (!controller.signal.aborted)
        setStaticSites({ state: "unavailable", items: [] })
    })
    void readNode(requestSignal).then(value => {
      if (!controller.signal.aborted) setNodeProjects(value)
    }).catch(() => {
      if (!controller.signal.aborted)
        setNodeProjects({ state: "unavailable", items: [] })
    })
    return () => {
      controller.abort()
      if (current.current === controller) current.current = null
    }
  }, [refreshToken, retryToken])

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
        credentials: "same-origin", cache: "no-store",
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10_000)]),
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
        HTTP readiness: {value?.state === "checking" ? "checking…" :
          value?.state === "ready" ? "ready at last check" :
          value?.state === "not-ready" ? "not ready at last check" :
          value?.state === "unavailable" ? "unavailable / identity uncertain" :
          "not checked for this release"}
        {value?.checkedAtMs !== null && value?.checkedAtMs !== undefined &&
          " · " + new Date(value.checkedAtMs).toLocaleTimeString()}
      </span>
      <Button variant="outline" className="min-h-10" size="sm"
        disabled={!running || !release || value?.state === "checking"}
        onClick={() => void health(kind, id, release)}>
        Check health
      </Button>
    </div>
  }

  return <div className="space-y-4">
    <p className="text-xs text-muted-foreground">
      {view === "health"
        ? "Check the current verified release. Unknown or stopped workloads cannot be marked healthy."
        : "PocketHost-owned runtime inventory, separate from runit. A running process does not prove HTTP readiness."}
    </p>
    {(staticSites.state === "unavailable" || nodeProjects.state === "unavailable") &&
      <Button size="sm" className="min-h-10" variant="outline" onClick={() => setRetryToken(value => value + 1)}>
        Retry hosting inventory
      </Button>}
    <section className="space-y-2" aria-label="Node Hosting workloads">
      <h2 className="text-base font-semibold">Node.js projects</h2>
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
        className="space-y-2 border-t py-3 first:pt-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="min-w-0 break-words text-sm font-medium">{project.name}</p>
          <Badge variant={project.state === "unknown" ? "destructive" : project.state === "running" ? "secondary" : "outline"}>{project.state}</Badge>
        </div>
        {view === "inventory" && <p className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground">
          <span>Port: {project.port ?? "not assigned"}</span>
          <span>{project.activeRelease ? "Active release" : "No active release"}</span>
          {project.desired !== project.state && <span>Desired: {project.desired}</span>}
        </p>}
        <details className="text-sm">
          <summary className="cursor-pointer rounded py-2 font-medium focus-visible:outline-2 focus-visible:outline-ring">Runtime details</summary>
          <dl className="space-y-1 break-all text-xs text-muted-foreground">
            <div><dt className="inline font-medium">Project ID: </dt><dd className="inline font-mono">{project.id}</dd></div>
            <div><dt className="inline font-medium">Desired: </dt><dd className="inline">{project.desired}</dd></div>
            <div><dt className="inline font-medium">Active release: </dt><dd className="inline">{project.activeRelease ?? "none"}</dd></div>
            <div><dt className="inline font-medium">Last good: </dt><dd className="inline">{project.lastGoodRelease ?? "none"}</dd></div>
            {project.previousGoodRelease && project.previousGoodRelease !== project.activeRelease &&
              <div><dt className="inline font-medium">Rollback candidate: </dt><dd className="inline font-mono">{project.previousGoodRelease}</dd></div>}
          </dl>
        </details>
        {project.desired === "running" && project.state !== "running" &&
          <p role="alert" className="text-xs">
            Desired/observed state differs. Policy: {project.healthDecision.action}
            {" ("}{project.healthDecision.reason}{")."} No automatic recovery was requested.
          </p>}
        {view === "health" ? <>
          {diagnostic("node", project.id, project.state === "running", project.activeRelease)}
          <div className="space-y-1 rounded-md border p-3">
            <p className="text-xs text-muted-foreground">
              Rollback record: {project.previousGoodRelease &&
                project.previousGoodRelease !== project.activeRelease &&
                project.state !== "unknown"
                  ? "previous release recorded; local preflight required"
                  : project.state === "unknown"
                    ? "blocked: process identity unknown"
                    : "no distinct previous good release recorded"}.
            </p>
            <Link className={buttonVariants({ variant: "ghost", className: "min-h-10 whitespace-normal text-left" })} to="/projects">
              Review deployment and rollback in Projects
            </Link>
            <p className="text-xs text-muted-foreground">
              Rollback requires source/dependency preflight and explicit local-only deployment approval.
            </p>
          </div>
        </> :
          <Link className={buttonVariants({ variant: "ghost", className: "min-h-10 whitespace-normal text-left" })} to="/projects">
            Manage project
          </Link>}
        {project.state === "unknown" && <p role="alert" className="text-xs">
          Process identity is uncertain. Use the project page to review ownership before any action.
        </p>}
      </div>)}
    </section>
    <section className="space-y-2" aria-label="Static Hosting workloads">
      <h2 className="text-base font-semibold">Static sites</h2>
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
        className="space-y-2 border-t py-3 first:pt-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="min-w-0 break-words text-sm font-medium">{site.name}</p>
          <Badge variant={site.state === "unknown" ? "destructive" : site.state === "running" ? "secondary" : "outline"}>{site.state}</Badge>
        </div>
        {view === "inventory" && <p className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground">
          <span>{site.activeRelease ? "Active release" : "No active release"}</span>
          <span>Saved releases: {site.releases}</span>
        </p>}
        <details className="text-sm">
          <summary className="cursor-pointer rounded py-2 font-medium focus-visible:outline-2 focus-visible:outline-ring">Runtime details</summary>
          <dl className="space-y-1 break-all text-xs text-muted-foreground">
            <div><dt className="inline font-medium">Site ID: </dt><dd className="inline font-mono">{site.id}</dd></div>
            <div><dt className="inline font-medium">Active release: </dt><dd className="inline">{site.activeRelease ?? "none"}</dd></div>
          </dl>
        </details>
        {view === "health" ?
          diagnostic("static", site.id, site.state === "running", site.activeRelease) :
          <Link className={buttonVariants({ variant: "ghost", className: "min-h-10 whitespace-normal text-left" })} to="/sites">
            Manage site
          </Link>}
        {site.state === "unknown" && <p role="alert" className="text-xs">
          Process identity is uncertain. Review the site before any action.
        </p>}
      </div>)}
    </section>
  </div>
}
