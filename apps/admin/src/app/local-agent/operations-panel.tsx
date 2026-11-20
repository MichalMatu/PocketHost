import * as React from "react"
import { Link } from "react-router-dom"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { localAgentOperationsSchema, type LocalAgentOperationsData,
  type AgentAction } from "@/lib/local-agent-operations-schema"
import { formatAgentDuration, formatAgentTime } from "@/lib/local-agent-time"

const api = "/api/v1/termux-admin"
const summary = (value: LocalAgentOperationsData["agent"]) =>
  value.state === "running" ? "Running · PID " + value.pid +
    (value.uptimeSeconds !== null ? " · " + formatAgentDuration(value.uptimeSeconds) : "") :
    value.state === "stopped" ? "Stopped" : "Unavailable"

export function LocalAgentOperationsPanel({ refreshToken }: { refreshToken: number }) {
  const [data, setData] = React.useState<LocalAgentOperationsData | null>(null)
  const [error, setError] = React.useState("")
  const [busy, setBusy] = React.useState<AgentAction | null>(null)

  React.useEffect(() => {
    let alive = true
    let pending = false
    const read = async () => {
      if (pending) return
      pending = true
      try {
        const response = await fetch(api + "?mode=local-agent-operations", {
          method: "GET", credentials: "same-origin", cache: "no-store",
          signal: AbortSignal.timeout(10000),
        })
        if (!response.ok) throw Error("read-failed")
        const next = localAgentOperationsSchema.parse(await response.json() as unknown)
        if (alive) { setData(next); setError("") }
      } catch {
        if (alive) setError("Status could not be refreshed; previous values may be stale.")
      } finally { pending = false }
    }
    void read()
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible" && !busy) void read()
    }, 5000)
    return () => { alive = false; window.clearInterval(interval) }
  }, [refreshToken, busy])

  const operate = async (name: AgentAction) => {
    if (busy || !data || error) return
    if (["agent-stop","ssh-stop","ssh-restart"].includes(name) &&
        !window.confirm(
          name === "agent-stop" ? "Stop only the A8 Local Agent service? No new tasks will run until Start." :
          name === "ssh-stop" ? "Stop the dedicated A8 SSH service? Remote SSH sessions will disconnect." :
          "Restart only the dedicated A8 SSH service?"
        )) return
    setBusy(name)
    try {
      const response = await fetch(api, {
        method: "POST", credentials: "same-origin",
        headers: { "Content-Type": "application/json", "X-PocketHost-Intent": "termux-admin" },
        body: JSON.stringify({ action: "local-agent-operations", name }),
      })
      if (!response.ok) throw Error("operation-unconfirmed")
      setData(localAgentOperationsSchema.parse(await response.json() as unknown))
      setError("")
    } catch {
      setError("Operation not confirmed. Refresh the state before retrying.")
    } finally { setBusy(null) }
  }

  return <div className="space-y-4">
    {error && <p role="alert" className="rounded-md border p-3 text-sm">{error}</p>}
    {!data && <p role="status" className="text-sm text-muted-foreground">Reading A8 service and task state…</p>}
    {data && <>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Local Agent</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>{summary(data.agent)}</p>
            <p>Task intake: <strong>{data.intake}</strong></p>
            <p>Installed source: <code>{data.agent.sourceSha?.slice(0, 12) ?? "unverified"}</code></p>
            <div className="flex flex-wrap gap-2">
              {data.agent.state === "stopped" &&
                <Button size="sm" disabled={!!busy || !!error}
                  onClick={() => void operate("agent-start")}>Start Agent</Button>}
              {data.agent.state === "running" &&
                <Button size="sm" variant="outline"
                  disabled={!!busy || !!error || data.current.length > 0}
                  onClick={() => void operate("agent-stop")}>Stop Agent</Button>}
              {data.agent.supportsPause && data.agent.state === "running" &&
                data.intake === "active" &&
                <Button size="sm" variant="outline" disabled={!!busy || !!error}
                  onClick={() => void operate("agent-pause")}>Pause new tasks</Button>}
              {data.agent.supportsPause && data.intake === "paused" &&
                <Button size="sm" disabled={!!busy || !!error}
                  onClick={() => void operate("agent-resume")}>Resume intake</Button>}
            </div>
            {!data.agent.supportsPause && <p className="text-xs text-muted-foreground">
              Pause intake becomes available after the new A8 Agent runtime is installed and verified.
            </p>}
            {data.current.length > 0 && <p className="text-xs text-muted-foreground">
              Stop is disabled while local claims lack results; ongoing effects must not be interrupted.
            </p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">SSH / Termux terminal</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>{summary(data.ssh)}</p>
            <p>SSH address: <code>{data.ssh.address}:{data.ssh.port}</code></p>
            <p>Listener: <strong>{data.ssh.listen}</strong>
              {data.ssh.state === "running" && data.ssh.listen === "closed" &&
                " · running process without a reachable TCP listener"}
            </p>
            <div className="flex flex-wrap gap-2">
              {data.ssh.state === "stopped" &&
                <Button size="sm" disabled={!!busy || !!error}
                  onClick={() => void operate("ssh-start")}>Start SSH</Button>}
              {data.ssh.state === "running" && <>
                <Button size="sm" variant="outline" disabled={!!busy || !!error}
                  onClick={() => void operate("ssh-restart")}>Restart SSH</Button>
                <Button size="sm" variant="outline" disabled={!!busy || !!error}
                  onClick={() => void operate("ssh-stop")}>Stop SSH</Button>
              </>}
              <Link to="/terminal" className={buttonVariants({ variant: "outline", size: "sm" })}>
                Open interactive terminal
              </Link>
            </div>
            <p className="text-xs text-muted-foreground">
              The terminal opens an interactive shell on this A8. SSH is a separate service.
            </p>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Task activity</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <p>Local claims: <strong>{data.claims ?? "unknown"}</strong></p>
            <p>Local results: <strong>{data.results ?? "unknown"}</strong></p>
            <p>Without a result: <strong>{data.current.length}</strong></p>
          </div>
          <h3 className="font-medium">Current / unresolved</h3>
          {data.current.length === 0 ? <p className="text-muted-foreground">
            No local claim is waiting for a result. Remote GitHub queue not checked.
          </p> : <ul className="space-y-1">
            {data.current.map(item => <li key={item.id} className="break-all">
              <code>{item.id}</code> · {item.since ? formatAgentTime(item.since) : "time unavailable"}
            </li>)}
          </ul>}
          <h3 className="font-medium">Latest local results</h3>
          <ol className="max-h-72 divide-y overflow-auto rounded-md border">
            {data.recent.map(item => <li key={item.id}
              className="flex flex-wrap items-center gap-3 px-3 py-2">
              <Badge variant="outline">{item.status}</Badge>
              <code className="break-all">{item.id}</code>
              <span className="ml-auto text-xs text-muted-foreground">
                {formatAgentTime(item.at)}</span>
            </li>)}
          </ol>
          <p className="text-xs text-muted-foreground">
            Local file results do not independently prove GitHub publication.
            Task/result transport: <a className="underline" href="https://github.com/MichalMatu/local-agent/tree/agent-control"
              target="_blank" rel="noreferrer">agent-control</a>.
          </p>
        </CardContent>
      </Card>
      <p className="text-xs text-muted-foreground">
        Snapshot: {formatAgentTime(data.observedAt)}. Controls affect only the selected Galaxy A8 services.
      </p>
    </>}
  </div>
}
