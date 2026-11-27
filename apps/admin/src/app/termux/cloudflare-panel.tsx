import * as React from "react"
import { Link } from "react-router-dom"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cloudflareTunnelSchema, type CloudflareTunnelDiagnostic } from "@/lib/cloudflare-tunnel-schema"

export function CloudflareTunnelPanel({ refreshToken = 0 }: { refreshToken?: number }) {
  const [data, setData] = React.useState<CloudflareTunnelDiagnostic | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState(false)
  React.useEffect(() => {
    const controller = new AbortController()
    void Promise.resolve().then(() => {
      if (!controller.signal.aborted) setLoading(true)
    })
    void fetch("/api/v1/termux-admin?mode=cloudflare-diagnostics", {
      method: "GET", credentials: "same-origin", cache: "no-store",
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10_000)]),
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
  const binary = data?.binary?.state ?? "unverified"
  const hasConfig = data?.config.state === "ok" &&
    data.config.tunnelDeclared && data.config.credentialsFileDeclared
  const hasService = data?.runit.state === "running" || data?.runit.state === "stopped"
  const localReady = binary === "available" && hasConfig && hasService
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
        <section aria-label="Existing external Cloudflare connector" className="space-y-2 rounded-md border p-3">
          <h3 className="font-medium">Shared tunnel · connector on another host</h3>
          <p className="text-xs text-muted-foreground">
            A tunnel running on another device in the LAN can route a separate public hostname
            to a hosted application on this device. A second cloudflared process or copy of
            tunnel credentials is not needed on A8.
          </p>
          <p className="text-xs text-muted-foreground">
            Preserve the remote connector's current origin. Once a specific application is ready,
            add a hostname-specific ingress rule there and a DNS route to that same tunnel.
            Do not route the unauthenticated PocketHost admin panel to the public Internet.
          </p>
          <p className="text-xs text-muted-foreground">
            Remote tunnel connections and DNS are not observable from this A8-only page.
            The diagnostics below describe only the optional local A8 connector.
          </p>
        </section>
        <section aria-label="Cloudflare setup readiness" className="space-y-3 rounded-md border p-3">
          <h3 className="font-medium">
            {localReady ? "Local A8 connector detected · edge unverified" : "Local A8 connector not configured (optional)"}
          </h3>
          <div className="grid gap-2 text-sm sm:grid-cols-3">
            <div>
              <p className="text-xs text-muted-foreground">cloudflared binary</p>
              <strong>{binary === "available" ? "Installed" :
                binary === "missing" ? "Not installed" : "Not verified"}</strong>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Named tunnel configuration</p>
              <strong>{hasConfig ? "Declared" :
                data.config.state !== "ok" ? "Not available" : "Incomplete"}</strong>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Service registration</p>
              <strong>{hasService ? "Detected" : "Not verified"}</strong>
            </div>
          </div>
          {!localReady && <>
            <p className="text-xs text-muted-foreground">
              This optional local connector is not set up. If you use a remote
              LAN connector instead, there is no need to install tunnel credentials on A8.
            </p>
            <p className="text-xs text-muted-foreground">
              To use a local connector instead, review{" "}
              <Link to="/packages" className={buttonVariants({ variant: "link" })}>
                Packages & Software
              </Link>{" "}
              and configure it as a separately authorized service.
              Do not duplicate an existing remote connector by default.
            </p>
          </>}
          <p className="text-xs text-muted-foreground">
            A running process or earlier registration log does not prove a live Cloudflare connection.
            No public route is created by this screen.
          </p>
        </section>
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
        <p className="text-xs text-muted-foreground">This page reports only local state. Installation, credentials, ingress changes and tunnel lifecycle are not performed automatically.</p>
      </>}
    </CardContent>
  </Card>
}
