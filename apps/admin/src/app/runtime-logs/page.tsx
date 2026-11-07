import * as React from "react"
import { Link } from "react-router-dom"
import { BaseLayout } from "@/components/layouts/base-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { parseOwnedSiteLogs } from "@/lib/owned-site-schema"

export default function RuntimeLogsPage() {
  const [logs, setLogs] = React.useState<string[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const refresh = React.useCallback(async (signal?: AbortSignal) => {
    const response = await fetch("/api/v1/owned-site/logs", {
      cache: "no-store", credentials: "same-origin", signal,
    })
    if (!response.ok) throw new Error("Owned logs unavailable")
    const data = parseOwnedSiteLogs(await response.json())
    if (!signal?.aborted) { setLogs(data); setError(null) }
  }, [])
  React.useEffect(() => {
    const controller = new AbortController()
    void refresh(controller.signal)
      .catch(() => { if (!controller.signal.aborted) setError("Runtime logs unavailable; no foreign logs are read.") })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [refresh])
  return (
    <BaseLayout title="Runtime logs" description="Bounded output from the explicit PocketHost-owned test process only.">
      <div className="space-y-4 px-4 pb-8 lg:px-6">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" disabled={loading} onClick={() => {
            setLoading(true)
            void refresh().catch(() => setError("Could not refresh owned logs.")).finally(() => setLoading(false))
          }}>Refresh logs</Button>
          <Link to="/owned-site" className="text-sm underline">Open project details</Link>
        </div>
        {loading && <p role="status">Reading bounded runtime output…</p>}
        {error && <p role="alert" className="text-destructive text-sm">{error}</p>}
        <Card>
          <CardHeader><CardTitle>PocketHost Demo</CardTitle>
            <CardDescription>At most 25 lines. No foreign process logs or live tailing.</CardDescription></CardHeader>
          <CardContent>{logs.length
            ? <pre className="max-h-96 overflow-auto rounded-md bg-muted p-4 text-xs">{logs.join("\n")}</pre>
            : <p className="text-muted-foreground text-sm">No owned process output available.</p>}
          </CardContent>
        </Card>
      </div>
    </BaseLayout>
  )
}
