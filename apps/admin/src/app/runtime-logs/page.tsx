import * as React from "react"
import { Link } from "react-router-dom"
import { BaseLayout } from "@/components/layouts/base-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { parseOwnedSiteLogs } from "@/lib/owned-site-schema"
import { readNodeCatalog, readNodeLogs, type NodeProjectEntry } from "@/lib/node-hosting-client"

export default function RuntimeLogsPage() {
  const [logs, setLogs] = React.useState<string[]>([])
  const [demoLogsEnabled, setDemoLogsEnabled] = React.useState<boolean | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [nodeProjects, setNodeProjects] = React.useState<NodeProjectEntry[]>([])
  const [selectedNode, setSelectedNode] = React.useState("")
  const selectedNodeRef = React.useRef("")
  const [nodeLogs, setNodeLogs] = React.useState<string[]>([])
  const [nodeEnabled, setNodeEnabled] = React.useState<boolean | null>(null)
  const [nodeLoading, setNodeLoading] = React.useState(true)
  const [nodeError, setNodeError] = React.useState<string | null>(null)
  const refresh = React.useCallback(async (signal?: AbortSignal) => {
    const response = await fetch("/api/v1/owned-site/logs", {
      cache: "no-store", credentials: "same-origin", signal,
    })
    // The optional PocketHost demo can be intentionally unprovisioned.
    // Treat its missing endpoint as a neutral disabled state, not a host failure.
    if (response.status === 404) {
      if (!signal?.aborted) { setLogs([]); setDemoLogsEnabled(false); setError(null) }
      return
    }
    if (!response.ok) throw new Error("Owned logs unavailable")
    const data = parseOwnedSiteLogs(await response.json())
    if (!signal?.aborted) { setLogs(data); setDemoLogsEnabled(true); setError(null) }
  }, [])
  const loadNode = React.useCallback(async (id: string, signal?: AbortSignal) => {
    const lines = await readNodeLogs(id, signal)
    if (!signal?.aborted && selectedNodeRef.current === id) {
      setNodeLogs(lines)
      setNodeError(null)
    }
  }, [])
  React.useEffect(() => {
    const controller = new AbortController()
    void Promise.resolve().then(async () => {
      const catalog = await readNodeCatalog(controller.signal)
      if (controller.signal.aborted) return
      setNodeEnabled(catalog.enabled)
      setNodeProjects(catalog.projects)
      if (catalog.projects.length > 0) {
        const first = catalog.projects[0]!.id
        selectedNodeRef.current = first
        setSelectedNode(first)
        await loadNode(first, controller.signal)
      }
    })
      .catch(() => {
        if (!controller.signal.aborted) setNodeError("Node logs unavailable or unverified.")
      })
      .finally(() => { if (!controller.signal.aborted) setNodeLoading(false) })
    return () => controller.abort()
  }, [loadNode])
  React.useEffect(() => {
    const controller = new AbortController()
    void Promise.resolve().then(() => refresh(controller.signal))
      .catch(() => { if (!controller.signal.aborted) {
        setDemoLogsEnabled(null)
        setError("Cannot inspect the optional demo log source. Other services are unaffected.")
      } })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [refresh])
  return (
    <BaseLayout title="Logs & Diagnostics" description="Project-scoped runtime logs and links to device monitoring">
      <div className="space-y-4 px-4 pb-8 lg:px-6">
        <div className="space-y-1">
          <h2 className="text-base font-medium">Project logs</h2>
          <p className="text-sm text-muted-foreground">
            This page reads only PocketHost-owned project output. For Android and Termux diagnostics,
            use <Link to="/observability" className="underline underline-offset-4">Monitoring</Link>.
            To inspect managed services, use <Link to="/services" className="underline underline-offset-4">Services</Link>.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" disabled={loading || nodeLoading} onClick={() => {
            setLoading(true); setNodeLoading(true)
            void Promise.allSettled([refresh(), selectedNode ? loadNode(selectedNode) : Promise.resolve()])
              .then(([demo, node]) => {
                if (demo.status === "rejected") setError("Could not refresh demo logs.")
                if (node.status === "rejected") setNodeError("Could not refresh Node logs.")
              }).finally(() => { setLoading(false); setNodeLoading(false) })
          }}>Refresh logs</Button>
          <Link to="/owned-site" className="text-sm underline">Open project details</Link>
        </div>
        {loading && <p role="status">Reading bounded runtime output…</p>}
        {error && <p role="alert" className="text-destructive text-sm">{error}</p>}
        <Card>
          <CardHeader><CardTitle>Node.js project logs</CardTitle>
            <CardDescription>Bounded runit logs for explicitly owned user projects, without live tailing.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {nodeLoading && <p role="status">Reading Node logs…</p>}
            {nodeError && <p role="alert" className="text-destructive text-sm">{nodeError}</p>}
            {nodeEnabled === false && <p className="text-muted-foreground text-sm">
              Node Hosting is disabled. This is an optional project feature, not a device fault.
            </p>
            {nodeEnabled && nodeProjects.length === 0 && <p className="text-muted-foreground text-sm">No Node projects to inspect.</p>}
            <div className="flex flex-wrap gap-2">
              {nodeProjects.map((project) => (
                <Button key={project.id} variant={selectedNode === project.id ? "default" : "outline"}
                  disabled={nodeLoading}
                  onClick={() => {
                    selectedNodeRef.current = project.id
                    setSelectedNode(project.id)
                    setNodeError(null)
                    setNodeLoading(true)
                    setNodeLogs([])
                    void loadNode(project.id)
                      .catch(() => { if (selectedNodeRef.current === project.id) setNodeError("Cannot read verified Node service logs.") })
                      .finally(() => setNodeLoading(false))
                  }}>{project.name}</Button>
              ))}

            </div>
            {nodeLogs.length > 0
              ? <pre aria-label="Node project logs" className="max-h-96 overflow-auto whitespace-pre-wrap rounded-md bg-muted p-4 text-xs">{nodeLogs.join("\n")}</pre>
              : nodeEnabled && <p className="text-muted-foreground text-sm">No verified Node output recorded.</p>}
          </CardContent>
        </Card>
        {demoLogsEnabled === false && <p className="text-sm text-muted-foreground">
          Optional demo logs are not enabled on this panel.
        </p>}
        {demoLogsEnabled && <Card>
          <CardHeader><CardTitle>PocketHost Demo</CardTitle>
            <CardDescription>At most 25 lines. No foreign process logs or live tailing.</CardDescription></CardHeader>
          <CardContent>{logs.length
            ? <pre className="max-h-96 overflow-auto rounded-md bg-muted p-4 text-xs">{logs.join("\n")}</pre>
            : <p className="text-muted-foreground text-sm">No owned process output recorded.</p>}
          </CardContent>
        </Card>}
      </div>
    </BaseLayout>
  )
}
