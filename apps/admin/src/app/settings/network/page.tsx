import * as React from "react"
import { Network, RefreshCw, ShieldCheck } from "lucide-react"
import { BaseLayout } from "@/components/layouts/base-layout"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  parseNetworkAccessStatus, type NetworkAccessStatus,
} from "@/lib/network-access-schema"

const endpoint = "/api/v1/network-access"

async function getStatus(signal?: AbortSignal): Promise<NetworkAccessStatus> {
  const boundedSignal = signal
    ? AbortSignal.any([signal, AbortSignal.timeout(10_000)])
    : AbortSignal.timeout(10_000)
  const response = await fetch(endpoint, { cache: "no-store", credentials: "same-origin", signal: boundedSignal })
  if (!response.ok) throw new Error("Network settings unavailable on this panel version")
  const value: unknown = await response.json()
  return parseNetworkAccessStatus(value)
}

export default function NetworkAccessPage() {
  const [status, setStatus] = React.useState<NetworkAccessStatus | null>(null)
  const [bind, setBind] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const activeRead = React.useRef<AbortController | null>(null)
  const refresh = React.useCallback(async () => {
    // Invalidate older snapshots; a slow GET cannot restore stale LAN controls.
    activeRead.current?.abort()
    const controller = new AbortController()
    activeRead.current = controller
    setStatus(null)
    setError(null)
    try {
      const next = await getStatus(controller.signal)
      if (controller.signal.aborted) return
      setStatus(next)
      setBind(previous => next.interfaces.some(item => item.address === previous)
        ? previous : (next.bind ?? next.interfaces[0]?.address ?? ""))
    } catch {
      if (!controller.signal.aborted)
        setError("Cannot read LAN settings from this PocketHost session.")
    } finally {
      if (activeRead.current === controller) activeRead.current = null
    }
  }, [])
  React.useEffect(() => {
    let cancelled = false
    void Promise.resolve().then(() => { if (!cancelled) void refresh() })
    return () => {
      cancelled = true
      activeRead.current?.abort()
      activeRead.current = null
    }
  }, [refresh])
  const change = async (enabled: boolean) => {
    if (busy) return
    // A pending read is not allowed to overwrite the independent POST readback.
    activeRead.current?.abort()
    activeRead.current = null
    setStatus(null)
    setBusy(true)
    setError(null)
    try {
      const response = await fetch(endpoint + (enabled ? "/enable" : "/disable"), {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "X-PocketHost-Intent": "lan-control",
          ...(enabled ? { "X-PocketHost-Lan-Bind": bind } : {}),
        },
      })
      if (!response.ok) throw new Error("Gateway could not be changed. An older PocketHost gateway may already own these ports.")
      const value: unknown = await response.json()
      const acknowledged = parseNetworkAccessStatus(value)
      const observed = await getStatus()
      // A successful POST is not proof that the owned gateway retained its
      // requested bind. Read back the independent current session state.
      const matches = (state: NetworkAccessStatus) =>
        state.enabled === enabled && (enabled ? state.bind === bind : state.bind === null)
      if (!matches(acknowledged) || !matches(observed))
        throw new Error("LAN gateway state did not match its requested policy")
      setStatus(observed)
    } catch {
      setError("Gateway change result unconfirmed. Inspect the current LAN state before retrying.")
      try { setStatus(await getStatus()) } catch { setStatus(null) }
    } finally {
      setBusy(false)
    }
  }
  return (
    <BaseLayout title="Network Access" description="Local administration or trusted home Wi-Fi">
      <div className="flex flex-col gap-5 px-4 pb-8 lg:px-6">
        <div className="flex min-h-10 items-center justify-end">
          <Button variant="outline" disabled={busy} onClick={() => void refresh()}>
            <RefreshCw className="size-4" /> Refresh
          </Button>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Network className="size-5" /> Admin network access</CardTitle>
            <CardDescription>
              Admin always stays on 127.0.0.1:8787. Home LAN uses one exact private phone address and dedicated ports 18878/18879.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant="outline"><ShieldCheck className="size-3" /> {!status
                ? "LAN mode unverified"
                : status.mode === "auto" ? "Private LAN auto-starts with PocketHost" : "Manual LAN startup"}</Badge>
              <Badge variant="secondary">{!status
                ? "Gateway state unverified" : status.enabled ? "Home LAN enabled" : "Managed gateway off"}</Badge>
            </div>
            {!status && !error && <p role="status">Reading network interfaces…</p>}
            {error && <p role="alert" className="text-destructive text-sm">{error}</p>}
            {status && (
              <>
                {status.health && (
                  <p className="text-muted-foreground text-xs" aria-label="Owned gateway observation">
                    Owned gateway: {status.health.state}
                    {" · Recovery count: "}{status.health.recoveryCount}
                    {" · Startup failures: "}{status.health.startupFailures}.
                    {status.health.lastError && <> Last issue: {status.health.lastError}.</>}
                    {" This is a session observation, not Android boot verification."}
                  </p>
                )}
                <div className="flex flex-col gap-2">
                  <label htmlFor="network-bind" className="text-sm font-medium">Phone Wi-Fi address</label>
                  <select id="network-bind" className="border-input bg-background h-10 max-w-sm rounded-md border px-3 text-sm"
                    value={bind} disabled={busy || status.enabled} onChange={(event) => setBind(event.target.value)}>
                    {status.interfaces.length === 0 && <option value="">No eligible private interface</option>}
                    {status.interfaces.map((item) => (
                      <option key={item.name + item.address} value={item.address}>{item.name} · {item.address}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button disabled={busy || status.enabled || !bind} onClick={() => void change(true)}>Enable Home LAN</Button>
                  <Button variant="outline" disabled={busy || !status.enabled} onClick={() => void change(false)}>Disable Home LAN</Button>
                </div>
                {status.adminUrl && <p className="text-sm">Admin: <a className="underline" href={status.adminUrl} target="_blank" rel="noreferrer">{status.adminUrl}</a></p>}
                {status.siteUrl && <p className="text-sm">Demo: <a className="underline" href={status.siteUrl} target="_blank" rel="noreferrer">{status.siteUrl}</a></p>}
              </>
            )}
            <p className="text-muted-foreground text-xs">
              Only a gateway started by this panel session can be disabled here. An older separately started gateway is not managed or stopped by these buttons.
              LAN has no login and uses unencrypted HTTP: use only on your trusted private Wi-Fi, never on guest networks or with router port forwarding.
              Switching the panel off or restarting it closes only its own gateway; it does not change any other Termux services.
            </p>
          </CardContent>
        </Card>
      </div>
    </BaseLayout>
  )
}
