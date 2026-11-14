import * as React from "react"
import { BaseLayout } from "@/components/layouts/base-layout"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ControlPlanePanel } from "@/app/termux/control-plane-panel"
import { localAgentLogSchema, type LocalAgentLogData } from "@/lib/local-agent-logs-schema"

export default function LocalAgentPage() {
  const [refreshToken, setRefreshToken] = React.useState(0)
  const [live, setLive] = React.useState(true)
  const [logs, setLogs] = React.useState<LocalAgentLogData | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState(false)
  React.useEffect(() => {
    let active: AbortController | null = null
    const readLogs = async () => {
      // Only one read in flight. Slow devices never accumulate overlapping requests.
      if (active !== null) return
      const controller = new AbortController()
      active = controller
      try {
        const response = await fetch("/api/v1/termux-admin?mode=local-agent-logs", {
          method: "GET", credentials: "same-origin", cache: "no-store", signal: controller.signal,
        })
        if (!response.ok) throw Error("unavailable")
        const data = localAgentLogSchema.parse(await response.json() as unknown)
        if (!controller.signal.aborted) { setLogs(data); setError(false) }
      } catch {
        if (!controller.signal.aborted) { setLogs(null); setError(true) }
      } finally {
        if (!controller.signal.aborted) setLoading(false)
        active = null
      }
    }
    void readLogs()
    const interval = live ? window.setInterval(() => {
      // Keep the agent idle when the owner is not watching this page.
      if (document.visibilityState === "visible") void readLogs()
    }, 5000) : null
    return () => {
      if (interval !== null) window.clearInterval(interval)
      active?.abort()
    }
  }, [refreshToken, live])

  return <BaseLayout title="Local Agent">
    <div className="space-y-4 px-4 pb-8 lg:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Badge variant="outline">Local Agent · read-only</Badge>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{live ? "Live · every 5s" : "Live paused"}</Badge>
          <Button variant="outline" onClick={() => setLive(value => !value)}>
            {live ? "Pause live" : "Resume live"}
          </Button>
          <Button variant="outline" onClick={() => setRefreshToken(value => value + 1)}>
            Refresh diagnostics and logs
          </Button>
        </div>
      </div>
      <p className="text-sm text-muted-foreground">
        The Agent runs in its own private Termux runit supervisor. Missing results may mean
        work is still running or its publication has not been confirmed.
      </p>
      <ControlPlanePanel refreshToken={refreshToken} />
      <Card>
        <CardHeader><CardTitle className="text-base">Local Agent logs</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          {loading && <p role="status">Loading private Agent event summaries…</p>}
          {error && <p role="alert">Agent log endpoint unavailable.</p>}
          {logs && !loading && <>
            <p>Log source: private runit · {logs.state}</p>
            {logs.state !== "ok" && <p role="status">
              Log file not readable or not available. No service action was attempted.
            </p>}
            {logs.state === "ok" && <>
              {logs.events.length === 0 && <p>No recognizable log events in the current tail.</p>}
              <ol className="max-h-96 space-y-2 overflow-auto rounded-md border p-3"
                aria-label="Recent Local Agent events">
                {logs.events.map((event, index) =>
                  <li key={index} className="flex flex-wrap justify-between gap-2 border-b py-1 last:border-b-0">
                    <span><strong>{event.kind}</strong> · {event.message}</span>
                    <span className="text-muted-foreground">
                      {event.timestamp ? new Date(event.timestamp).toLocaleString() : "Time unavailable"}
                    </span>
                  </li>)}
              </ol>
              <p className="text-xs text-muted-foreground">
                {logs.unclassifiedLines} unclassified lines omitted
                {logs.truncated ? " · truncated log tail" : ""}.
              </p>
            </>}
            <p className="text-xs text-muted-foreground">
              Events are classified locally. Raw lines, task IDs, commands and tokens are
              never returned to the browser. This is not a GitHub publication receipt.
            </p>
          </>}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-base">Task performance watchdog</CardTitle>
            <Badge variant="outline">Event-driven · no extra polling</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {(!logs || !logs.latency) && <p role="status">
            Timing history is not available from this installed Agent yet.
          </p>}
          {logs?.latency && logs.latency.state !== "ok" && <p role="status">
            Timing history: {logs.latency.state}. No performance conclusion can be drawn.
          </p>}
          {logs?.latency?.state === "ok" && <>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <p>Median: <strong>{logs.latency.medianSeconds === null
                ? "not measured" : logs.latency.medianSeconds + " s"}</strong></p>
              <p>P95: <strong>{logs.latency.p95Seconds === null
                ? "not measured" : logs.latency.p95Seconds + " s"}</strong></p>
              <p>Latest: <strong>{logs.latency.latestSeconds === null
                ? "not measured" : logs.latency.latestSeconds + " s"}</strong></p>
            </div>
            <p>Completed task samples: {logs.latency.sampleCount} / 40</p>
            <p>Last measurement: {logs.latency.observedAt
              ? new Date(logs.latency.observedAt).toLocaleString() : "unavailable"}</p>
            {logs.latency.alerts.length === 0
              ? <p role="status">No active duration alerts in recorded samples.</p>
              : <div role="alert" className="rounded-md border p-3">
                <strong>Performance attention required</strong>
                <ul className="mt-2 list-disc pl-5">
                  {logs.latency.alerts.map(alert =>
                    <li key={alert}>{({
                      "uncertain-execution": "One recent task ended with uncertain effects (UNKNOWN).",
                      "execution-timeout": "A recent task exceeded its execution budget.",
                      "repeated-long-execution": "At least three of five recent tasks exceeded 300 seconds.",
                      "execution-regression": "At least three of five tasks exceeded twice the preceding median.",
                    } as const)[alert]}</li>)}
                </ul>
              </div>}
            <ol aria-label="Recent task durations" className="max-h-48 space-y-1 overflow-auto">
              {logs.latency.recent.map((sample, index) =>
                <li key={index} className="flex flex-wrap justify-between gap-2 border-b py-1">
                  <span>{sample.status} · {sample.seconds === null ? "unknown duration" : sample.seconds + " s"}</span>
                  <span className="text-muted-foreground">{new Date(sample.at).toLocaleString()}</span>
                </li>)}
            </ol>
          </>}
          <p className="text-xs text-muted-foreground">
            Times cover task execution only, not GitHub queue-to-start or result delivery.
            Alerts update when tasks finish. They do not prove the Agent is online or
            send notifications when this page is closed. No task IDs or commands are exposed.
          </p>
        </CardContent>
      </Card>
    </div>
  </BaseLayout>
}
