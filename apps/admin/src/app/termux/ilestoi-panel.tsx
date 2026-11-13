import * as React from "react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ileStoiDiagnosticSchema, type IleStoiDiagnostic } from "@/lib/ilestoi-diagnostic-schema"

export function IleStoiDiagnosticPanel({ refreshToken = 0 }: { refreshToken?: number }) {
  const [data, setData] = React.useState<IleStoiDiagnostic | null>(null)
  const [error, setError] = React.useState(false)
  const [loading, setLoading] = React.useState(true)
  React.useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    void fetch("/api/v1/termux-admin?mode=ilestoi-diagnostics", {
      method: "GET", cache: "no-store", credentials: "same-origin", signal: controller.signal,
    }).then(async response => {
      if (!response.ok) throw new Error("unavailable")
      return ileStoiDiagnosticSchema.parse(await response.json() as unknown)
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
        <CardTitle className="text-base">IleStoi / wreckscanner</CardTitle>
        <Badge variant="outline">Protected · read-only</Badge>
      </div>
    </CardHeader>
    <CardContent className="space-y-4 text-sm">
      {loading && <p role="status">Reading IleStoi diagnostics…</p>}
      {error && <p role="alert">IleStoi diagnostics unavailable. Refresh to retry; no services were changed.</p>}
      {data && !loading && <>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div><p className="text-muted-foreground text-xs">Runit status</p><p className="font-medium">{data.runit.state}</p></div>
          <div><p className="text-muted-foreground text-xs">Runit running time</p><p className="font-medium">{data.runit.uptimeSeconds === null ? "Unavailable" : data.runit.uptimeSeconds + " seconds"}</p></div>
          <div><p className="text-muted-foreground text-xs">Process</p><p className="font-medium">{data.process ? "PID " + data.process.pid + " · " + (data.process.name ?? "name unavailable") : "Unverified"}</p></div>
          <div><p className="text-muted-foreground text-xs">Process RSS</p><p className="font-medium">{data.process?.rssMiB === null || !data.process ? "Unavailable" : data.process.rssMiB + " MiB"}</p></div>
        </div>
        {data.process && <p className="text-muted-foreground text-xs">Runit-consistent PID / start ticks {data.process.startTicks}; this is not proof of PocketHost ownership.</p>}
        <p className="text-muted-foreground text-xs">Observed {new Date(data.observedAt).toLocaleString()} · {data.runit.error ? "Diagnostic: " + data.runit.error : "Runit observation received"}</p>
        <div className="rounded-md border p-3">
          <h3 className="font-medium">HTTP health · {data.health.state}</h3>
          <p className="text-muted-foreground text-xs">Verified IleStoi routes on {data.health.target}; HTTP response alone is not proof of process or service ownership.</p>
          {data.health.state === "unverified" && <p className="text-muted-foreground text-xs">Not probed: a consistent live runit PID was not confirmed.</p>}
          {data.health.live && <p>Liveness: {data.health.live.state} {data.health.live.statusCode === null ? "" : "(HTTP " + data.health.live.statusCode + ")"}</p>}
          {data.health.ready && <p>Readiness: {data.health.ready.state} {data.health.ready.statusCode === null ? "" : "(HTTP " + data.health.ready.statusCode + ")"}</p>}
          {(data.health.live?.error || data.health.ready?.error) && <p className="text-muted-foreground text-xs">HTTP diagnostic: {data.health.live?.error ?? "none"} / {data.health.ready?.error ?? "none"}</p>
        </div>
        <div className="rounded-md border p-3">
          <h3 className="font-medium">Recent service log · {data.logs.state}</h3>
          {data.logs.error && <p className="text-muted-foreground text-xs">Log diagnostic: {data.logs.error}</p>}
          {data.logs.state === "ok" && data.logs.lines.length === 0 && <p className="text-muted-foreground text-xs">No log lines.</p>}
          {data.logs.lines.length > 0 && <pre aria-label="Redacted IleStoi service log" className="mt-2 max-h-60 overflow-auto whitespace-pre-wrap break-all text-xs">{data.logs.lines.join("\n")}</pre>}
        </div>
        <p className="text-muted-foreground text-xs">Start, Stop, Restart and configuration changes are not authorized for this external service.</p>
      </>}
    </CardContent>
  </Card>
}
