import * as React from "react"
import { Activity, GitBranch, RefreshCw, TerminalSquare } from "lucide-react"
import { BaseLayout } from "@/components/layouts/base-layout"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ControlPlanePanel } from "@/app/termux/control-plane-panel"
import { controlPlaneSchema, type ControlPlaneDiagnostic } from "@/lib/control-plane-schema"
import { localAgentLogSchema, type LocalAgentLogData } from "@/lib/local-agent-logs-schema"
import { formatAgentDuration, formatAgentTime } from "@/lib/local-agent-time"

type View = "overview" | "tasks" | "console" | "diagnostics"
type Filter = "all" | "errors" | "tasks" | "transport"
const views: { value: View; label: string }[] = [
  { value: "overview", label: "Overview" },
  { value: "tasks", label: "Tasks & activity" },
  { value: "console", label: "Live console" },
  { value: "diagnostics", label: "Diagnostics" },
]
const warnings: Record<string, string> = {
  "uncertain-execution": "Execution ended with uncertain effects; never replay automatically.",
  "execution-timeout": "A recent task exceeded its execution time budget.",
  "repeated-long-execution": "Three of the last five tasks exceeded five minutes.",
  "execution-regression": "Execution time increased compared with earlier samples.",
}
const filters: Record<Filter, string[]> = {
  all: [],
  errors: ["failed", "budget", "timeout", "interrupted"],
  tasks: ["claim", "published", "budget", "failed", "timeout", "interrupted"],
  transport: ["transport", "published"],
}

function Metric({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return <div className="min-w-0 space-y-1 rounded-lg border bg-card p-4">
    <p className="text-xs text-muted-foreground">{label}</p>
    <p className="break-words text-base font-semibold">{value}</p>
    {detail && <p className="text-xs text-muted-foreground">{detail}</p>}
  </div>
}

export default function LocalAgentPage() {
  const [view, setView] = React.useState<View>("overview")
  const [refreshToken, setRefreshToken] = React.useState(0)
  const [live, setLive] = React.useState(true)
  const [filter, setFilter] = React.useState<Filter>("all")
  const [advanced, setAdvanced] = React.useState(false)
  const [logs, setLogs] = React.useState<LocalAgentLogData | null>(null)
  const [logsLoading, setLogsLoading] = React.useState(true)
  const [logsError, setLogsError] = React.useState(false)
  const [plane, setPlane] = React.useState<ControlPlaneDiagnostic | null>(null)
  const [planeLoading, setPlaneLoading] = React.useState(true)
  const [planeError, setPlaneError] = React.useState(false)
  const consoleEnd = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    const controller = new AbortController()
    setPlaneLoading(true)
    setPlaneError(false)
    void fetch("/api/v1/termux-admin?mode=control-plane-diagnostics", {
      method: "GET", credentials: "same-origin", cache: "no-store",
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10_000)]),
    }).then(async response => {
      if (!response.ok) throw Error("unavailable")
      return controlPlaneSchema.parse(await response.json() as unknown)
    }).then(data => {
      if (!controller.signal.aborted) { setPlane(data); setPlaneError(false) }
    }).catch(() => {
      if (!controller.signal.aborted) setPlaneError(true)
    }).finally(() => {
      if (!controller.signal.aborted) setPlaneLoading(false)
    })
    return () => controller.abort()
  }, [refreshToken])

  React.useEffect(() => {
    let active: AbortController | null = null
    const readLogs = async () => {
      // Never accumulate overlapping network requests on a slow phone.
      if (active) return
      const controller = new AbortController()
      active = controller
      try {
        const response = await fetch("/api/v1/termux-admin?mode=local-agent-logs", {
          method: "GET", credentials: "same-origin", cache: "no-store",
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10_000)]),
        })
        if (!response.ok) throw Error("unavailable")
        const data = localAgentLogSchema.parse(await response.json() as unknown)
        if (!controller.signal.aborted) { setLogs(data); setLogsError(false) }
      } catch {
        if (!controller.signal.aborted) setLogsError(true)
      } finally {
        if (!controller.signal.aborted) setLogsLoading(false)
        active = null
      }
    }
    void readLogs()
    const timer = live ? window.setInterval(() => {
      // This updates browser-visible event summaries only, not the Agent itself.
      if (document.visibilityState === "visible") void readLogs()
    }, 5000) : null
    return () => {
      if (timer !== null) window.clearInterval(timer)
      active?.abort()
    }
  }, [refreshToken, live])

  const events = logs?.events.filter(event =>
    filter === "all" || filters[filter].includes(event.kind)) ?? []
  React.useEffect(() => {
    if (view === "console" && live && events.length > 0)
      consoleEnd.current?.scrollIntoView?.({ block: "nearest" })
  }, [view, live, logs, filter, events.length])

  const agent = plane?.localAgent
  const latency = logs?.latency
  const agentStatus = !plane ? "Not verified"
    : agent?.runit.state === "running" ? "Runit running"
    : agent?.runit.state === "stopped" ? "Runit stopped" : "Runit state unknown"
  const intake = agent?.intake === "stop-present" ? "STOP marker present"
    : agent?.intake === "stop-absent" ? "STOP marker absent" : "Unverified"
  const currentClaim = agent?.unspooledClaims
  const logState = logsError ? "Read failed" : logsLoading ? "Reading" :
    logs?.state === "ok" ? "Reading events" : "Events unavailable"

  return <BaseLayout title="Local Agent" description="Samsung A8 · private Termux diagnostics">
    <div className="space-y-4 px-4 pb-8 lg:px-6">
      <div className="flex min-h-10 flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">Read-only monitoring</Badge>
          <Badge variant="outline">{agentStatus}</Badge>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{live ? "Event updates · 5s" : "Event updates paused"}</Badge>
          <Button size="sm" variant="outline" onClick={() => setLive(value => !value)}>
            {live ? "Pause event updates" : "Resume event updates"}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setRefreshToken(value => value + 1)}>
            <RefreshCw className="size-4" /> Refresh
          </Button>
        </div>
      </div>
      <nav role="tablist" aria-label="Local Agent sections"
        className="flex flex-wrap gap-2 border-b pb-3">
        {views.map(item => <Button type="button" role="tab" key={item.value}
          aria-selected={view === item.value}
          variant={view === item.value ? "default" : "outline"}
          size="sm" onClick={() => setView(item.value)}>
          {item.label}
        </Button>)}
      </nav>

      {view === "overview" && <section role="tabpanel" aria-label="Overview" className="space-y-4">
        {planeError && <p role="alert" className="rounded-md border p-3 text-sm text-muted-foreground">
          Status read failed. {plane ? "The previous local sample is shown below." : "No current status sample."}
        </p>}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label="Agent service" value={agentStatus}
            detail={agent?.runit.uptimeSeconds != null
              ? "Uptime " + formatAgentDuration(agent.runit.uptimeSeconds) : "Uptime not available"} />
          <Metric label="Task intake" value={intake}
            detail="Marker status is not proof that Git intake is healthy" />
          <Metric label="Local results" value={agent?.spooled == null ? "Not verified" : String(agent.spooled)}
            detail={currentClaim == null ? "No claim comparison" : currentClaim + " claims without a local result"} />
          <Metric label="GitHub delivery" value="Not verified"
            detail="Local files do not prove remote publication" />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Latest activity</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>Last local task result: <strong>{agent?.lastResult ?? "Not verified"}</strong></p>
              <p>Result recorded: <strong>{formatAgentTime(agent?.lastResultAt)}</strong></p>
              <p>Current task: <span className="text-muted-foreground">Not reported by this API</span></p>
              {latency?.state === "ok" && <p>Latest execution: <strong>{formatAgentDuration(latency.latestSeconds)}</strong></p>}
              <p className="text-xs text-muted-foreground">
                Results here come from the phone's local spool, not GitHub acknowledgments.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>GitHub transport</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="flex items-center gap-2"><GitBranch className="size-4" aria-hidden="true" />
                <a className="underline underline-offset-2" href="https://github.com/MichalMatu/local-agent"
                  target="_blank" rel="noreferrer">MichalMatu/local-agent</a></p>
              <p>Task / result branch: <strong>agent-control</strong></p>
              <p>Agent source branch: <strong>main</strong></p>
              <p>Publication: <strong>Not checked by panel</strong></p>
              <p className="text-xs text-muted-foreground">
                Repository and branches are documented configuration, not an authenticated live GitHub connection check.
              </p>
            </CardContent>
          </Card>
        </div>
        <p className="text-xs text-muted-foreground">
          Control-plane status read {formatAgentTime(plane?.observedAt)}
          {planeLoading ? " · refreshing" : ""}. Service running does not guarantee successful task delivery.
        </p>
      </section>}

      {view === "tasks" && <section role="tabpanel" aria-label="Tasks & activity" className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <Metric label="Local claims" value={agent?.claims == null ? "Unknown" : String(agent.claims)} />
          <Metric label="Local result files" value={agent?.spooled == null ? "Unknown" : String(agent.spooled)} />
          <Metric label="Claims without local result"
            value={currentClaim == null ? "Unknown" : String(currentClaim)}
            detail="May include ongoing or interrupted tasks" />
        </div>
        {(agent?.orphanSpools ?? 0) > 0 && <p role="alert" className="rounded-md border p-3 text-sm">
          Orphaned local results: {agent?.orphanSpools}. Investigate before any manual retry.
        </p>}
        <Card>
          <CardHeader><CardTitle>Task execution performance</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            {!latency || latency.state !== "ok" ? <p role="status" className="text-muted-foreground">
              Timing history is not available from the installed Agent. No performance conclusion is possible.
            </p> : <>
              <div className="grid gap-3 sm:grid-cols-3">
                <Metric label="Median execution" value={formatAgentDuration(latency.medianSeconds)} />
                <Metric label="95th percentile" value={formatAgentDuration(latency.p95Seconds)} />
                <Metric label="Latest execution" value={formatAgentDuration(latency.latestSeconds)} />
              </div>
              <p className="text-xs text-muted-foreground">
                {latency.sampleCount} of 40 possible samples · last recorded {formatAgentTime(latency.observedAt)}
              </p>
              {latency.alerts.length > 0 && <div role="alert" className="space-y-2 rounded-md border p-3">
                <strong>Performance attention required</strong>
                <ul className="list-disc space-y-1 pl-5">
                  {latency.alerts.map(code => <li key={code}>{warnings[code]}</li>)}
                </ul>
              </div>}
              <h3 className="font-medium">Recent completions</h3>
              <ol className="max-h-56 divide-y overflow-auto rounded-md border px-3">
                {latency.recent.map((item, i) => <li key={i}
                  className="flex flex-wrap justify-between gap-x-3 gap-y-1 py-2">
                  <span className="font-medium">{item.status} · {formatAgentDuration(item.seconds)}</span>
                  <span className="text-xs text-muted-foreground">{formatAgentTime(item.at)}</span>
                </li>)}
              </ol>
            </>}
            <p className="text-xs text-muted-foreground">
              Durations cover task execution only; GitHub queue and result publication delays are not measured.
            </p>
          </CardContent>
        </Card>
      </section>}

      {view === "console" && <section role="tabpanel" aria-label="Live console" className="space-y-3">
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2"><TerminalSquare className="size-4" />
                Sanitized Agent events</CardTitle>
              <Badge variant="outline">{logState}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                Read-only events · sampled {formatAgentTime(logs?.observedAt)}
              </p>
              <label className="flex items-center gap-2 text-xs">
                Filter
                <select aria-label="Filter Agent events" className="rounded-md border bg-background px-2 py-1.5"
                  value={filter} onChange={event => setFilter(event.target.value as Filter)}>
                  <option value="all">All</option>
                  <option value="errors">Errors</option>
                  <option value="tasks">Tasks</option>
                  <option value="transport">Transport</option>
                </select>
              </label>
            </div>
            {logsError && <p role="alert" className="text-muted-foreground">
              Event read failed. {logs ? "Last successful sample remains visible." : "No events available."}
            </p>}
            <div aria-label="Agent event console"
              className="max-h-80 min-h-40 overflow-auto rounded-md border bg-neutral-950 p-3 font-mono text-xs leading-relaxed text-neutral-200">
              {logs?.state === "ok" && events.length ? <ol className="space-y-2">
                {events.map((event, index) => <li key={index} className="break-words">
                  <span className="text-neutral-400">[{event.timestamp ? formatAgentTime(event.timestamp) : "no time"}]</span>
                  {" "}<span className="font-semibold">{event.kind.toUpperCase()}</span>
                  {" "}{event.message}
                </li>)}
              </ol> : <p role="status" className="text-neutral-400">
                {!logs ? "No event sample yet." : logs.state !== "ok"
                  ? "The private event log is unavailable."
                  : "No classified events match this view."}
              </p>}
              <div ref={consoleEnd} />
            </div>
            {logs?.state === "ok" && <p className="text-xs text-muted-foreground">
              {logs.unclassifiedLines} unrecognized lines excluded
              {logs.truncated ? " · source tail truncated" : ""}.
            </p>}
            <p className="text-xs text-muted-foreground">
              This is not a shell terminal. The API deliberately hides raw log lines, commands, task identifiers
              and credentials. Events are not proof of GitHub delivery.
            </p>
          </CardContent>
        </Card>
      </section>}

      {view === "diagnostics" && <section role="tabpanel" aria-label="Diagnostics" className="space-y-4">
        <Card>
          <CardHeader><CardTitle>Advanced diagnostics & control boundaries</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>The Local Agent is managed by its own private Termux runit supervisor.
              This screen does not have permission to start, stop, pause or update that service.</p>
            <p>Local snapshot: {formatAgentTime(plane?.observedAt)}
              {planeError ? " · unable to refresh" : ""}</p>
            <Button variant="outline" size="sm" onClick={() => setAdvanced(open => !open)}>
              {advanced ? "Hide technical details" : "Show technical details"}
            </Button>
          </CardContent>
        </Card>
        {advanced && <ControlPlanePanel refreshToken={refreshToken} />}
      </section>}
    </div>
  </BaseLayout>
}
