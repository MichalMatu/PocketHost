import * as React from "react"
import { Activity, Archive, Bot, FolderOpen, Globe2, Package, ServerCog, Terminal } from "lucide-react"
import { Link } from "react-router-dom"
import { BaseLayout } from "@/components/layouts/base-layout"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { parseHostSnapshot, type HostSnapshot } from "@/lib/host-snapshot-schema"

const modules = [
  { title: "Monitoring", to: "/observability", icon: Activity, detail: "CPU, memory and service health" },
  { title: "Packages", to: "/packages", icon: Package, detail: "Inventory and reviewed software actions" },
  { title: "File Manager", to: "/files", icon: FolderOpen, detail: "One explorer with named roots" },
  { title: "Services", to: "/services", icon: ServerCog, detail: "Observed and registered services" },
  { title: "Terminal", to: "/terminal", icon: Terminal, detail: "Manual local shell, if available" },
  { title: "Backups", to: "/backups", icon: Archive, detail: "Workspace and staged recovery" },
  { title: "Websites", to: "/sites", icon: Globe2, detail: "Static hosting and release history" },
  { title: "Agents & API", to: "/agents", icon: Bot, detail: "Local typed agent capabilities" },
]

export default function SystemPage() {
  const [host, setHost] = React.useState<HostSnapshot | null>(null)
  const [error, setError] = React.useState(false)
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
    })
    return () => controller.abort()
  }, [])

  return (
    <BaseLayout title="System dashboard" description="Termux management with hosting as one module">
      <div className="flex flex-col gap-5 px-4 pb-8 lg:px-6">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">Private-LAN management · no login</Badge>
          <Badge variant="outline">On-demand metrics only</Badge>
        </div>
        <p className="text-muted-foreground text-sm">
          Termux controls run as this OS user. Never expose administrative actions to the public internet.
        </p>
        {error && <p role="alert">Host status unavailable; module navigation remains available.</p>}
        {host && (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Card>
              <CardHeader><CardDescription>Node runtime</CardDescription><CardTitle>{host.runtime.nodeVersion}</CardTitle></CardHeader>
              <CardContent className="text-muted-foreground text-xs">{host.runtime.architecture}</CardContent>
            </Card>
            <Card>
              <CardHeader><CardDescription>Free RAM</CardDescription><CardTitle>{host.runtime.freeMemoryMiB.toLocaleString()} MiB</CardTitle></CardHeader>
              <CardContent className="text-muted-foreground text-xs">System-wide</CardContent>
            </Card>
            <Card>
              <CardHeader><CardDescription>Free Termux storage</CardDescription><CardTitle>{host.runtime.storage ? host.runtime.storage.availableMiB.toLocaleString() + " MiB" : "Unavailable"}</CardTitle></CardHeader>
              <CardContent className="text-muted-foreground text-xs">Home filesystem</CardContent>
            </Card>
            <Card>
              <CardHeader><CardDescription>Observed services</CardDescription><CardTitle>{host.services.length}</CardTitle></CardHeader>
              <CardContent className="text-muted-foreground text-xs">External services are read-only</CardContent>
            </Card>
          </div>
        )}
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
