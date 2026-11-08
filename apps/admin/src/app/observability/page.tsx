import * as React from "react"
import { Activity, Battery, Cpu, HardDrive, Info, Network, RefreshCw, ShieldCheck } from "lucide-react"
import { BaseLayout } from "@/components/layouts/base-layout"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { formatMemory } from "@/lib/format-memory"
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

function Metric({ label, value, detail, icon: Icon, pending }: {
  label: string
  value: string
  detail: string
  icon: typeof Cpu
  pending?: boolean
}) {
  return (
    <Card className="min-h-36">
      <CardHeader className="gap-1">
        <CardDescription className="flex items-center gap-2"><Icon className="size-4" />{label}</CardDescription>
        <CardTitle className="text-2xl">
          {pending
            ? <span aria-label="Loading" className="block h-7 w-28 max-w-full animate-pulse rounded bg-muted" />
            : value}
        </CardTitle>
      </CardHeader>
      <CardContent className="text-muted-foreground min-h-4 text-xs">{pending ? "\u00a0" : detail}</CardContent>
    </Card>
  )
}

function AccessInfoDialog() {
  return (
    <Dialog>
      <DialogTrigger render={<Button variant="outline" size="sm" className="h-7 rounded-full px-3 text-xs" />}>
        <Info className="size-3.5" /> Access info
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Android metric access</DialogTitle>
          <DialogDescription>What PocketHost can read on this Samsung</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <p><strong>CPU:</strong> Android denies access to system-wide CPU counters.
            There is no normal permission switch that PocketHost can open to grant this access.
            The panel shows accessible Termux process counters instead, not a fabricated CPU percentage.</p>
          <p><strong>Battery:</strong> Termux:API is installed and the battery was readable over SSH.
            If the panel still says Unavailable, the PocketHost backend needs to reload its
            Termux:API fallback. Android app permissions can be reviewed manually in
            Settings → Apps → Termux:API.</p>
          <p className="text-muted-foreground text-xs">No root access, device settings changes or service control are performed here.</p>
        </div>
      </DialogContent>
    </Dialog>
  )
}

const panelTitles = [
  "CPU and process activity", "Network and alerts", "Observed processes",
  "Installed packages", "Service status", "Runtime diagnostics",
] as const

function PendingPanels({ pending }: { pending: boolean }) {
  return (
    <div className="grid gap-4 xl:grid-cols-2" aria-busy={pending} data-testid="observability-panels">
      {panelTitles.map((title) => (
        <Card key={title} className="min-h-52">
          <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
          <CardContent className="min-h-28">
            {pending
              ? <div aria-label="Loading" className="space-y-3">
                  <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
                  <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
                </div>
              : <p className="text-muted-foreground text-sm">Unavailable</p>}
          </CardContent>
        </Card>
      ))}
    </div>
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
  const hasCpuHistory = history.some((point) => point.cpuPercent !== null)
  const topProcessSamples = [...(snapshot?.processes.processes ?? [])]
    .sort((a, b) => b.cpuTicks - a.cpuTicks)
    .slice(0, 5)
  const cpuAvailable = cpu?.state === "ok"
  const processAvailable = snapshot?.processes.state === "ok"

  return (
    <BaseLayout title="Observability" description="On-demand Samsung / Termux readings, no service control">
      <div className="flex flex-col gap-5 px-4 pb-8 lg:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline"><ShieldCheck className="size-3" />Read only · sampled on request</Badge>
            <AccessInfoDialog />
          </div>
          <Button variant="outline" disabled={loading} onClick={() => void refresh()}>
            <RefreshCw className={loading ? "size-4 animate-spin" : "size-4"} /> Refresh
          </Button>
        </div>
        {error && <p role="alert" className="text-destructive text-sm">{error}</p>}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-busy={loading && !snapshot} data-testid="observability-metrics">
          <Metric label={cpuAvailable ? "CPU utilization" : "Termux processes"} icon={Cpu} pending={loading && !snapshot}
            value={cpuAvailable ? `${cpu.value?.toFixed(1)}%` : processAvailable ? String(snapshot?.processes.processes.length ?? 0) : "Restricted"}
            detail={cpuAvailable ? "System-wide CPU sample" : processAvailable ? "Accessible processes · system CPU restricted" : "Android restricts CPU sampling · Access info"} />
          <Metric label="Available RAM" icon={Activity} pending={loading && !snapshot}
            value={snapshot ? formatMemory(snapshot.host.runtime.freeMemoryMiB) : "Unavailable"}
            detail={snapshot ? `of ${formatMemory(snapshot.host.runtime.totalMemoryMiB)} · system-wide` : "unavailable"} />
          <Metric label="Free Termux storage" icon={HardDrive} pending={loading && !snapshot}
            value={snapshot?.host.runtime.storage ? formatMemory(snapshot.host.runtime.storage.availableMiB) : "Unavailable"}
            detail={snapshot?.host.runtime.storage ? "Termux home filesystem" : "No permitted storage reading"} />
          <Metric label="Battery" icon={Battery} pending={loading && !snapshot}
            value={battery?.state === "ok" ? `${battery.value}%` : "Unavailable"}
            detail={battery?.state === "ok" ? "Termux:API or Android reading" : `${battery?.state ?? "unavailable"} · Access info`} />
        </div>
        {!snapshot && <PendingPanels pending={loading} />}
        {snapshot && (
          <>
            <div className="grid gap-4 xl:grid-cols-2">
              <Card>
                <CardHeader><CardTitle>CPU and process activity</CardTitle>
                  <CardDescription>{hasCpuHistory
                    ? `Last ${history.length} on-demand CPU samples`
                    : "Termux process counters · cumulative ticks, not overall CPU %"}</CardDescription></CardHeader>
                <CardContent>
                  {hasCpuHistory ? (
                    <>
                      <div aria-label="CPU sample history" className="flex h-28 items-end gap-1" role="img">
                        {history.map((point, index) => (
                          <div key={index} title={`${point.observedAt}: ${point.cpuPercent ?? "unavailable"}%`}
                            className={point.cpuPercent === null ? "bg-muted flex-1" : "bg-primary/70 flex-1 rounded-t"}
                            style={{ height: `${Math.max(4, point.cpuPercent ?? 4)}%` }} />
                        ))}
                      </div>
                      <p className="text-muted-foreground mt-2 text-xs">Missing readings are not reported as zero.</p>
                    </>
                  ) : topProcessSamples.length ? (
                    <div className="space-y-2 text-sm">
                      {topProcessSamples.map((process) => (
                        <div key={`${process.pid}:${process.startTicks}`} className="flex items-center justify-between gap-3">
                          <span>PID {process.pid} <span className="text-muted-foreground">({process.ownership})</span></span>
                          <span className="tabular-nums">{process.cpuTicks.toLocaleString()} CPU ticks</span>
                        </div>
                      ))}
                      <p className="text-muted-foreground text-xs">Cumulative CPU time of accessible processes; not system utilization.</p>
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-sm">Android restricts CPU counters and no process samples are accessible. See Access info.</p>
                  )}
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
