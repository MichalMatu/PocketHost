import * as React from "react"
import { Activity, ChevronDown, ChevronRight, Info, RefreshCw, ShieldCheck } from "lucide-react"
import { Link } from "react-router-dom"
import { BaseLayout } from "@/components/layouts/base-layout"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { parseObservabilitySnapshot, type ObservabilitySnapshot } from "@/lib/observability-schema"

const endpoint = "/api/v1/observability"
const unavailable = "Termux diagnostic snapshot unavailable. Existing services have not been changed."
type Process = ObservabilitySnapshot["processes"]["processes"][number]
type ProcessOrder = "cpu" | "ram" | "pid"
type SourceState = "ok" | "stale" | "unavailable" | "permission-denied"

async function loadSnapshot(signal?: AbortSignal): Promise<ObservabilitySnapshot> {
  const response = await fetch(endpoint, {
    method: "GET", cache: "no-store", credentials: "same-origin", signal,
  })
  if (!response.ok) throw new Error("Observability endpoint unavailable")
  const payload: unknown = await response.json()
  return parseObservabilitySnapshot(payload)
}

function seenAt(value: string) {
  const date = new Date(value)
  return Number.isFinite(date.getTime())
    ? date.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" })
    : "Time unavailable"
}

function statusLabel(state: SourceState) {
  switch (state) {
    case "ok": return "Available"
    case "stale": return "Stale"
    case "permission-denied": return "Restricted"
    default: return "Unavailable"
  }
}

function AccessInfoDialog() {
  return (
    <Dialog>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <Info className="size-4" /> Source access
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Scope of Termux diagnostics</DialogTitle>
          <DialogDescription>Why a reading may be unavailable here but present on the Dashboard</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <p>The Termux process list is a partial view of Android /proc. A process ID alone does not grant control. CPU ticks are accumulated process time, not current CPU utilization.</p>
          <p>Android-wide CPU and network measurements on the Dashboard use a separate, authorized Companion source. Termux may not have permission to read the corresponding kernel files.</p>
          <p>Battery availability depends on Android permissions and the Termux:API source. A missing Termux reading does not invalidate an independent, fresh source.</p>
          <p className="text-muted-foreground">This page samples on request. No process, package, service or permission is changed.</p>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function DiagnosticSource({ name, scope, state, observedAt }: {
  name: string
  scope: string
  state: SourceState
  observedAt: string
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 py-3 last:border-b-0">
      <div className="min-w-0">
        <p className="text-sm font-medium">{name}</p>
        <p className="text-muted-foreground text-xs">{scope}</p>
      </div>
      <div className="text-right">
        <Badge variant="outline">{statusLabel(state)}</Badge>
        <p className="text-muted-foreground mt-1 text-xs tabular-nums">{seenAt(observedAt)}</p>
      </div>
    </div>
  )
}

function PendingPanels() {
  return (
    <div className="grid gap-4 xl:grid-cols-2" aria-busy="true">
      {["Process diagnostics", "Telemetry sources"].map(title => (
        <Card key={title}>
          <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
          <CardContent className="space-y-3" aria-label="Loading">
            <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
            <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function sortProcesses(processes: Process[], order: ProcessOrder) {
  return [...processes].sort((a, b) => {
    if (order === "ram") return (b.rssMiB ?? -1) - (a.rssMiB ?? -1) || a.pid - b.pid
    if (order === "cpu") return b.cpuTicks - a.cpuTicks || a.pid - b.pid
    return a.pid - b.pid
  })
}

export default function ObservabilityPage() {
  const [snapshot, setSnapshot] = React.useState<ObservabilitySnapshot | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [query, setQuery] = React.useState("")
  const [order, setOrder] = React.useState<ProcessOrder>("ram")
  const [expandedProcess, setExpandedProcess] = React.useState<string | null>(null)

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
    void loadSnapshot(controller.signal)
      .then(data => {
        if (!controller.signal.aborted) { setSnapshot(data); setError(null) }
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(unavailable)
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [])

  const processList = snapshot?.processes.processes ?? []
  const filteredProcesses = sortProcesses(processList.filter(process => (
    String(process.pid).includes(query.trim()) ||
    String(process.ppid).includes(query.trim()) ||
    (process.name ?? "").toLowerCase().includes(query.trim().toLowerCase()) ||
    process.ownership.includes(query.trim().toLowerCase())
  )), order)
  const processesOk = snapshot?.processes.state === "ok"

  return (
    <BaseLayout title="Monitoring" description="Termux process diagnostics and telemetry access">
      <div className="flex flex-col gap-5 px-4 pb-8 lg:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline"><ShieldCheck className="size-3" />Read only · on demand</Badge>
            <AccessInfoDialog />
            {snapshot && <span className="text-muted-foreground text-xs tabular-nums">
              Last observation (not live) · {seenAt(snapshot.observedAt)}
            </span>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" render={<Link to="/dashboard" />}>Dashboard trends</Button>
            <Button variant="outline" size="sm" disabled={loading} onClick={() => void refresh()}>
              <RefreshCw className={loading ? "size-4 animate-spin" : "size-4"} />Refresh
            </Button>
          </div>
        </div>
        {error && <p role="alert" className="text-destructive text-sm">{error}</p>}
        {!snapshot && (loading ? <PendingPanels /> : <p className="text-muted-foreground text-sm">No diagnostic snapshot available.</p>)}
        {snapshot && (
          <div className="grid min-w-0 gap-4 xl:grid-cols-2">
            <Card className="min-w-0 xl:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Activity className="size-4" />Process diagnostics</CardTitle>
                <CardDescription>
                  Termux-visible processes · partial /proc inventory · cumulative CPU ticks, not live CPU %
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground" aria-label="Process inventory status">
                  <span className="tabular-nums">{processesOk ? processList.length + " visible processes" : "Process list unavailable"}</span>
                  <Badge variant="outline">{statusLabel(snapshot.processes.state)}</Badge>
                  <span>{snapshot.processes.truncated ? "Inventory truncated at 96 entries" : "Partial Android process visibility"}</span>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <Input aria-label="Filter processes" placeholder="Filter name, PID or identity…" value={query} onChange={event => setQuery(event.target.value)} className="max-w-64" />
                  <div role="group" aria-label="Process sort" className="flex flex-wrap gap-1">
                    <Button size="sm" variant={order === "cpu" ? "secondary" : "outline"} aria-pressed={order === "cpu"} onClick={() => setOrder("cpu")}>CPU ticks</Button>
                    <Button size="sm" variant={order === "ram" ? "secondary" : "outline"} aria-pressed={order === "ram"} onClick={() => setOrder("ram")}>Process RAM</Button>
                    <Button size="sm" variant={order === "pid" ? "secondary" : "outline"} aria-pressed={order === "pid"} onClick={() => setOrder("pid")}>PID</Button>
                  </div>
                </div>
                {processesOk && processList.length > 0 ? (
                  <div className="max-h-[320px] overflow-auto rounded-md border">
                    <table className="w-full min-w-[640px] text-left text-xs" aria-label="Termux-visible process details">
                      <thead className="sticky top-0 z-10 bg-background text-muted-foreground">
                        <tr className="border-b">
                          <th scope="col" className="p-3">Process</th>
                          <th scope="col" className="p-3">PID</th>
                          <th scope="col" className="p-3 text-right">Resident RAM</th>
                          <th scope="col" className="p-3">Identity</th>
                          <th scope="col" className="p-3 text-right">Details</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredProcesses.map(process => {
                          const identity = process.pid + ":" + process.startTicks
                          const expanded = expandedProcess === identity
                          return <React.Fragment key={identity}>
                            <tr className="border-b border-border/50">
                              <td className="p-3 font-medium">{process.name ?? "Unknown"}</td>
                              <td className="p-3 tabular-nums">{process.pid}</td>
                              <td className="p-3 text-right tabular-nums">{process.rssMiB === null ? "Unavailable" : process.rssMiB + " MiB"}</td>
                              <td className="p-3">{process.ownership}</td>
                              <td className="p-3 text-right">
                                <Button size="sm" variant="ghost" aria-label={`Process details for PID ${process.pid}`}
                                  aria-expanded={expanded} onClick={() => setExpandedProcess(expanded ? null : identity)}>
                                  {expanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                                  {expanded ? "Hide" : "Details"}
                                </Button>
                              </td>
                            </tr>
                            {expanded && <tr className="border-b border-border/50 bg-muted/30">
                              <td colSpan={5} className="p-3">
                                <dl className="grid gap-3 text-xs sm:grid-cols-2 lg:grid-cols-4">
                                  <div><dt className="text-muted-foreground">Parent PID</dt><dd className="font-mono tabular-nums">{process.ppid}</dd></div>
                                  <div><dt className="text-muted-foreground">CPU ticks (lifetime total)</dt><dd className="font-mono tabular-nums">{process.cpuTicks.toLocaleString()}</dd></div>
                                  <div><dt className="text-muted-foreground">Start ticks</dt><dd className="font-mono tabular-nums">{process.startTicks}</dd></div>
                                  <div><dt className="text-muted-foreground">Name source</dt><dd>{process.name ? "/proc/PID/status" : "Unavailable"}</dd></div>
                                </dl>
                                <p className="mt-3 text-muted-foreground">Cumulative ticks are not current CPU %. Identity is observational and never grants control.</p>
                              </td>
                            </tr>}
                          </React.Fragment>
                        })}
                      </tbody>
                    </table>
                    {filteredProcesses.length === 0 && <p className="p-3 text-sm text-muted-foreground">No processes match this filter.</p>}
                  </div>
                ) : <p className="text-muted-foreground text-sm">
                  {processesOk ? "No visible process entries in this sample." : "Termux process inventory is unavailable or restricted; no zero-process assumption."}
                </p>}
                <p className="text-muted-foreground text-xs">
                  Process counters are cumulative since each process started. PID and start ticks identify an observation, not permission to control it.
                </p>
              </CardContent>
            </Card>

            <Card className={snapshot.diagnostics.state === "ok" && snapshot.diagnostics.events.length ? "min-w-0" : "min-w-0 xl:col-span-2"}>
              <CardHeader>
                <CardTitle>Telemetry sources</CardTitle>
                <CardDescription>Termux access states only · current values and trends remain on Dashboard</CardDescription>
              </CardHeader>
              <CardContent>
                <DiagnosticSource name="Termux CPU counters" scope="System CPU may be blocked by Android /proc permissions"
                  state={snapshot.metrics.cpuPercent.state} observedAt={snapshot.metrics.cpuPercent.observedAt} />
                <DiagnosticSource name="Termux battery" scope="sysfs / Termux:API permissions"
                  state={snapshot.metrics.batteryPercent.state} observedAt={snapshot.metrics.batteryPercent.observedAt} />
                <DiagnosticSource name="Termux network counters" scope="/proc/net/dev; independent of Companion RX/TX"
                  state={snapshot.metrics.network.state} observedAt={snapshot.metrics.network.observedAt} />
                <DiagnosticSource name="Process inventory" scope="Bounded and always partial Android /proc view"
                  state={snapshot.processes.state} observedAt={snapshot.processes.observedAt} />
                <DiagnosticSource name="Package inventory probe" scope="Metadata status only; manage in Packages & Software"
                  state={snapshot.packages.state} observedAt={snapshot.packages.observedAt} />
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border/50 pt-3 text-sm">
                  <span className="text-muted-foreground">
                    {snapshot.diagnostics.state !== "ok"
                      ? "Host diagnostic event stream is not connected yet."
                      : snapshot.diagnostics.events.length === 0
                        ? "No structured diagnostic events in this observation."
                        : snapshot.diagnostics.events.length + " structured diagnostic events available."}
                  </span>
                  <Link to="/runtime-logs" className="font-medium underline underline-offset-4">Logs & Diagnostics</Link>
                </div>
              </CardContent>
            </Card>

            {snapshot.diagnostics.state === "ok" && snapshot.diagnostics.events.length > 0 && <Card className="min-w-0">
              <CardHeader>
                <CardTitle>Diagnostic events</CardTitle>
                <CardDescription>Structured runtime observations · not the Dashboard health timeline</CardDescription>
              </CardHeader>
              <CardContent>
                {snapshot.diagnostics.state !== "ok" ? (
                  <p className="text-muted-foreground text-sm">Diagnostic event source {statusLabel(snapshot.diagnostics.state).toLowerCase()}; no events are inferred.</p>
                ) : snapshot.diagnostics.events.length ? (
                  <ul aria-label="Diagnostic events" className="space-y-3">
                    {[...snapshot.diagnostics.events].reverse().map((event, index) => (
                      <li key={event.timestamp + ":" + event.instanceId + ":" + index} className="border-b border-border/50 pb-2 last:border-b-0">
                        <p className="text-sm">{event.code.replaceAll("-", " ")}</p>
                        <p className="text-muted-foreground text-xs tabular-nums">{event.instanceId} · {seenAt(event.timestamp)}</p>
                      </li>
                    ))}
                  </ul>
                ) : <p className="text-muted-foreground text-sm">No permitted diagnostic events in this snapshot.</p>}
              </CardContent>
            </Card>}
          </div>
        )}
        <p className="text-muted-foreground text-xs">
          Services and software inventories live in <Link to="/services" className="underline">Services & Processes</Link>
          {" and "}<Link to="/packages" className="underline">Packages & Software</Link>.
          {" "}Android-wide CPU and app permissions belong to <Link to="/shizuku" className="underline">Android & Shizuku</Link>.
          No background sampling or automatic recovery is performed here.
        </p>
      </div>
    </BaseLayout>
  )
}
