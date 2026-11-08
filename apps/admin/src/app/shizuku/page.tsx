import * as React from "react"
import { Activity, AppWindow, Battery, Cpu, ExternalLink, LockKeyhole, RefreshCw, Settings2, Shield, Smartphone, Terminal } from "lucide-react"
import { Link } from "react-router-dom"
import { BaseLayout } from "@/components/layouts/base-layout"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { parseShizukuStatus, type ShizukuStatus } from "@/lib/shizuku-schema"

const modules = [
  { title: "CPU & Android processes", detail: "System-wide CPU samples, process list and performance", icon: Cpu },
  { title: "Applications", detail: "Installed applications, package operations and app details", icon: AppWindow },
  { title: "Permissions", detail: "Android permission inspection and grants within actual privileges", icon: LockKeyhole },
  { title: "Services & settings", detail: "Android services, device settings and system diagnostics", icon: Settings2 },
  { title: "Advanced shell", detail: "Owner-directed commands with real ADB or root access", icon: Terminal },
  { title: "Power & hardware", detail: "Battery, thermal and hardware-level signals", icon: Battery },
]

const endpoint = "/api/v1/shizuku/status"

/** The browser never infers Shizuku authorization from installation alone. */
async function readShizuku(signal?: AbortSignal): Promise<ShizukuStatus> {
  const res = await fetch(endpoint, { method: "GET", cache: "no-store", credentials: "same-origin", signal })
  if (!res.ok) throw new Error("Native companion status unavailable")
  return parseShizukuStatus(await res.json() as unknown)
}

export default function ShizukuPage() {
  const [status, setStatus] = React.useState<ShizukuStatus | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [refreshKey, setRefreshKey] = React.useState(0)
  React.useEffect(() => {
    const controller = new AbortController()
    void readShizuku(controller.signal)
      .then(value => { if (!controller.signal.aborted) setStatus(value) })
      .catch(() => { if (!controller.signal.aborted) setStatus(null) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [refreshKey])

  const usable = status?.connected === true && status.authorized === true

  return (
    <BaseLayout title="Android & Shizuku" description="Full Android telemetry and power-user controls">
      <div className="space-y-5 px-4 pb-8 lg:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline"><Smartphone className="size-3" /> Android</Badge>
            <Badge variant="outline"><Shield className="size-3" /> Shizuku-backed access</Badge>
          </div>
          <Button variant="outline" size="sm" disabled={loading} onClick={() => { setLoading(true); setRefreshKey(v => v + 1) }}>
            <RefreshCw className={loading ? "size-4 animate-spin" : "size-4"} /> Refresh status
          </Button>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="min-h-36">
            <CardHeader><CardDescription>Bridge & authorization</CardDescription>
              <CardTitle>{loading ? "Checking…" : usable ? "Connected" : status?.connected ? "Authorization needed" : "Companion unavailable"}</CardTitle></CardHeader>
            <CardContent className="text-muted-foreground text-xs">{usable ? `Shizuku ${status.mode} session · verified via companion` : "Installed Shizuku alone does not authorize PocketHost. Native bridge required."}</CardContent>
          </Card>
          <Card className="min-h-36">
            <CardHeader><CardDescription>Android CPU utilization</CardDescription>
              <CardTitle>{loading ? "Checking…" : usable && status?.cpuPercent != null ? `${status.cpuPercent.toFixed(1)}%` : "Unavailable"}</CardTitle></CardHeader>
            <CardContent className="text-muted-foreground text-xs">Full-device reading from authorized companion, never guessed from Termux</CardContent>
          </Card>
          <Card className="min-h-36">
            <CardHeader><CardDescription>Android-visible processes</CardDescription>
              <CardTitle>{loading ? "Checking…" : usable && status?.visibleProcesses != null ? status.visibleProcesses : "Unavailable"}</CardTitle></CardHeader>
            <CardContent className="text-muted-foreground text-xs">Requires real Shizuku integration</CardContent>
          </Card>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-medium">Android capabilities</h2>
            <p className="text-muted-foreground text-sm">Actual controls appear as the companion exposes and authorizes them. No artificial product feature ceiling.</p>
          </div>
          <Button variant="outline" size="sm" render={<Link to="/observability" />}>Termux-only monitoring</Button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {modules.map(({ title, detail, icon: Icon }) => (
            <Card key={title} className="min-h-36">
              <CardHeader><CardTitle className="flex items-center gap-2"><Icon className="size-4" />{title}</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                <p className="text-muted-foreground text-sm">{detail}</p>
                <p className="text-muted-foreground text-xs">{usable ? "Companion connected · capability integration in progress" : "Awaiting PocketHost Companion authorization"}</p>
              </CardContent>
            </Card>
          ))}
        </div>
        {usable && status.capabilities.length > 0 && (
          <Card>
            <CardHeader><CardTitle>Companion capability discovery</CardTitle>
              <CardDescription>Real capabilities reported by the authorized Android companion</CardDescription></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {status.capabilities.map(c => (
                <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 border-b py-2">
                  <span>{c.title} <span className="text-muted-foreground">— {c.description}</span></span>
                  <Badge variant="outline">{c.available ? "Available" : "Not available"}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
        {!usable && (
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Activity className="size-4" /> Native Shizuku connection</CardTitle>
              <CardDescription>Why the Android dashboard is not yet showing full CPU data</CardDescription></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>Shizuku Manager and its server were verified on this Samsung through ADB. The PocketHost Android Companion is not yet connected to the browser, so no privileged readings or controls are claimed here.</p>
              <p>Once the native companion requests and receives Shizuku permission, this page will read its real status and telemetry. Root-only actions remain root-only.</p>
              <a className="inline-flex items-center gap-2 underline underline-offset-4" href="https://shizuku.rikka.app/guide/setup/" target="_blank" rel="noreferrer">
                Shizuku setup guide <ExternalLink className="size-4" />
              </a>
            </CardContent>
          </Card>
        )}
      </div>
    </BaseLayout>
  )
}
