import * as React from "react"
import { RefreshCw, Server, ShieldCheck } from "lucide-react"

import { BaseLayout } from "@/components/layouts/base-layout"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

type Service = {
  id: string
  label: string
  ownership: "external"
  state: "running" | "stopped" | "unknown"
}

type Snapshot = {
  version: 1
  mode: "read-only"
  observedAt: string
  runtime: {
    nodeVersion: string
    architecture: string
    systemUptimeSeconds: number
    totalMemoryMiB: number
    freeMemoryMiB: number
  }
  services: Service[]
}

const endpoint = "/api/v1/host/snapshot"

export default function HostOverview() {
  const [snapshot, setSnapshot] = React.useState<Snapshot | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const refresh = React.useCallback(async (signal?: AbortSignal) => {
    setLoading(true)
    try {
      const response = await fetch(endpoint, {
        method: "GET",
        credentials: "omit",
        cache: "no-store",
        signal,
      })
      if (!response.ok) throw new Error("Snapshot service returned an error")
      const data: Snapshot = await response.json()
      if (data.version !== 1 || data.mode !== "read-only" || !Array.isArray(data.services)) {
        throw new Error("Unexpected snapshot response")
      }
      if (signal?.aborted) return
      setSnapshot(data)
      setError(null)
    } catch {
      if (signal?.aborted) return
      setError("Could not read Termux status. The admin demo remains available.")
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    const controller = new AbortController()
    void refresh(controller.signal)
    return () => controller.abort()
  }, [refresh])

  return (
    <BaseLayout title="Host overview" description="Read-only status from this Android Termux installation">
      <div className="flex flex-col gap-6 px-4 lg:px-6">
        <div className="flex items-center justify-between gap-3">
          <Badge variant="secondary"><ShieldCheck /> Inspection only</Badge>
          <Button variant="outline" disabled={loading} onClick={() => void refresh()}>
            <RefreshCw className={loading ? "animate-spin" : ""} />
            Refresh
          </Button>
        </div>
        {error && (
          <Card>
            <CardContent role="alert" className="text-destructive">
              {error}
            </CardContent>
          </Card>
        )}
        {snapshot && (
          <>
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardDescription>Runtime</CardDescription>
                  <CardTitle>{snapshot.runtime.nodeVersion}</CardTitle>
                </CardHeader>
                <CardContent className="text-muted-foreground">
                  Node.js · {snapshot.runtime.architecture}
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardDescription>Device uptime</CardDescription>
                  <CardTitle>{Math.floor(snapshot.runtime.systemUptimeSeconds / 3600)} h</CardTitle>
                </CardHeader>
                <CardContent className="text-muted-foreground">System-reported uptime</CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardDescription>Available memory</CardDescription>
                  <CardTitle>{snapshot.runtime.freeMemoryMiB.toLocaleString()} MiB</CardTitle>
                </CardHeader>
                <CardContent className="text-muted-foreground">
                  of {snapshot.runtime.totalMemoryMiB.toLocaleString()} MiB
                </CardContent>
              </Card>
            </div>
            <Card>
              <CardHeader>
                <CardTitle><Server className="inline size-4" /> Observed services</CardTitle>
                <CardDescription>
                  External services are never controlled by PocketHost. Status is a read-only snapshot.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="divide-y">
                  {snapshot.services.map((service) => (
                    <div key={service.id} className="flex items-center justify-between gap-4 py-3">
                      <span className="font-medium">{service.label}</span>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">External</Badge>
                        <Badge variant="secondary">{service.state}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-muted-foreground mt-4 text-xs">
                  Observed: {snapshot.observedAt}. Unknown means unavailable or inconclusive, not stopped.
                </p>
              </CardContent>
            </Card>
          </>
        )}
        {!snapshot && !error && <p className="text-muted-foreground">Reading Termux status…</p>}
      </div>
    </BaseLayout>
  )
}
