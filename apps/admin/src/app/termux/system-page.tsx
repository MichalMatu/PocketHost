import * as React from "react"
import { Activity, Archive, Bot, FolderOpen, Globe2, Package, RefreshCw, ServerCog, Smartphone, Terminal } from "lucide-react"
import { Link } from "react-router-dom"
import { BaseLayout } from "@/components/layouts/base-layout"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { parseHostSnapshot, type HostSnapshot } from "@/lib/host-snapshot-schema"
import { formatMemory } from "@/lib/format-memory"

const modules = [
  { title: "Monitoring", to: "/observability", icon: Activity, detail: "CPU, memory and service health" },
  { title: "Android & Shizuku", to: "/shizuku", icon: Smartphone, detail: "Android power-user controls and device access" },
  { title: "Packages", to: "/packages", icon: Package, detail: "Inventory and reviewed software actions" },
  { title: "File Manager", to: "/files", icon: FolderOpen, detail: "One explorer with named roots" },
  { title: "Services", to: "/services", icon: ServerCog, detail: "Observed and registered services" },
  { title: "Terminal", to: "/terminal", icon: Terminal, detail: "Manual local shell, if available" },
  { title: "Backups", to: "/backups", icon: Archive, detail: "Workspace and staged recovery" },
  { title: "Websites", to: "/sites", icon: Globe2, detail: "Static hosting and release history" },
  { title: "Agents & API", to: "/agents", icon: Bot, detail: "Local typed agent capabilities" },
]

function MetricValue({ loading, value }: { loading: boolean; value: string | null }) {
  if (loading) return (
    <span aria-label="Loading" className="block h-6 w-28 max-w-full animate-pulse rounded bg-muted" />
  )
  return <>{value ?? "Unavailable"}</>
}

export default function SystemPage() {
  const [host, setHost] = React.useState<HostSnapshot | null>(null)
  const [error, setError] = React.useState(false)
  const [loading, setLoading] = React.useState(true)
  const [refreshCount, setRefreshCount] = React.useState(0)
  const refresh = () => {
    setLoading(true)
    setError(false)
    setRefreshCount(previous => previous + 1)
  }
  React.useEffect(() => {
    const controller = new AbortController()
    void fetch("/api/v1/host/snapshot", {
      credentials: "same-origin", cache: "no-store", signal: controller.signal,
    }).then(async response => {
      if (!response.ok) throw new Error("unavailable")
      return parseHostSnapshot(await response.json() as unknown)
    }).then(data => {
      if (!controller.signal.aborted) setHost(data)
    }).catch(() => {
      if (!controller.signal.aborted) setError(true)
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false)
    })
    return () => controller.abort()
  }, [refreshCount])

  return (
    <BaseLayout title="System dashboard" description="Termux management with hosting as one module">
      <div className="flex flex-col gap-5 px-4 pb-8 lg:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">DEV · Private LAN</Badge>
            <Badge variant="outline">On-demand metrics</Badge>
          </div>
          <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
            <RefreshCw className={loading ? "size-4 animate-spin" : "size-4"} />
            Refresh status
          </Button>
        </div>
        <p className="text-muted-foreground text-sm">
          Termux controls run as this OS user. Never expose administrative actions to the public internet.
        </p>
        <div data-testid="system-metrics" aria-busy={loading} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Card className="min-h-32">
            <CardHeader>
              <CardDescription>Node runtime</CardDescription>
              <CardTitle><MetricValue loading={loading} value={!error ? host?.runtime.nodeVersion ?? null : null} /></CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground text-xs">{!error ? host?.runtime.architecture ?? "Unavailable" : "Unavailable"}</CardContent>
          </Card>
          <Card className="min-h-32">
            <CardHeader>
              <CardDescription>Free RAM</CardDescription>
              <CardTitle><MetricValue loading={loading} value={!error && host ? formatMemory(host.runtime.freeMemoryMiB) : null} /></CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground text-xs">System-wide</CardContent>
          </Card>
          <Card className="min-h-32">
            <CardHeader>
              <CardDescription>Free Termux storage</CardDescription>
              <CardTitle><MetricValue loading={loading} value={!error && host?.runtime.storage ? formatMemory(host.runtime.storage.availableMiB) : null} /></CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground text-xs">Home filesystem</CardContent>
          </Card>
          <Card className="min-h-32">
            <CardHeader>
              <CardDescription>Observed services</CardDescription>
              <CardTitle><MetricValue loading={loading} value={!error && host ? String(host.services.length) : null} /></CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground text-xs">External services are read-only</CardContent>
          </Card>
        </div>
        {error && <span role="alert" className="sr-only">Host status unavailable; module navigation remains available.</span>}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {modules.map(({ title, to, icon: Icon, detail }) => (
            <Link to={to} key={to} className="rounded-lg outline-offset-2 focus-visible:outline-2 focus-visible:outline-ring">
              <Card className="h-full transition-colors hover:bg-muted/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base"><Icon className="size-4" />{title}</CardTitle>
                  <CardDescription>{detail}</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </BaseLayout>
  )
}
