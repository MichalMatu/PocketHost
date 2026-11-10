import * as React from "react"
import { Activity, Cpu, HardDrive, RefreshCw, ServerCog, Wifi } from "lucide-react"
import { Area, AreaChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts"
import { Link } from "react-router-dom"
import { BaseLayout } from "@/components/layouts/base-layout"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { formatMemory } from "@/lib/format-memory"
import { parseHostSnapshot, type HostSnapshot } from "@/lib/host-snapshot-schema"
import { parseShizukuStatus, type ShizukuStatus } from "@/lib/shizuku-schema"

const POLL_MS = 15_000
const MAX_SAMPLES = 120 // 30 min of in-tab samples, never claimed as durable history

type Sample = {
  observedAt: string
  cpu: number | null
  ram: number | null
  apiMs: number | null
}

const resourcesConfig = {
  cpu: { label: "Android CPU", color: "var(--chart-1)" },
  ram: { label: "RAM used", color: "var(--chart-2)" },
} satisfies ChartConfig

const latencyConfig = {
  apiMs: { label: "Panel API response", color: "var(--chart-3)" },
} satisfies ChartConfig

function clock(value: string | number) {
  return new Date(value).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" })
}

async function getHost(signal: AbortSignal) {
  const began = performance.now()
  const response = await fetch("/api/v1/host/snapshot", {
    credentials: "same-origin",
    cache: "no-store",
    signal: AbortSignal.any([signal, AbortSignal.timeout(9000)]),
  })
  if (!response.ok) throw new Error("host-unavailable")
  const host = parseHostSnapshot(await response.json() as unknown)
  return { host, apiMs: Math.max(0, Math.round(performance.now() - began)) }
}

async function getBridge(signal: AbortSignal) {
  const response = await fetch("/api/v1/shizuku/status", {
    credentials: "same-origin",
    cache: "no-store",
    signal: AbortSignal.any([signal, AbortSignal.timeout(9000)]),
  })
  if (!response.ok) throw new Error("bridge-unavailable")
  return parseShizukuStatus(await response.json() as unknown)
}

function metricValue(value: string | null, loading: boolean) {
  return loading
    ? <span aria-label="Loading" className="block h-7 w-28 max-w-full animate-pulse rounded bg-muted" />
    : value ?? "Unavailable"
}

function SummaryCard({ title, value, detail, icon: Icon, loading }: {
  title: string
  value: string | null
  detail: string
  icon: typeof Cpu
  loading: boolean
}) {
  return (
    <Card className="min-h-36">
      <CardHeader className="gap-1">
        <CardDescription className="flex items-center gap-2">
          <Icon className="size-4" />{title}
        </CardDescription>
        <CardTitle className="text-2xl tabular-nums">{metricValue(value, loading)}</CardTitle>
      </CardHeader>
      <CardContent className="text-muted-foreground text-xs">{detail}</CardContent>
    </Card>
  )
}

function freshCpu(bridge: ShizukuStatus | null) {
  if (!bridge || !bridge.connected || !bridge.authorized || bridge.cpuPercent === null) return null
  const age = Date.now() - Date.parse(bridge.observedAt)
  return age >= 0 && age <= 45_000 ? bridge.cpuPercent : null
}

function ramUsedPercent(host: HostSnapshot | null) {
  if (!host || host.runtime.totalMemoryMiB <= 0) return null
  return Math.round(1000 * (host.runtime.totalMemoryMiB - host.runtime.freeMemoryMiB) / host.runtime.totalMemoryMiB) / 10
}

export default function SystemPage() {
  const [host, setHost] = React.useState<HostSnapshot | null>(null)
  const [bridge, setBridge] = React.useState<ShizukuStatus | null>(null)
  const [samples, setSamples] = React.useState<Sample[]>([])
  const [loading, setLoading] = React.useState(true)
  const [sampledAt, setSampledAt] = React.useState<string | null>(null)
  const [generation, setGeneration] = React.useState(0)

  React.useEffect(() => {
    const controller = new AbortController()
    let busy = false

    async function poll() {
      if (busy || controller.signal.aborted) return
      busy = true
      const [hostResult, bridgeResult] = await Promise.all([
        getHost(controller.signal).catch(() => null),
        getBridge(controller.signal).catch(() => null),
      ])
      if (!controller.signal.aborted) {
        const nextHost = hostResult?.host ?? null
        const now = new Date().toISOString()
        setHost(nextHost)
        setBridge(bridgeResult)
        setSampledAt(now)
        setSamples(previous => [...previous, {
          observedAt: now,
          cpu: freshCpu(bridgeResult),
          ram: ramUsedPercent(nextHost),
          apiMs: hostResult?.apiMs ?? null,
        }].slice(-MAX_SAMPLES))
        setLoading(false)
      }
      busy = false
    }

    void poll()
    const timer = window.setInterval(() => {
      if (document.visibilityState !== "hidden") void poll()
    }, POLL_MS)
    return () => {
      controller.abort()
      window.clearInterval(timer)
    }
  }, [generation])

  const cpu = freshCpu(bridge)
  const servicesRunning = host?.services.filter(service => service.state === "running").length ?? null
  const serviceUnknown = host?.services.some(service => service.state === "unknown") ?? false
  const active = !sampledAt && loading
  const bridgeState = bridge?.connected && bridge.authorized
    ? cpu === null ? "Android Bridge: CPU sample unavailable" : "Android Bridge: authorized"
    : "Android Bridge: disconnected or unauthorized"

  return (
    <BaseLayout title="Dashboard" description="Live status of PocketHost, Termux and the Android Bridge">
      <div className="flex flex-col gap-5 px-4 pb-8 lg:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">DEV · Private LAN</Badge>
            <Badge variant="outline">{host ? "Termux online" : "Termux unavailable"}</Badge>
            <span className="text-muted-foreground text-xs" aria-live="polite">
              {sampledAt ? "Last checked " + clock(sampledAt) : "Checking live sources"}
            </span>
          </div>
          <Button variant="outline" size="sm" onClick={() => setGeneration(value => value + 1)}>
            <RefreshCw className="size-4" />Refresh
          </Button>
        </div>

        <div data-testid="system-metrics" aria-busy={active} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard title="Android CPU" value={cpu === null ? null : cpu.toFixed(1) + "%"}
            icon={Cpu} loading={active} detail={bridgeState} />
          <SummaryCard title="Available RAM" value={host ? formatMemory(host.runtime.freeMemoryMiB) : null}
            icon={Activity} loading={active} detail={host ? "of " + formatMemory(host.runtime.totalMemoryMiB) + " · system-wide" : "Termux measurement unavailable"} />
          <SummaryCard title="Termux storage" value={host?.runtime.storage ? formatMemory(host.runtime.storage.availableMiB) : null}
            icon={HardDrive} loading={active} detail="Available space on Termux home filesystem" />
          <SummaryCard title="Observed services" value={servicesRunning === null ? null : servicesRunning + " / " + host!.services.length}
            icon={ServerCog} loading={active} detail={serviceUnknown ? "Some service states unknown · read-only" : "Running external services · read-only"} />
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <Card className="xl:col-span-2">
            <CardHeader>
              <CardTitle>Live system resources</CardTitle>
              <CardDescription>Real Android Bridge CPU and Termux RAM usage (%) · sampled every 15 seconds while this tab is open</CardDescription>
            </CardHeader>
            <CardContent>
              {samples.some(sample => sample.cpu !== null || sample.ram !== null) ? (
                <ChartContainer config={resourcesConfig} className="aspect-auto h-[260px] w-full">
                  <AreaChart data={samples}>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="observedAt" tickLine={false} axisLine={false} minTickGap={36} tickFormatter={clock} />
                    <YAxis domain={[0, 100]} tickLine={false} axisLine={false} width={35} tickFormatter={value => value + "%"} />
                    <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
                    <Area dataKey="cpu" type="monotone" connectNulls={false} stroke="var(--color-cpu)"
                      fill="var(--color-cpu)" fillOpacity={0.12} strokeWidth={2} dot={samples.length < 3} />
                    <Area dataKey="ram" type="monotone" connectNulls={false} stroke="var(--color-ram)"
                      fill="var(--color-ram)" fillOpacity={0.10} strokeWidth={2} dot={samples.length < 3} />
                  </AreaChart>
                </ChartContainer>
              ) : <p className="text-muted-foreground py-12 text-center text-sm">
                Waiting for permitted Android / Termux resource readings.
              </p>}
              <div className="text-muted-foreground flex flex-wrap gap-4 pt-2 text-xs">
                <span>CPU: {cpu === null ? "Unavailable" : cpu.toFixed(1) + "%"} · Android Bridge</span>
                <span>RAM: {ramUsedPercent(host) === null ? "Unavailable" : ramUsedPercent(host) + "%"} · Termux / system-wide</span>
                <span>History is limited to this open tab (max. 30 min).</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Wifi className="size-4" />PocketHost API response</CardTitle>
              <CardDescription>Actual browser-to-panel HTTP response duration, in milliseconds — not Internet ping</CardDescription>
            </CardHeader>
            <CardContent>
              {samples.some(sample => sample.apiMs !== null) ? (
                <ChartContainer config={latencyConfig} className="aspect-auto h-[190px] w-full">
                  <LineChart data={samples}>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="observedAt" tickLine={false} axisLine={false} minTickGap={36} tickFormatter={clock} />
                    <YAxis width={35} tickLine={false} axisLine={false} tickFormatter={value => value + "ms"} />
                    <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
                    <Line type="monotone" dataKey="apiMs" stroke="var(--color-apiMs)" strokeWidth={2}
                      dot={samples.length < 3} connectNulls={false} />
                  </LineChart>
                </ChartContainer>
              ) : <p className="text-muted-foreground py-12 text-center text-sm">
                No successful PocketHost API request yet.
              </p>}
              <p className="text-muted-foreground pt-2 text-xs">
                Actual LAN / Internet latency probes will be a separate backend measurement.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Network traffic · RX / TX</CardTitle>
              <CardDescription>Full-device traffic requires a verified native Android Bridge source</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex min-h-[190px] flex-col items-center justify-center gap-3 text-center">
                <Wifi className="text-muted-foreground size-7" />
                <p className="font-medium">Not available yet</p>
                <p className="text-muted-foreground max-w-sm text-sm">
                  Samsung denies Termux access to device RX/TX counters. Bridge network statistics
                  require a separate Android permission and measurement accuracy check.
                </p>
              </div>
              <p className="text-muted-foreground text-xs">
                No simulated traffic or background network scanning.
              </p>
            </CardContent>
          </Card>
        </div>

        <p className="text-muted-foreground text-xs">
          Read-only device observations. For details open <Link to="/observability" className="underline">Termux monitoring</Link>
          {" or "}<Link to="/shizuku" className="underline">Android & Shizuku</Link>.
          Measurements may become unavailable if permissions change or the native Bridge stops.
        </p>
      </div>
    </BaseLayout>
  )
}
