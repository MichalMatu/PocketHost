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
import { parseInternetConnectivity, type InternetConnectivity } from "@/lib/internet-connectivity-schema"

const POLL_MS = 15_000
const MAX_SAMPLES = 120 // 30 min of in-tab samples, never claimed as durable history

type Sample = {
  observedAt: string
  cpu: number | null
  ram: number | null
  apiMs: number | null
  internetMs: number | null
  internetFailed: boolean | null
  bridgeMs: number | null
  bridgeOnline: boolean | null
}

const resourcesConfig = {
  cpu: { label: "Android CPU", color: "var(--chart-1)" },
  ram: { label: "RAM used", color: "var(--chart-2)" },
} satisfies ChartConfig

const latencyConfig = {
  internetMs: { label: "Internet TCP handshake", color: "var(--chart-3)" },
} satisfies ChartConfig

const bridgeConfig = {
  bridgeMs: { label: "Bridge status API response", color: "var(--chart-4)" },
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
  const began = performance.now()
  const response = await fetch("/api/v1/shizuku/status", {
    credentials: "same-origin",
    cache: "no-store",
    signal: AbortSignal.any([signal, AbortSignal.timeout(9000)]),
  })
  if (!response.ok) throw new Error("bridge-unavailable")
  const bridge = parseShizukuStatus(await response.json() as unknown)
  return { bridge, bridgeMs: Math.max(0, Math.round(performance.now() - began)) }
}

async function getInternet(signal: AbortSignal) {
  const response = await fetch("/api/v1/internet-connectivity", {
    credentials: "same-origin", cache: "no-store",
    signal: AbortSignal.any([signal, AbortSignal.timeout(4500)]),
  })
  if (!response.ok) throw new Error("internet-probe-unavailable")
  return parseInternetConnectivity(await response.json() as unknown)
}

function metricValue(value: string | null, loading: boolean) {
  return loading
    ? <span aria-label="Loading" className="block h-8 w-28 max-w-full animate-pulse rounded bg-muted" />
    : <span className="block min-h-8 truncate leading-8">{value ?? "Unavailable"}</span>
}

function SummaryCard({ title, value, detail, icon: Icon, loading }: {
  title: string
  value: string | null
  detail: string
  icon: typeof Cpu
  loading: boolean
}) {
  return (
    <Card className="min-h-40 min-w-0">
      <CardHeader className="gap-1">
        <CardDescription className="flex items-center gap-2">
          <Icon className="size-4" />{title}
        </CardDescription>
        <CardTitle className="text-2xl tabular-nums">{metricValue(value, loading)}</CardTitle>
      </CardHeader>
      <CardContent className="text-muted-foreground min-h-10 text-xs">{detail}</CardContent>
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
  const [internet, setInternet] = React.useState<InternetConnectivity | null>(null)
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
      const [hostResult, bridgeResult, internetResult] = await Promise.all([
        getHost(controller.signal).catch(() => null),
        getBridge(controller.signal).catch(() => null),
        getInternet(controller.signal).catch(() => null),
      ])
      if (!controller.signal.aborted) {
        const nextHost = hostResult?.host ?? null
        const now = new Date().toISOString()
        setHost(nextHost)
        setBridge(bridgeResult?.bridge ?? null)
        setInternet(internetResult)
        setSampledAt(now)
        setSamples(previous => [...previous, {
          observedAt: now,
          cpu: freshCpu(bridgeResult?.bridge ?? null),
          ram: ramUsedPercent(nextHost),
          apiMs: hostResult?.apiMs ?? null,
          internetMs: internetResult?.latencyMs ?? null,
          internetFailed: internetResult?.state === "unreachable" ? true : internetResult ? false : null,
          bridgeMs: bridgeResult?.bridgeMs ?? null,
          bridgeOnline: bridgeResult?.bridge.connected ?? null,
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
  const bridgeHealth = !bridge ? "Bridge status API unavailable"
    : bridge.connected ? bridge.authorized ? "Connected · authorized" : "Connected · authorization required"
    : "Disconnected · last status received"

  return (
    <BaseLayout title="Dashboard" description="Live status of PocketHost, Termux and the Android Bridge">
      <div className="flex flex-col gap-5 px-4 pb-8 lg:px-6">
        <div className="flex min-h-10 flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">DEV · Private LAN</Badge>
            <Badge variant="outline" className="min-w-36 justify-center">{host ? "Termux online" : "Termux unavailable"}</Badge>
            <span className="text-muted-foreground min-w-40 text-xs tabular-nums" aria-live="polite">
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

        <div className="grid min-w-0 gap-4 xl:grid-cols-2">
          <Card className="min-w-0 xl:col-span-2">
            <CardHeader>
              <CardTitle>Live system resources</CardTitle>
              <CardDescription>Real Android Bridge CPU and Termux RAM usage (%) · sampled every 15 seconds while this tab is open</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="relative h-[260px] min-w-0 w-full" data-testid="resources-chart-slot">
                <ChartContainer config={resourcesConfig} className="aspect-auto h-full min-w-0 w-full">
                  <AreaChart data={samples} margin={{ top: 12, right: 20, bottom: 10, left: 10 }}>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="observedAt" tickLine={false} axisLine={false} minTickGap={36} tickMargin={10} tickFormatter={clock} />
                    <YAxis domain={[0, 100]} tickLine={false} axisLine={false} width={48} tickMargin={8} tickFormatter={value => value + "%"} />
                    <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
                    <Area dataKey="cpu" type="monotone" connectNulls={false} stroke="var(--color-cpu)"
                      fill="var(--color-cpu)" fillOpacity={0.12} strokeWidth={2} dot={samples.length < 3} isAnimationActive={false} />
                    <Area dataKey="ram" type="monotone" connectNulls={false} stroke="var(--color-ram)"
                      fill="var(--color-ram)" fillOpacity={0.10} strokeWidth={2} dot={samples.length < 3} isAnimationActive={false} />
                  </AreaChart>
                </ChartContainer>
                {!samples.some(sample => sample.cpu !== null || sample.ram !== null) && <p className="text-muted-foreground pointer-events-none absolute inset-x-12 top-1/2 -translate-y-1/2 text-center text-sm">Waiting for permitted Android / Termux resource readings.</p>}
              </div>
              <div className="text-muted-foreground flex min-h-10 flex-wrap items-start gap-x-4 gap-y-1 pt-2 text-xs tabular-nums">
                <span>CPU: {cpu === null ? "Unavailable" : cpu.toFixed(1) + "%"} · Android Bridge</span>
                <span>RAM: {ramUsedPercent(host) === null ? "Unavailable" : ramUsedPercent(host) + "%"} · Termux / system-wide</span>
                <span>History is limited to this open tab (max. 30 min).</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Wifi className="size-4" />Internet connectivity · Termux TCP</CardTitle>
              <CardDescription>Fixed TCP handshake to 1.1.1.1:443 · not ICMP ping, download speed or RX/TX</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="relative h-[190px] min-w-0 w-full" data-testid="internet-chart-slot">
                <ChartContainer config={latencyConfig} className="aspect-auto h-full min-w-0 w-full">
                  <LineChart data={samples} margin={{ top: 12, right: 20, bottom: 10, left: 12 }}>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="observedAt" tickLine={false} axisLine={false} minTickGap={36} tickMargin={10} tickFormatter={clock} />
                    <YAxis width={62} tickMargin={8} tickLine={false} axisLine={false} tickFormatter={value => value + " ms"} />
                    <ChartTooltip content={<ChartTooltipContent indicator="line" labelFormatter={(label) => clock(String(label))} />} />
                    <Line type="monotone" dataKey="internetMs" stroke="var(--color-internetMs)" strokeWidth={2}
                      dot={{ r: 2.5 }} activeDot={{ r: 5 }} connectNulls={false} isAnimationActive={false} />
                  </LineChart>
                </ChartContainer>
                {!samples.some(sample => sample.internetMs !== null) && <p className="text-muted-foreground pointer-events-none absolute inset-x-8 top-1/2 -translate-y-1/2 text-center text-sm">No successful Internet TCP connection measured yet.</p>}
              </div>
              <p className="text-muted-foreground min-h-10 pt-2 text-xs tabular-nums">
                {internet?.state === "reachable" ? "TCP endpoint reachable" : internet?.state === "unreachable" ? "TCP endpoint check failed" : "Probe unavailable"}
                {" · "}{samples.filter(sample => sample.internetFailed === false).length} valid readings
                {" · "}{samples.filter(sample => sample.internetFailed === true).length} TCP failures
                {" · "}{samples.filter(sample => sample.internetFailed === null).length} API errors
                {" · "}Panel API {samples.at(-1)?.apiMs ?? "—"} ms
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Wifi className="size-4" />Android Bridge connectivity</CardTitle>
              <CardDescription>Live response time of the existing Bridge status API · not Internet ping or RX/TX</CardDescription>
            </CardHeader>
            <CardContent className="min-w-0">
              <div className="relative h-[190px] min-w-0 w-full" data-testid="bridge-chart-slot">
                <ChartContainer config={bridgeConfig} className="aspect-auto h-full min-w-0 w-full">
                  <LineChart data={samples} margin={{ top: 12, right: 20, bottom: 10, left: 12 }}>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="observedAt" tickLine={false} axisLine={false} minTickGap={36} tickMargin={10} tickFormatter={clock} />
                    <YAxis width={62} tickMargin={8} tickLine={false} axisLine={false} tickFormatter={value => value + " ms"} />
                    <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
                    <Line type="monotone" dataKey="bridgeMs" stroke="var(--color-bridgeMs)" strokeWidth={2}
                      dot={samples.length < 3} connectNulls={false} isAnimationActive={false} />
                  </LineChart>
                </ChartContainer>
                {!samples.some(sample => sample.bridgeMs !== null) && <p className="text-muted-foreground pointer-events-none absolute inset-x-8 top-1/2 -translate-y-1/2 text-center text-sm">No successful Bridge status API request yet.</p>}
              </div>
              <p className="text-muted-foreground flex min-h-9 flex-wrap items-center gap-2 pt-2 text-xs tabular-nums">
                <span>{bridgeHealth}</span><span>·</span><span>{samples.filter(sample => sample.bridgeOnline === false).length} disconnected samples</span>
              </p>
              <p className="text-muted-foreground min-h-8 pt-1 text-xs">
                Full-device RX/TX requires verified Android NetworkStats permission and native Bridge integration.
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
