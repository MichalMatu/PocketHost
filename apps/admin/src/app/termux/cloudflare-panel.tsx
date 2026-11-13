import * as React from "react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cloudflareTunnelSchema, type CloudflareTunnelDiagnostic } from "@/lib/cloudflare-tunnel-schema"

export function CloudflareTunnelPanel({ refreshToken = 0 }: { refreshToken?: number }) {
  const [data, setData] = React.useState<CloudflareTunnelDiagnostic | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState(false)
  React.useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    void fetch("/api/v1/termux-admin?mode=cloudflare-diagnostics", {
      method: "GET", credentials: "same-origin", cache: "no-store", signal: controller.signal,
    }).then(async response => {
      if (!response.ok) throw Error("unavailable")
      return cloudflareTunnelSchema.parse(await response.json() as unknown)
    }).then(value => {
      if (!controller.signal.aborted) { setData(value); setError(false); setLoading(false) }
    }).catch(() => {
      if (!controller.signal.aborted) { setData(null); setError(true); setLoading(false) }
    })
    return () => controller.abort()
  }, [refreshToken])
  return <Card>
    <CardHeader>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <CardTitle className="text-base">Cloudflare Tunnel / cloudflared</CardTitle>
        <Badge variant="outline">Protected · read-only</Badge>
      </div>
    </CardHeader>
    <CardContent className="space-y-3 text-sm">
      {loading && <p role="status">Reading Cloudflare Tunnel diagnostics…</p>}
      {error && <p role="alert">Cloudflare Tunnel diagnostics unavailable. No services were changed.</p>}
      {data && !loading && <>
        <div className="grid gap-3 sm:grid-cols-3">
          <div><p className="text-xs text-muted-foreground">Runit status</p><p>{data.runit.state} · {data.runit.uptimeSeconds === null ? "uptime unavailable" : data.runit.uptimeSeconds + "s"}</p></div>
          <div><p className="text-xs text-muted-foreground">Process</p><p>{data.process ? "PID " + data.process.pid + " · RSS " + (data.process.rssMiB === null ? "unavailable" : data.process.rssMiB + " MiB") : "Unverified"}</p></div>
          <div><p className="text-xs text-muted-foreground">Connections</p><p>Unverified · last log event: {data.connections.lastEvent}</p></div>
        </div>
        {data.runit.error && <p className="text-xs text-muted-foreground">Runit diagnostic: {data.runit.error}</p>}
        <p className="text-xs text-muted-foreground">Runit and historical log registrations are not proof of active Cloudflare edge connections or PocketHost ownership.</p>
        <div className="space-y-2 rounded-md border p-3">
          <h3 className="font-medium">Tunnel configuration · {data.config.state}</h3>
          {data.config.error && <p className="text-xs text-muted-foreground">Config diagnostic: {data.config.error}</p>}
          {data.config.state === "ok" && <p className="text-xs text-muted-foreground">
            Tunnel declared: {data.config.tunnelDeclared ? "yes" : "no"} ·
            Credential reference declared: {data.config.credentialsFileDeclared ? "yes" : "no"}
          </p>}
          {data.config.ingress.length === 0 && <p className="text-xs text-muted-foreground">No verified domain routes in the available configuration.</p>}
          {data.config.ingress.map(route => <div key={route.hostname} className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 py-1">
            <span>{route.hostname}</span><Badge variant="outline">{route.backend}</Badge>
          </div>)}
          {data.config.truncated && <p className="text-xs text-muted-foreground">Only the first 12 validated hostnames are shown.</p>}
        </div>
        <div className="space-y-2 rounded-md border p-3">
          <h3 className="font-medium">Recent classified log events · {data.logs.state}</h3>
          {data.logs.error && <p className="text-xs text-muted-foreground">Log diagnostic: {data.logs.error}</p>}
          {data.logs.events.length === 0 && <p className="text-xs text-muted-foreground">No classified events available.</p>}
          {data.logs.events.map((event, index) => <div key={index} className="flex flex-wrap justify-between gap-2 text-xs">
            <span>{event.kind}</span><span>{event.timestamp ? new Date(event.timestamp).toLocaleString() : "time unavailable"}</span>
          </div>)}
          <p className="text-xs text-muted-foreground">Only event types and verified timestamps are exposed; raw logs and credential values stay on the device.</p>
        </div>
        <p className="text-xs text-muted-foreground">Control and configuration changes remain disabled until separate service-specific authorization.</p>
      </>}
    </CardContent>
  </Card>
}
