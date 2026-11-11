import * as React from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { parseShizukuStatus, parseShizukuApps, parseShizukuSystem, type ShizukuStatus } from "@/lib/shizuku-schema"

type Probe = { latencyMs: number | null; message: string; observedAt?: string }
const endpoints = [
  { name: "Connection & CPU", url: "/api/v1/shizuku/status", parse: parseShizukuStatus, timeout: 8000 },
  { name: "Applications", url: "/api/v1/shizuku/apps", parse: parseShizukuApps, timeout: 25000 },
  { name: "Android system", url: "/api/v1/shizuku/system", parse: parseShizukuSystem, timeout: 15000 },
] as const

function localSample(value: string | undefined) {
  if (!value) return "Unavailable"
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? date.toLocaleString() : "Unavailable"
}

export function ShizukuDiagnosticsPanel() {
  const [status, setStatus] = React.useState<ShizukuStatus | null>(null)
  const [probes, setProbes] = React.useState<Record<string, Probe>>({})
  const [loading, setLoading] = React.useState(false)
  const [refresh, setRefresh] = React.useState(0)
  React.useEffect(() => {
    const controller = new AbortController()
    const investigate = async () => {
      setLoading(true)
      const result: Record<string, Probe> = {}
      await Promise.all(endpoints.map(async endpoint => {
        const started = performance.now()
        try {
          const response = await fetch(endpoint.url, {
            method: "GET", cache: "no-store", credentials: "same-origin",
            signal: AbortSignal.any([controller.signal, AbortSignal.timeout(endpoint.timeout)]),
          })
          if (!response.ok) throw new Error("HTTP " + response.status)
          const raw: unknown = await response.json()
          const parsed = endpoint.parse(raw as never)
          if (controller.signal.aborted) return
          if (endpoint.url.endsWith("/status")) setStatus(parsed as ShizukuStatus)
          result[endpoint.name] = {
            latencyMs: Math.round(performance.now() - started),
            message: "Available",
            observedAt: parsed.observedAt,
          }
        } catch (error) {
          if (!controller.signal.aborted) {
            result[endpoint.name] = {
              latencyMs: null, message: error instanceof Error ? error.message : "Unavailable",
            }
          }
        }
      }))
      if (!controller.signal.aborted) {
        setProbes(result)
        setLoading(false)
      }
    }
    void investigate()
    return () => controller.abort()
  }, [refresh])
  return <Card>
    <CardContent className="space-y-5 pt-4">
      <div className="space-y-1">
        <h2 className="font-medium">Shizuku connection diagnostics</h2>
        <p className="text-xs text-muted-foreground">
          Read-only checks run when this tab opens or when requested. No Android settings are changed.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-3">
        <Button size="sm" variant="outline" disabled={loading} onClick={() => setRefresh(current => current + 1)}>
          {loading ? "Checking…" : "Run diagnostics"}
        </Button>
      </div>
      <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
        {[
          ["Connection", !status ? "Not checked" : status.connected && status.authorized ? "Connected and authorized" : "Not authorized"],
          ["Shizuku mode", status?.mode?.toUpperCase() ?? "Unknown"],
          ["Android UID", status?.uid == null ? "Not reported" : String(status.uid)],
          ["Last verified sample", localSample(status?.observedAt)],
          ["Data source", status?.source ?? "Unavailable"],
        ].map(([label, value]) => <div key={label} className="min-w-0 space-y-1">
          <dt className="text-muted-foreground">{label}</dt><dd className="mt-1 break-words font-medium">{value}</dd>
        </div>)}
      </dl>
      <p className="text-xs text-muted-foreground">ADB / UID 2000 indicates Android shell permissions, not root access.</p>
      <div className="space-y-2 border-t pt-4">
        <h3 className="font-medium text-sm">API checks</h3>
        <p className="text-xs text-muted-foreground">Response times for three independent read-only requests; not network or CPU performance.</p>
        {endpoints.map(endpoint => {
          const observation = probes[endpoint.name]
          return <div key={endpoint.name} className="flex flex-wrap justify-between gap-2 border-b border-border/50 py-2 text-sm last:border-b-0">
            <span>{endpoint.name}</span>
            <span role="status" className="text-muted-foreground">
              {observation ? observation.message +
                (observation.latencyMs == null ? "" : " · " + observation.latencyMs + " ms") :
                loading ? "Checking…" : "Not checked"}
            </span>
          </div>
        })}
      </div>
      <section className="space-y-2 border-t pt-4" aria-label="Native capabilities">
        <h3 className="text-sm font-medium">Native capabilities ({status?.capabilities?.length ?? 0})</h3>
        {status?.capabilities?.length ? <ul className="divide-y divide-border/50">
          {status.capabilities.map(capability => <li key={capability.id}
            className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 py-2 text-sm">
            <div className="min-w-0">
              <p className="font-medium">{capability.title}</p>
              <p className="text-xs text-muted-foreground">{capability.description}</p>
            </div>
            <span className="text-xs text-muted-foreground">
              {capability.available ? "Available" : "Unavailable"}
            </span>
          </li>)}
        </ul> : <p className="text-muted-foreground text-sm">No authorized capability report.</p>}
      </section>
    </CardContent>
  </Card>
}
