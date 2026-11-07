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
  const response = await fetch(endpoint, { cache: "no-store", credentials: "same-origin", signal })
  if (!response.ok) throw new Error("Network settings unavailable on this panel version")
  const value: unknown = await response.json()
  return parseNetworkAccessStatus(value)
}

export default function NetworkAccessPage() {
  const [status, setStatus] = React.useState<NetworkAccessStatus | null>(null)
  const [bind, setBind] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const refresh = React.useCallback(async (signal?: AbortSignal) => {
    const next = await getStatus(signal)
    if (signal?.aborted) return
    setStatus(next)
    setBind((previous) => next.interfaces.some((item) => item.address === previous)
      ? previous : (next.bind ?? next.interfaces[0]?.address ?? ""))
    setError(null)
  }, [])
  React.useEffect(() => {
    const controller = new AbortController()
    void refresh(controller.signal).catch(() => {
      if (!controller.signal.aborted) setError("Cannot read LAN settings from this PocketHost session.")
    })
    return () => controller.abort()
  }, [refresh])
  const change = async (enabled: boolean) => {
    if (busy) return
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
      setStatus(parseNetworkAccessStatus(value))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Gateway change rejected safely.")
    } finally {
      setBusy(false)
    }
  }
  return (
    <BaseLayout title="Network Access" description="Local administration or trusted home Wi-Fi">
      <div className="flex flex-col gap-5 px-4 pb-8 lg:px-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Network className="size-5" /> Admin network access</CardTitle>
            <CardDescription>
              Admin always stays on 127.0.0.1:8787. Home LAN uses one exact private phone address and dedicated ports 18878/18879.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant="outline"><ShieldCheck className="size-3" /> Manual only · no autostart</Badge>
              <Badge variant="secondary">{status?.enabled ? "Home LAN enabled" : "Managed gateway off"}</Badge>
              <Button variant="outline" disabled={busy} onClick={() => void refresh().catch(() => setError("Could not refresh gateway state."))}>
                <RefreshCw className="size-4" /> Refresh
              </Button>
            </div>
            {!status && !error && <p role="status">Reading network interfaces…</p>}
            {error && <p role="alert" className="text-destructive text-sm">{error}</p>}
            {status && (
              <>
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
