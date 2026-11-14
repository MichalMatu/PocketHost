import * as React from "react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { protectedServiceSchema, type ProtectedServiceDiagnostic } from "@/lib/protected-service-schema"

type Service = ProtectedServiceDiagnostic["service"]
const PANELS = [
  { service: "sshd", title: "SSH / sshd", mode: "ssh-diagnostics" },
  { service: "mosquitto", title: "Mosquitto / MQTT", mode: "mqtt-diagnostics" },
  { service: "ilestoi-healthwatch", title: "IleStoi / healthwatch", mode: "healthwatch-diagnostics" },
] as const

function ServiceCard({ service, title, mode, refreshToken }: {
  service: Service; title: string; mode: string; refreshToken: number
}) {
  const [data, setData] = React.useState<ProtectedServiceDiagnostic | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState(false)
  React.useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setData(null)
    void fetch("/api/v1/termux-admin?mode=" + mode, {
      method: "GET", credentials: "same-origin", cache: "no-store", signal: controller.signal,
    }).then(async response => {
      if (!response.ok) throw Error("diagnostics-unavailable")
      const value = protectedServiceSchema.parse(await response.json() as unknown)
      if (value.service !== service) throw Error("service-mismatch")
      return value
    }).then(value => {
      if (!controller.signal.aborted) { setData(value); setLoading(false); setError(false) }
    }).catch(() => {
      if (!controller.signal.aborted) { setData(null); setLoading(false); setError(true) }
    })
    return () => controller.abort()
  }, [service, mode, refreshToken])

  return <Card>
    <CardHeader>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <CardTitle className="text-base">{title}</CardTitle>
        <Badge variant="outline">Protected · read-only</Badge>
      </div>
    </CardHeader>
    <CardContent className="space-y-3 text-sm">
      {loading && <p role="status">Reading {title} diagnostics…</p>}
      {error && <p role="alert">{title} diagnostics unavailable. No service changes were made.</p>}
      {data && !loading && <>
        <div className="grid gap-3 sm:grid-cols-3">
          <div><p className="text-xs text-muted-foreground">Runit</p><p>{data.runit.state} · {data.runit.uptimeSeconds === null ? "uptime unavailable" : data.runit.uptimeSeconds + "s"}</p></div>
          <div><p className="text-xs text-muted-foreground">Process</p><p>{data.process ? "PID " + data.process.pid + " · RSS " + (data.process.rssMiB === null ? "unavailable" : data.process.rssMiB + " MiB") : "Unverified"}</p></div>
          <div><p className="text-xs text-muted-foreground">Application health</p><p>Unverified · runit is not a health check</p></div>
        </div>
        {data.runit.error && <p className="text-xs text-muted-foreground">Runit diagnostic: {data.runit.error}</p>}
        {data.process && <p className="text-xs text-muted-foreground">PID/start-ticks {data.process.startTicks} checked twice against runit; not ownership evidence.</p>}
        <div className="rounded-md border p-3 space-y-1">
          <h3 className="font-medium">Configuration summary · {data.config.state}</h3>
          <p className="text-xs text-muted-foreground">Fixed local config file only; settings may be overridden and are not proof of active runtime configuration.</p>
          {data.config.error && <p className="text-xs text-muted-foreground">Config diagnostic: {data.config.error}</p>}
          {data.config.settings.map((item, index) => <p key={index}>{item.name}: {item.value}</p>)}
          {data.config.truncated && <p className="text-xs text-muted-foreground">Configuration summary truncated.</p>}
          {data.config.settings.length === 0 && <p className="text-xs text-muted-foreground">No allowlisted settings available.</p>}
        </div>
        <div className="rounded-md border p-3 space-y-1">
          <h3 className="font-medium">Sanitized service log events · {data.logs.state}</h3>
          <p className="text-xs text-muted-foreground">Only event categories and timestamps are shown; no raw log lines, IP addresses or credentials.</p>
          {data.logs.error && <p className="text-xs text-muted-foreground">Log diagnostic: {data.logs.error}</p>}
          {data.logs.events.length === 0 && <p className="text-xs text-muted-foreground">No readable recognized log events.</p>}
          {data.logs.events.map((event, index) => <p key={index}>{event.kind} · {event.timestamp ? new Date(event.timestamp).toLocaleString() : "time unavailable"}</p>)}
        </div>
        {data.lastCheck && <p className="text-xs text-muted-foreground">Healthwatch last completed check: unverified; no independent check source available.</p>}
        <p className="text-xs text-muted-foreground">Observed {new Date(data.observedAt).toLocaleString()}. Protected external service; start, stop, restart and configuration changes are not authorized.</p>
      </>}
    </CardContent>
  </Card>
}

/** Each dedicated page queries only its own protected service. */
export function ProtectedServicePanel({ service, refreshToken = 0 }: {
  service: Service; refreshToken?: number
}) {
  const entry = PANELS.find(item => item.service === service)
  return entry ? <ServiceCard {...entry} refreshToken={refreshToken} /> : null
}

export function ProtectedServicePanels({ refreshToken = 0 }: { refreshToken?: number }) {
  return <>{PANELS.map(item => <ServiceCard key={item.service} {...item} refreshToken={refreshToken} />)}</>
}
