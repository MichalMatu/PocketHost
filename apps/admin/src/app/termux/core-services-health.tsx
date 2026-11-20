import * as React from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { localAgentOperationsSchema } from "@/lib/local-agent-operations-schema"
import { cloudflareTunnelSchema } from "@/lib/cloudflare-tunnel-schema"

type ProbeRow = {
  name: string
  state: "ready" | "attention" | "unverified"
  detail: string
}
async function read(mode: string): Promise<unknown> {
  const response = await fetch("/api/v1/termux-admin?mode=" + mode, {
    credentials: "same-origin", cache: "no-store",
    signal: AbortSignal.timeout(10000),
  })
  if (!response.ok) throw Error("read-unavailable")
  return response.json() as Promise<unknown>
}

/**
 * Intentional on-demand check: no timer, stateful restart, automatic remediation
 * or inference of Cloudflare edge connectivity from a running process.
 */
export function CoreServicesHealthPanel() {
  const [rows, setRows] = React.useState<ProbeRow[] | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [checkedAt, setCheckedAt] = React.useState<Date | null>(null)

  const check = async () => {
    if (busy) return
    setBusy(true)
    const observe = async (name: string, probe: () => Promise<Omit<ProbeRow, "name">>) => {
      try {
        return { name, ...await probe() }
      } catch {
        return { name, state: "unverified" as const, detail: "Diagnostic unavailable" }
      }
    }
    try {
      const result = await Promise.all([
        observe("Local Agent", async () => {
          const data = localAgentOperationsSchema.parse(await read("local-agent-operations"))
          return {
            state: data.agent.state === "running" && data.intake === "active"
              ? "ready" as const : "attention" as const,
            detail: data.agent.state === "running"
              ? "Process running; intake " + data.intake + ". Git delivery not checked."
              : "Service " + data.agent.state + "; task intake " + data.intake,
          }
        }),
        observe("Dedicated SSH", async () => {
          const data = localAgentOperationsSchema.parse(await read("local-agent-operations"))
          return {
            state: data.ssh.state === "running" && data.ssh.listen === "open"
              ? "ready" as const : "attention" as const,
            detail: "Port 8022: " + data.ssh.listen + "; service " + data.ssh.state,
          }
        }),
        observe("Mosquitto MQTT", async () => {
          const data = await read("mqtt-loopback-health")
          if (!data || typeof data !== "object" || Array.isArray(data)) throw Error("bad-probe")
          const response = data as Record<string, unknown>
          if (response.version !== 1 || !["ready", "not-ready", "unverified"].includes(String(response.state)))
            throw Error("bad-probe")
          return {
            state: response.state === "ready" ? "ready" as const :
              response.state === "not-ready" ? "attention" as const : "unverified" as const,
            detail: response.state === "ready" ?
              "MQTT CONNACK received on 127.0.0.1:1883" :
              "Protocol check: " + String(response.reason ?? "unverified"),
          }
        }),
        observe("Cloudflare Tunnel", async () => {
          const data = cloudflareTunnelSchema.parse(await read("cloudflare-diagnostics"))
          const installed = data.binary?.state === "available"
          const configured = data.config.state === "ok" &&
            data.config.tunnelDeclared && data.config.credentialsFileDeclared
          return {
            state: "unverified" as const,
            detail: !installed ? "cloudflared not installed or not verified" :
              !configured ? "Installed; named tunnel configuration missing" :
              data.runit.state !== "running" ? "Configured; service not running" :
              "Process running; Cloudflare edge connection not independently verified",
          }
        }),
      ])
      setRows(result)
      setCheckedAt(new Date())
    } finally {
      setBusy(false)
    }
  }

  return <Card>
    <CardHeader>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <CardTitle className="text-base">Core services · on-demand health</CardTitle>
        <Button variant="outline" size="sm" disabled={busy} onClick={() => void check()}>
          {busy ? "Checking…" : "Check core services"}
        </Button>
      </div>
    </CardHeader>
    <CardContent className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Verifies known A8 surfaces only. No scheduler, service restart, Cloudflare route,
        or connection to public endpoints is created.
      </p>
      {!rows && <p className="text-sm text-muted-foreground">Not checked in this browser session.</p>}
      {rows && <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {rows.map(row => <div key={row.name} className="space-y-1 rounded-md border p-3">
          <p className="font-medium">{row.name}</p>
          <p className="text-sm">{row.state === "ready" ? "Ready at last check" :
            row.state === "attention" ? "Needs attention" : "Not verified"}</p>
          <p className="text-xs text-muted-foreground">{row.detail}</p>
        </div>)}
      </div>}
      {checkedAt && <p className="text-xs text-muted-foreground">
        Snapshot: {checkedAt.toLocaleString()}. Readiness can change after this check.
      </p>}
    </CardContent>
  </Card>
}
