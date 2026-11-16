import * as React from "react"
import { Link } from "react-router-dom"
import { BaseLayout } from "@/components/layouts/base-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { parseFleetSites } from "@/lib/site-fleet-schema"
import { readNodeCatalog } from "@/lib/node-hosting-client"

type Capability = { status: "loading" | "enabled" | "disabled" | "unavailable"; count: number }
const loading: Capability = { status: "loading", count: 0 }

async function staticHosting(signal: AbortSignal): Promise<Capability> {
  const response = await fetch("/api/v1/sites", {
    credentials: "same-origin", cache: "no-store", signal,
  })
  if (response.status === 404) return { status: "disabled", count: 0 }
  if (!response.ok) throw new Error("Static hosting inventory unavailable")
  const sites = parseFleetSites(await response.json())
  return { status: "enabled", count: sites.length }
}

async function nodeHosting(signal: AbortSignal): Promise<Capability> {
  const result = await readNodeCatalog(signal)
  return { status: result.enabled ? "enabled" : "disabled", count: result.projects.length }
}

export default function HostingPage() {
  const [staticState, setStaticState] = React.useState<Capability>(loading)
  const [nodeState, setNodeState] = React.useState<Capability>(loading)
  const [generation, setGeneration] = React.useState(0)

  React.useEffect(() => {
    const controller = new AbortController()
    setStaticState(loading)
    setNodeState(loading)
    void staticHosting(controller.signal)
      .then(value => { if (!controller.signal.aborted) setStaticState(value) })
      .catch(() => { if (!controller.signal.aborted) setStaticState({ status: "unavailable", count: 0 }) })
    void nodeHosting(controller.signal)
      .then(value => { if (!controller.signal.aborted) setNodeState(value) })
      .catch(() => { if (!controller.signal.aborted) setNodeState({ status: "unavailable", count: 0 }) })
    return () => controller.abort()
  }, [generation])

  const statusText = (value: Capability) =>
    value.status === "loading" ? "Checking availability…" :
    value.status === "enabled" ? "Enabled · " + value.count + " hosted" :
    value.status === "disabled" ? "Not enabled on this panel" : "Status unavailable"

  return <BaseLayout title="Hosting" description="Choose how to publish a site on your PocketHost device.">
    <div className="space-y-5 px-4 pb-8 lg:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Two hosting paths, each with separate releases, runtime state and logs.
        </p>
        <Button size="sm" variant="outline" onClick={() => setGeneration(value => value + 1)}>
          Refresh availability
        </Button>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Static website</CardTitle>
            <CardDescription>HTML, CSS, JavaScript, images and prebuilt frontend folders.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm" role="status">Static hosting: {statusText(staticState)}</p>
            <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
              <li>Create your site.</li>
              <li>Upload a ZIP or a folder with index.html.</li>
              <li>Publish an immutable release and press Start.</li>
              <li>Open the private LAN site URL; update or roll back when needed.</li>
            </ol>
            <Button render={<Link to="/sites" />}>Manage static websites</Button>
            <p className="text-xs text-muted-foreground">
              Site publishing is a manual action. No background deployment or scheduler.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Node.js website / backend</CardTitle>
            <CardDescription>Server-side JavaScript, API routes and optional frontend files.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm" role="status">Node hosting: {statusText(nodeState)}</p>
            <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
              <li>Create an owned Node.js project and review its source.</li>
              <li>Prepare a versioned candidate and inspect the runtime plan.</li>
              <li>Approve one deployment and verify HTTP readiness, logs and rollback.</li>
              <li>Publishing the backend to LAN needs separate secure access controls.</li>
            </ol>
            <Button variant="outline" render={<Link to="/projects" />}>Inspect Node.js projects</Button>
            <p className="text-xs text-muted-foreground">
              Arbitrary backend execution is not enabled through passwordless LAN.
              The project page is not proof that a backend is publicly reachable.
            </p>
          </CardContent>
        </Card>
      </div>
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <Link to="/deployments" className="underline underline-offset-4">Deployment history</Link>
        <Link to="/runtime-logs" className="underline underline-offset-4">Project logs</Link>
      </div>
      <p className="text-xs text-muted-foreground">
        Trusted private Wi-Fi only. No WAN, credentials or arbitrary service adoption.
      </p>
    </div>
  </BaseLayout>
}
