import * as React from "react"
import { BaseLayout } from "@/components/layouts/base-layout"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ControlPlanePanel } from "@/app/termux/control-plane-panel"
import { localAgentLogSchema, type LocalAgentLogData } from "@/lib/local-agent-logs-schema"

export default function LocalAgentPage() {
  const [refreshToken, setRefreshToken] = React.useState(0)
  const [logs, setLogs] = React.useState<LocalAgentLogData | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState(false)
  React.useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError(false)
    setLogs(null)
    void fetch("/api/v1/termux-admin?mode=local-agent-logs", {
      method: "GET", credentials: "same-origin", cache: "no-store", signal: controller.signal,
    }).then(async response => {
      if (!response.ok) throw Error("unavailable")
      return localAgentLogSchema.parse(await response.json() as unknown)
    }).then(value => {
      if (!controller.signal.aborted) { setLogs(value); setLoading(false) }
    }).catch(() => {
      if (!controller.signal.aborted) { setError(true); setLoading(false) }
    })
    return () => controller.abort()
  }, [refreshToken])

  return <BaseLayout title="Local Agent">
    <div className="space-y-4 px-4 pb-8 lg:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Badge variant="outline">Local Agent · read-only</Badge>
        <Button variant="outline" onClick={() => setRefreshToken(value => value + 1)}>
          Refresh diagnostics and logs
        </Button>
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
    </div>
  </BaseLayout>
}
