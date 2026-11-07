import * as React from "react"
import { Activity, Battery, Cpu, HardDrive, Network, RefreshCw, ShieldCheck } from "lucide-react"
import { BaseLayout } from "@/components/layouts/base-layout"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { parseObservabilitySnapshot, type ObservabilitySnapshot } from "@/lib/observability-schema"

const endpoint = "/api/v1/observability"
const unavailable = "Read-only observations are unavailable. Existing services have not been changed."

async function loadSnapshot(signal?: AbortSignal): Promise<ObservabilitySnapshot> {
  const response = await fetch(endpoint, {
    method: "GET", cache: "no-store", credentials: "same-origin", signal,
  })
  if (!response.ok) throw new Error("Observability endpoint unavailable")
  const payload: unknown = await response.json()
  return parseObservabilitySnapshot(payload)
}

function Metric({ label, value, detail, icon: Icon }: {
  label: string
  value: string
  detail: string
  icon: typeof Cpu
}) {
  return (
    <Card>
      <CardHeader className="gap-1">
        <CardDescription className="flex items-center gap-2"><Icon className="size-4" />{label}</CardDescription>
        <CardTitle className="text-2xl">{value}</CardTitle>
      </CardHeader>
      <CardContent className="text-muted-foreground text-xs">{detail}</CardContent>
    </Card>
  )
}

export default function ObservabilityPage() {
  const [snapshot, setSnapshot] = React.useState<ObservabilitySnapshot | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const refresh = React.useCallback(async (signal?: AbortSignal) => {
    setLoading(true)
    try {
      const data = await loadSnapshot(signal)
      if (signal?.aborted) return
      setSnapshot(data)
      setError(null)
    } catch {
      if (!signal?.aborted) setError(unavailable)
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [])
  React.useEffect(() => {
    const controller = new AbortController()
    // The first load is an external request, not a synchronous state
    // transition caused by the effect. Manual Refresh owns its loading state.
    void loadSnapshot(controller.signal)
      .then((data) => {
        if (controller.signal.aborted) return
        setSnapshot(data)
        setError(null)
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(unavailable)
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [])
  const cpu = snapshot?.metrics.cpuPercent
  const battery = snapshot?.metrics.batteryPercent
  const network = snapshot?.metrics.network
  const history = snapshot?.history ?? []

  return (
    <BaseLayout title="Observability" description="On-demand Samsung / Termux readings, no service control">
      <div className="flex flex-col gap-5 px-4 pb-8 lg:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Badge variant="outline"><ShieldCheck className="size-3" />Read only · sampled on request</Badge>
          <Button variant="outline" disabled={loading} onClick={() => void refresh()}>
            <RefreshCw className={loading ? "size-4 animate-spin" : "size-4"} /> Refresh
          </Button>
        </div>
        {error && <p role="alert" className="text-destructive text-sm">{error}</p>}
        {!snapshot && loading && <p role="status">Reading this phone…</p>}
        {snapshot && (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Metric label="CPU utilization" icon={Cpu}
                value={cpu?.state === "ok" ? `${cpu.value?.toFixed(1)}%` : "Unavailable"}
                detail={cpu?.state === "ok" ? "System-wide sampled delta" : cpu?.state ?? "unavailable"} />
              <Metric label="Available RAM" icon={Activity}
                value={`${snapshot.host.runtime.freeMemoryMiB.toLocaleString()} MiB`}
                detail={`of ${snapshot.host.runtime.totalMemoryMiB.toLocaleString()} MiB · system-wide`} />
              <Metric label="Free Termux storage" icon={HardDrive}
                value={snapshot.host.runtime.storage ? `${snapshot.host.runtime.storage.availableMiB.toLocaleString()} MiB` : "Unavailable"}
                detail={snapshot.host.runtime.storage ? "Termux home filesystem" : "No permitted storage reading"} />
              <Metric label="Battery" icon={Battery}
                value={battery?.state === "ok" ? `${battery.value}%` : "Unavailable"}
                detail={battery?.state === "ok" ? "Android sysfs reading" : battery?.state ?? "unavailable"} />
            </div>
            <div className="grid gap-4 xl:grid-cols-2">
              <Card>
                <CardHeader><CardTitle>CPU history</CardTitle>
                  <CardDescription>Last {history.length} on-demand samples, session memory only</CardDescription></CardHeader>
                <CardContent>
                  <div aria-label="CPU sample history" className="flex h-28 items-end gap-1" role="img">
                    {history.map((point, index) => (
                      <div key={index} title={`${point.observedAt}: ${point.cpuPercent ?? "unavailable"}%`}
                        className={point.cpuPercent === null ? "bg-muted flex-1" : "bg-primary/70 flex-1 rounded-t"}
                        style={{ height: `${Math.max(4, point.cpuPercent ?? 4)}%` }} />
                    ))}
                  </div>
                  <p className="text-muted-foreground mt-2 text-xs">Missing readings are shown as muted markers, never zero.</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle><Network className="inline size-4" /> Network and alerts</CardTitle>
                  <CardDescription>{network?.state === "ok" && network.value
                    ? `Counters: RX ${network.value.rxBytes.toLocaleString()} / TX ${network.value.txBytes.toLocaleString()} bytes`
                    : `Network counters: ${network?.state ?? "unavailable"}`}</CardDescription></CardHeader>
                <CardContent>
                  {snapshot.alerts.length
                    ? <ul className="space-y-1 text-sm" aria-label="Observation alerts">{snapshot.alerts.map((alert) => <li key={alert}>• {alert}</li>)}</ul>
                    : <p className="text-muted-foreground text-sm">No observation alerts</p>}
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>Observed processes</CardTitle>
                  <CardDescription>{snapshot.processes.state} · partial Android /proc view · PID + start ticks</CardDescription></CardHeader>
                <CardContent className="max-h-80 overflow-auto">
                  <table className="w-full text-left text-xs">
                    <thead><tr className="border-b"><th>PID / PPID</th><th>Start ticks</th><th>CPU ticks</th><th>RAM</th><th>Identity</th></tr></thead>
                    <tbody>{snapshot.processes.processes.map((p) => (
                      <tr key={`${p.pid}:${p.startTicks}`} className="border-b">
                        <td className="py-2">{p.pid} / {p.ppid}</td><td>{p.startTicks}</td><td>{p.cpuTicks}</td>
                        <td>{p.rssMiB === null ? "—" : `${p.rssMiB} MiB`}</td><td>{p.ownership}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                  <p className="text-muted-foreground mt-2 text-xs">{snapshot.processes.truncated ? "Limited to 96 entries. " : ""}Unverified does not grant process control.</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>Installed packages</CardTitle>
                  <CardDescription>{snapshot.packages.state} · {snapshot.packages.updates.state} update metadata</CardDescription></CardHeader>
                <CardContent className="max-h-80 overflow-auto text-xs">
                  <div className="space-y-1">{snapshot.packages.installed.map((p) => (
                    <div className="flex justify-between gap-3 border-b py-1" key={`${p.ecosystem}:${p.name}`}>
                      <span>{p.name} <span className="text-muted-foreground">({p.ecosystem})</span></span><span>{p.version}</span>
                    </div>
                  ))}</div>
                  <p className="text-muted-foreground mt-2">{snapshot.packages.truncated ? "Package list limited to first 48. " : ""}
                    {snapshot.packages.updates.candidates.length ? `Cached candidates: ${snapshot.packages.updates.candidates.join(", ")}` : "No verified update status available."}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>Service status</CardTitle><CardDescription>Six external services · never managed or signalled</CardDescription></CardHeader>
                <CardContent className="space-y-2 text-sm">{snapshot.host.services.map((s) => (
                  <div className="flex justify-between gap-3" key={s.id}><span>{s.label}</span><Badge variant="secondary">{s.state}</Badge></div>
                ))}</CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>Runtime diagnostics</CardTitle>
                  <CardDescription>Existing managed event history · {snapshot.diagnostics.state} · recovery remains manual</CardDescription></CardHeader>
                <CardContent>
                  {snapshot.diagnostics.events.length === 0
                    ? <p className="text-muted-foreground text-sm">No structured events in the permitted history.</p>
                    : <ul className="space-y-2 text-xs">{snapshot.diagnostics.events.map((e, i) => (
                      <li key={i} className="border-b pb-2">{e.timestamp} · {e.instanceId} · {e.code}</li>
                    ))}</ul>}
                </CardContent>
              </Card>
            </div>
            <p className="text-muted-foreground text-xs">Observed {snapshot.observedAt}. A successful observation is not authority to control a process. No background sampling, package modification or automatic recovery.</p>
          </>
        )}
      </div>
    </BaseLayout>
  )
}
