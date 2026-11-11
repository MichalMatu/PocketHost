import * as React from "react"
import { RefreshCw, Server, ShieldCheck } from "lucide-react"

import { BaseLayout } from "@/components/layouts/base-layout"
import { parseHostSnapshot, type HostSnapshot } from "@/lib/host-snapshot-schema"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card"

const endpoint = "/api/v1/host/snapshot"
const unavailableMessage = "Termux snapshot unavailable. Previously observed data, if any, is retained."

async function requestHostSnapshot(signal?: AbortSignal): Promise<HostSnapshot> {
  const response = await fetch(endpoint, {
    method: "GET", credentials: "same-origin", cache: "no-store", signal,
  })
  if (!response.ok) throw new Error("Snapshot service returned an error")
  const data: unknown = await response.json()
  return parseHostSnapshot(data)
}

function Value({ children, pending }: { children: React.ReactNode; pending: boolean }) {
  return pending ? <span aria-label="Loading" className="block h-6 w-28 max-w-full animate-pulse rounded bg-muted" /> :
    <span className="block min-h-6 tabular-nums">{children}</span>
}

export default function HostOverview() {
  const [snapshot, setSnapshot] = React.useState<HostSnapshot | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  async function refresh() {
    setLoading(true)
    try {
      const data = await requestHostSnapshot(AbortSignal.timeout(10000))
      setSnapshot(data)
      setError(null)
    } catch {
      setError(unavailableMessage)
    } finally {
      setLoading(false)
    }
  }

  React.useEffect(() => {
    const controller = new AbortController()
    void requestHostSnapshot(AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]))
      .then(data => {
        if (controller.signal.aborted) return
        setSnapshot(data)
        setError(null)
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(unavailableMessage)
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [])

  const pending = loading && !snapshot && !error
  const runtime = snapshot?.runtime

  return (
    <BaseLayout title="Host overview" description="Read-only Termux host inventory">
      <div className="flex flex-col gap-4 px-4 pb-8 lg:px-6">
        <div className="flex min-h-10 flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline"><ShieldCheck className="size-3" />Termux · read-only</Badge>
            {snapshot && <Badge variant="outline">{snapshot.services.length} observed services</Badge>}
            {error && snapshot && <Badge variant="outline">Last known sample</Badge>}
          </div>
          <Button size="sm" variant="outline" disabled={loading} onClick={() => void refresh()}>
            <RefreshCw className={loading ? "size-4 animate-spin" : "size-4"} />Refresh
          </Button>
        </div>
        {error && <p role="alert" className="text-destructive text-sm">{error}</p>}
        <div data-testid="host-summary" aria-busy={pending} className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Card className="gap-2 py-3">
            <CardHeader className="gap-1 px-4">
              <CardDescription>Node.js</CardDescription>
              <CardTitle><Value pending={pending}>{runtime?.nodeVersion ?? "Unavailable"}</Value></CardTitle>
            </CardHeader>
            <CardContent className="px-4 text-xs text-muted-foreground">{runtime?.architecture ?? " "}</CardContent>
          </Card>
          <Card className="gap-2 py-3">
            <CardHeader className="gap-1 px-4">
              <CardDescription>Device uptime</CardDescription>
              <CardTitle><Value pending={pending}>{runtime ? Math.floor(runtime.systemUptimeSeconds / 3600) + " h" : "Unavailable"}</Value></CardTitle>
            </CardHeader>
          </Card>
          <Card className="gap-2 py-3">
            <CardHeader className="gap-1 px-4">
              <CardDescription>Available memory</CardDescription>
              <CardTitle><Value pending={pending}>{runtime ? runtime.freeMemoryMiB.toLocaleString() + " MiB" : "Unavailable"}</Value></CardTitle>
            </CardHeader>
            <CardContent className="px-4 text-xs text-muted-foreground">{runtime ? "of " + runtime.totalMemoryMiB.toLocaleString() + " MiB" : " "}</CardContent>
          </Card>
          <Card className="gap-2 py-3">
            <CardHeader className="gap-1 px-4">
              <CardDescription>Termux storage free</CardDescription>
              <CardTitle><Value pending={pending}>{runtime?.storage ? runtime.storage.availableMiB.toLocaleString() + " MiB" : "Unavailable"}</Value></CardTitle>
            </CardHeader>
            <CardContent className="px-4 text-xs text-muted-foreground">{runtime?.storage ? "of " + runtime.storage.totalMiB.toLocaleString() + " MiB" : " "}</CardContent>
          </Card>
        </div>
        <Card>
          <CardHeader className="gap-1 px-4">
            <CardTitle className="flex items-center gap-2"><Server className="size-4" />Observed services</CardTitle>
          </CardHeader>
          <CardContent data-testid="host-services" aria-busy={pending}>
            <div className="divide-y">
              {snapshot ? snapshot.services.map(service => (
                <div key={service.id} className="flex min-h-12 items-center justify-between gap-4 py-2">
                  <span className="font-medium text-sm">{service.label}</span>
                  <Badge variant="secondary">{service.state}</Badge>
                </div>
              )) : pending ? Array.from({ length: 6 }, (_, i) => (
                <div key={i} aria-hidden="true" className="flex min-h-12 items-center justify-between gap-4 py-2">
                  <span className="h-4 w-40 animate-pulse rounded bg-muted" />
                  <span className="h-5 w-16 animate-pulse rounded bg-muted" />
                </div>
              )) : <p className="py-3 text-sm text-muted-foreground">No service inventory available.</p>}
            </div>
          </CardContent>
        </Card>
      </div>
    </BaseLayout>
  )
}
