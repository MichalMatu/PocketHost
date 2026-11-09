import * as React from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { parseShizukuStatus, parseShizukuApps, parseShizukuSystem, type ShizukuStatus } from "@/lib/shizuku-schema"

type Probe = { latencyMs: number | null; message: string; observedAt?: string }
const endpoints = [
  { name: "Connection & CPU", url: "/api/v1/shizuku/status", parse: parseShizukuStatus, timeout: 8000 },
  { name: "Applications", url: "/api/v1/shizuku/apps", parse: parseShizukuApps, timeout: 25000 },
  { name: "Android system", url: "/api/v1/shizuku/system", parse: parseShizukuSystem, timeout: 15000 },
] as const

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
    <CardHeader>
      <CardTitle>Shizuku diagnostics & capabilities</CardTitle>
      <CardDescription>Live Android bridge, Binder identity and request times; no assumed root permissions.</CardDescription>
    </CardHeader>
    <CardContent className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm">ADB is UID 2000; root is UID 0. Android may deny individual actions.</p>
        <Button size="sm" variant="outline" disabled={loading} onClick={() => setRefresh(current => current + 1)}>
          {loading ? "Checking…" : "Run diagnostics"}
        </Button>
      </div>
      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 text-sm">
        {[
          ["Connection", status?.connected && status.authorized ? "Connected and authorized" : "Not authorized"],
          ["Shizuku mode", status?.mode?.toUpperCase() ?? "Unknown"],
          ["Real Android UID", status?.uid == null ? "Not reported" : String(status.uid)],
          ["Last verified sample", status?.observedAt ?? "Unavailable"],
          ["Companion source", status?.source ?? "Unavailable"],
          ["Observed capabilities", String(status?.capabilities?.length ?? 0)],
        ].map(([label, value]) => <div key={label} className="rounded-lg border p-3">
          <dt className="text-muted-foreground">{label}</dt><dd className="mt-1 break-words font-medium">{value}</dd>
        </div>)}
      </dl>
      <div className="space-y-2">
        <p className="font-medium text-sm">API round trips</p>
        {endpoints.map(endpoint => {
          const observation = probes[endpoint.name]
          return <div key={endpoint.name} className="flex flex-wrap justify-between gap-2 rounded-md border p-3 text-sm">
            <span>{endpoint.name}</span>
            <span role="status" className="text-muted-foreground">
              {observation ? observation.message +
                (observation.latencyMs == null ? "" : " · " + observation.latencyMs + " ms") :
                loading ? "Checking…" : "Not checked"}
            </span>
          </div>
        })}
      </div>
      <div className="space-y-2">
        <p className="font-medium text-sm">Reported native capabilities</p>
        {status?.capabilities?.length ? status.capabilities.map(capability => (
          <div key={capability.id} className="rounded-md border p-3 text-sm">
            <p className="font-medium">{capability.title} · {capability.available ? "Available" : "Unavailable"}</p>
            <p className="text-muted-foreground text-xs">{capability.description}</p>
          </div>
        )) : <p className="text-muted-foreground text-sm">No authorized capability report.</p>}
      </div>
    </CardContent>
  </Card>
}
