import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { formatBytes } from "@/lib/format-memory"
import { parseTrafficResult, type TrafficRange, type TrafficResult, type TrafficSummary } from "@/lib/traffic-analytics"

function HistoryChart({ summary, metric }: { summary: TrafficSummary; metric: "requests" | "bytes" }) {
  const hours = summary.range === "24h" ? 24 : 168
  const max = Math.max(1, ...summary.history.map(b => b[metric]))
  const label = metric === "requests" ? "HTTP requests per hour" : "Response payload per hour"
  return <figure className="min-w-0 space-y-1">
    <figcaption className="text-xs font-medium">{label}</figcaption>
    <svg role="img" aria-label={label} className="h-24 w-full rounded border bg-muted/20 text-primary"
      viewBox="0 0 336 80" preserveAspectRatio="none">
      <line x1="0" y1="79" x2="336" y2="79" stroke="currentColor" opacity=".25" />
      {summary.history.map(b => {
        const x = (b.at - summary.from) / 3600000 * 336 / hours
        const height = b[metric] / max * 76
        return <rect key={b.at} x={x} y={79 - height} width={336 / hours * .8}
          height={height} fill="currentColor">
          <title>{new Date(b.at).toLocaleString()} · {metric === "bytes" ? formatBytes(b.bytes) : b.requests}</title>
        </rect>
      })}
    </svg>
    <div className="flex justify-between gap-2 text-[10px] text-muted-foreground">
      <time>{new Date(summary.from).toLocaleString()}</time>
      <span>Peak {metric === "bytes" ? formatBytes(max === 1 && !summary.bytes ? 0 : max) : Math.max(0, ...summary.history.map(b => b.requests))}</span>
      <time>{new Date(summary.observedAt).toLocaleString()}</time>
    </div>
  </figure>
}

/** Fetch only on explicit open / refresh; never create a background polling loop. */
export function TrafficPanel({ projectId, kind }: { projectId: string; kind: "static" | "node" }) {
  const [open, setOpen] = useState(false)
  const [range, setRange] = useState<TrafficRange>("24h")
  const [version, setVersion] = useState(0)
  const [loaded, setLoaded] = useState<{ key: string; result: TrafficResult | null } | null>(null)
  const key = projectId + ":" + range + ":" + version
  useEffect(() => {
    if (!open) return
    const controller = new AbortController()
    const api = kind === "static" ? "sites" : "node-projects"
    void (async () => {
      try {
        const response = await fetch("/api/v1/" + api + "/" + encodeURIComponent(projectId) + "/traffic?range=" + range,
          { signal: controller.signal, cache: "no-store" })
        if (!response.ok) throw new Error("Traffic request failed")
        const result = parseTrafficResult(await response.json(), projectId, range)
        if (!controller.signal.aborted) setLoaded({ key, result })
      } catch {
        if (!controller.signal.aborted) setLoaded({ key, result: null })
      }
    })()
    return () => controller.abort()
  }, [key, open, kind, projectId, range])
  const current = loaded?.key === key ? loaded : null
  const data = current?.result
  return <section className="space-y-3 rounded-lg border p-4 text-sm" aria-label="Traffic Analytics">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div><h3 className="font-semibold">Traffic Analytics</h3>
        <p className="text-xs text-muted-foreground">Completed HTTP responses for this project</p></div>
      <Button size="sm" variant="outline" aria-expanded={open} onClick={() => {
        if (!open) setVersion(v => v + 1)
        setOpen(v => !v)
      }}>{open ? "Hide traffic" : "Show traffic"}</Button>
    </div>
    {open && <>
      <div className="flex flex-wrap gap-2">
        {(["24h", "7d"] as const).map(item => <Button key={item} size="sm"
          variant={range === item ? "default" : "outline"} aria-pressed={range === item}
          onClick={() => setRange(item)}>{item}</Button>)}
        <Button size="sm" variant="outline" onClick={() => setVersion(v => v + 1)}>Refresh traffic</Button>
      </div>
      {!current && <p role="status">Loading traffic…</p>}
      {current && !data && <p role="alert">Traffic data unavailable. Try Refresh traffic.</p>}
      {data?.state === "unavailable" && <p role="alert">Traffic storage unavailable.</p>}
      {data?.state === "missing" && <p role="status">No collector snapshot yet. Existing applications begin collecting on their next normal start.</p>}
      {data?.state === "available" && <>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {[
            ["HTTP requests", data.summary.requests.toLocaleString()],
            ["Response payload", formatBytes(data.summary.bytes)],
            ["RPS (60 s)", data.summary.rps === null ? "Not measured" : data.summary.rps.toFixed(2)],
          ].map(([label, value]) => <div key={label} className="rounded-md border p-3">
            <div className="text-xs text-muted-foreground">{label}</div>
            <div className="text-lg font-semibold tabular-nums">{value}</div>
          </div>)}
        </div>
        <p className="text-xs text-muted-foreground">
          {data.current ? "Current process snapshot" : "Historical snapshot; current process not verified"} · Saved {new Date(data.persistedAt).toLocaleString()}.
          {" "}Writes are batched; recent traffic may not be included yet.
        </p>
        <div className="grid gap-3 md:grid-cols-2">
          <HistoryChart summary={data.summary} metric="requests" />
          <HistoryChart summary={data.summary} metric="bytes" />
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div><h4 className="font-medium">HTTP status codes</h4>
            {data.summary.statuses.length === 0 && <p className="text-xs text-muted-foreground">No recorded responses</p>}
            <ul className="max-h-48 overflow-auto text-xs">{data.summary.statuses.map(([status, n]) =>
              <li key={status} className="flex justify-between border-b py-1"><span>{status}</span><span>{n}</span></li>)}</ul>
          </div>
          <div><h4 className="font-medium">Top paths</h4>
            {data.summary.topPaths.length === 0 && <p className="text-xs text-muted-foreground">No recorded paths</p>}
            <ul className="max-h-48 overflow-auto text-xs">{data.summary.topPaths.map(([route, n]) =>
              <li key={route} className="flex justify-between gap-2 border-b py-1"><span className="break-all">{route}</span><span>{n}</span></li>)}</ul>
            {data.summary.otherPaths > 0 && <p className="text-xs text-muted-foreground">{data.summary.otherPaths} requests outside tracked paths; counts are lower bounds.</p>}
          </div>
        </div>
      </>}
      <p className="text-xs text-muted-foreground">Up to 7 days of hourly history; blank hours have no recorded responses. Payload excludes HTTP headers. Node readiness probes excluded. Query strings are not stored.</p>
    </>}
  </section>
}
