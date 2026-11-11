import * as React from "react"
import { Activity, Battery, Clock3, Cpu, HardDrive, RefreshCw, ServerCog, Wifi } from "lucide-react"
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { BaseLayout } from "@/components/layouts/base-layout"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart"
import { DashboardTooltip, historyTime, type TooltipFields } from "./dashboard-tooltip"
import { formatMemory } from "@/lib/format-memory"
import { parseHostSnapshot, type HostSnapshot } from "@/lib/host-snapshot-schema"
import { parseShizukuStatus, type ShizukuStatus } from "@/lib/shizuku-schema"
import { parseInternetConnectivity, type InternetConnectivity } from "@/lib/internet-connectivity-schema"
import { parseDashboardHistory, type DashboardHistoryEvent, type DashboardHistoryPoint } from "@/lib/dashboard-history-schema"
import { formatTrafficMbps, trafficMbps } from "@/lib/network-traffic"

const POLL_MS = 15_000
const MAX_SAMPLES = 1680 // 24h full-resolution, 7d hourly archive and bounded in-tab readings

type Sample = {
  observedAt: string
  cpu: number | null
  ram: number | null
  apiMs: number | null
  internetMs: number | null
  internetFailed: boolean | null
  bridgeMs: number | null
  bridgeOnline: boolean | null
  batteryPercent?: number | null
  batteryCharging?: boolean | null
  batteryTempC?: number | null
  dnsMs?: number | null
  dnsFailed?: boolean | null
  storageUsedPercent?: number | null
  systemUptimeSeconds?: number | null
  networkRxBytes?: number | null
  networkTxBytes?: number | null
  networkObservedAt?: string | null
}

// Match the original ShadcnStore dashboard: theme-neutral primary, soft area fills.
const resourcesConfig = {
  cpu: { label: "Android CPU", color: "var(--primary)" },
  ram: { label: "RAM used", color: "var(--primary)" },
} satisfies ChartConfig

const latencyConfig = {
  internetMs: { label: "Internet TCP handshake", color: "var(--primary)" },
} satisfies ChartConfig

const bridgeConfig = {
  bridgeMs: { label: "Bridge status API response", color: "var(--primary)" },
} satisfies ChartConfig

const trafficConfig = {
  networkRxMbps: { label: "RX", color: "var(--primary)" },
  networkTxMbps: { label: "TX", color: "var(--primary)" },
} satisfies ChartConfig

const powerConfig = {
  batteryPercent: { label: "Battery", color: "var(--primary)" },
  storageUsedPercent: { label: "Storage used", color: "var(--primary)" },
} satisfies ChartConfig

const tooltipFields = {
  resources: {
    cpu: { label: "Android CPU", unit: "%", decimals: 1 },
    ram: { label: "RAM used", unit: "%", decimals: 1 },
  },
  internet: { internetMs: { label: "TCP handshake", unit: "ms", decimals: 1 } },
  traffic: {
    networkRxMbps: { label: "RX", unit: "Mb/s", decimals: 3 },
    networkTxMbps: { label: "TX", unit: "Mb/s", decimals: 3 },
  },
  bridge: { bridgeMs: { label: "Bridge response", unit: "ms", decimals: 1 } },
  power: {
    batteryPercent: { label: "Battery", unit: "%", decimals: 1 },
    storageUsedPercent: { label: "Storage used", unit: "%", decimals: 1 },
  },
} satisfies Record<string, TooltipFields>

function clock(value: string | number) {
  return new Date(value).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" })
}

function uptime(seconds: number | null) {
  if (seconds === null || !Number.isFinite(seconds)) return "Unavailable"
  const hours = Math.floor(seconds / 3600)
  return Math.floor(hours / 24) + "d " + (hours % 24) + "h"
}

function latencySummary(values: (number | null)[]) {
  const valid = values.filter((value): value is number => value !== null && Number.isFinite(value)).sort((a, b) => a - b)
  if (!valid.length) return "No latency readings"
  const median = valid[Math.floor((valid.length - 1) / 2)]!
  return "Median " + Math.round(median) + " ms · peak " + Math.round(valid[valid.length - 1]!) + " ms"
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

function mergeHistory(previous: Sample[], stored: DashboardHistoryPoint[]): Sample[] {
  const merged = new Map<string, Sample>()
  for (const item of stored) merged.set(item.observedAt, {
    observedAt: item.observedAt,
    cpu: item.cpu, ram: item.ram, internetMs: item.internetMs,
    internetFailed: item.internetFailed, bridgeMs: item.bridgeMs,
    bridgeOnline: item.bridgeOnline, apiMs: null,
    batteryPercent: item.batteryPercent ?? null,
    batteryCharging: item.batteryCharging ?? null,
    batteryTempC: item.batteryTempC ?? null,
    dnsMs: item.dnsMs ?? null,
    dnsFailed: item.dnsFailed ?? null,
    storageUsedPercent: item.storageUsedPercent ?? null,
    systemUptimeSeconds: item.systemUptimeSeconds,
    networkRxBytes: item.networkRxBytes ?? null,
    networkTxBytes: item.networkTxBytes ?? null,
    networkObservedAt: item.networkObservedAt ?? null,
  })
  for (const item of previous) merged.set(item.observedAt, item)
  return [...merged.values()]
    .sort((a, b) => Date.parse(a.observedAt) - Date.parse(b.observedAt))
    .slice(-MAX_SAMPLES)
}

async function getSavedHistory(signal: AbortSignal, range: "1h" | "24h" | "7d") {
  const response = await fetch("/api/v1/dashboard/history?range=" + range, {
    credentials: "same-origin", cache: "no-store",
    signal: AbortSignal.any([signal, AbortSignal.timeout(4500)]),
  })
  if (!response.ok) throw new Error("history-unavailable")
  return parseDashboardHistory(await response.json() as unknown)
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

function freshCpu(bridge: ShizukuStatus | null, referenceTimeMs: number | null) {
  if (referenceTimeMs === null || !bridge || !bridge.connected || !bridge.authorized || bridge.cpuPercent === null) return null
  const age = referenceTimeMs - Date.parse(bridge.observedAt)
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
  const [historyState, setHistoryState] = React.useState<"loading" | "ok" | "unavailable">("loading")
  const [historyRange, setHistoryRange] = React.useState<"1h" | "24h" | "7d">("1h")
  const [recentEvents, setRecentEvents] = React.useState<DashboardHistoryEvent[]>([])
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
          cpu: freshCpu(bridgeResult?.bridge ?? null, Date.parse(now)),
          ram: ramUsedPercent(nextHost),
          apiMs: hostResult?.apiMs ?? null,
          internetMs: internetResult?.latencyMs ?? null,
          internetFailed: internetResult?.state === "unreachable" ? true : internetResult ? false : null,
          bridgeMs: bridgeResult?.bridgeMs ?? null,
          bridgeOnline: bridgeResult?.bridge.connected ?? null,
          networkRxBytes: bridgeResult?.bridge.network?.rxBytes ?? null,
          networkTxBytes: bridgeResult?.bridge.network?.txBytes ?? null,
          networkObservedAt: bridgeResult?.bridge.network?.observedAt ?? null,
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

  React.useEffect(() => {
    const controller = new AbortController()
    void getSavedHistory(controller.signal, historyRange).then(history => {
      if (controller.signal.aborted) return
      setHistoryState(history.state)
      if (history.state === "ok") {
        const cutoff = Date.now() - (historyRange === "7d" ? 604800000 : historyRange === "24h" ? 86400000 : 3600000)
        setSamples(previous => mergeHistory(
          previous.filter(item => Date.parse(item.observedAt) >= cutoff), history.samples))
        setRecentEvents(history.events ?? [])
      }
    }).catch(() => {
      if (!controller.signal.aborted) setHistoryState("unavailable")
    })
    return () => controller.abort()
  }, [generation, historyRange])

  // Use a timestamp captured by the polling effect, never an impure clock read during render.
  const referenceTimeMs = sampledAt === null ? null : Date.parse(sampledAt)
  const lastCollected = [...samples].reverse().find(sample =>
    sample.batteryPercent !== undefined || sample.dnsFailed !== undefined) ?? null
  const collectedAge = referenceTimeMs === null || lastCollected === null ? null :
    referenceTimeMs - Date.parse(lastCollected.observedAt)
  const collectedFresh = collectedAge !== null && collectedAge >= 0 && collectedAge <= 150000
  const collectorLabel = historyState === "loading" ? "Collector: checking"
    : historyState === "unavailable" ? "Collector: unavailable"
    : !lastCollected ? "Collector: no samples"
    : collectedFresh ? "Collector: current" : "Collector: stale"
  const batteryPercent = collectedFresh ? lastCollected?.batteryPercent ?? null : null
  const batteryCharging = collectedFresh ? lastCollected?.batteryCharging ?? null : null
  const batteryTempC = collectedFresh ? lastCollected?.batteryTempC ?? null : null
  const dnsMs = collectedFresh ? lastCollected?.dnsMs ?? null : null
  const dnsFailed = collectedFresh ? lastCollected?.dnsFailed ?? null : null
  const alerts: string[] = []
  if (historyState === "ok" && !collectedFresh) alerts.push("Collector history is stale")
  if (batteryPercent !== null && batteryCharging === false && batteryPercent <= 20)
    alerts.push("Low battery · " + batteryPercent + "%")
  const storageAvailable = host?.runtime.storage?.availableMiB ?? null
  if (storageAvailable != null && storageAvailable <= 512)
    alerts.push("Low Termux storage · " + Math.round(storageAvailable) + " MiB left")
  if (host?.services.some(service => service.state === "stopped"))
    alerts.push("Observed service stopped · see Services")
  if (host?.services.some(service => service.state === "unknown"))
    alerts.push("Some service states unknown")
  if (internet?.state === "unreachable") alerts.push("Internet TCP probe failed")

  const chartSamples = samples.map(sample => ({ ...sample, timestamp: Date.parse(sample.observedAt) }))
  const trafficSamples = chartSamples.map((sample, i) => ({
    ...sample, ...trafficMbps(i ? samples[i - 1]! : null, sample),
  }))
  const lastTraffic = [...trafficSamples].reverse().find(sample =>
    sample.networkRxMbps !== null || sample.networkTxMbps !== null)
  const trafficAge = referenceTimeMs === null || !lastTraffic?.networkObservedAt ? null :
    referenceTimeMs - Date.parse(lastTraffic.networkObservedAt)
  const trafficFresh = trafficAge !== null && trafficAge >= 0 && trafficAge <= 150000
  const rxMbps = trafficFresh ? lastTraffic?.networkRxMbps ?? null : null
  const txMbps = trafficFresh ? lastTraffic?.networkTxMbps ?? null : null

  const cpu = freshCpu(bridge, referenceTimeMs)
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
    <BaseLayout title="Dashboard" description="Live health of the Android host and services">
      <div className="flex flex-col gap-5 px-4 pb-8 lg:px-6">
        <div className="flex min-h-10 flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{host ? "Termux online" : "Termux unavailable"}</Badge>
            <Badge variant="outline">{collectorLabel}</Badge>
            {sampledAt && <Badge variant="outline">Checked {clock(sampledAt)}</Badge>}
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
            icon={HardDrive} loading={active} detail="Free on the Termux home filesystem" />
          <SummaryCard title="Observed services" value={servicesRunning === null ? null : servicesRunning + " / " + host!.services.length}
            icon={ServerCog} loading={active} detail={serviceUnknown ? "Some service states unknown · read-only" : "Running external services · read-only"} />
        </div>

        <div className="grid gap-3 sm:grid-cols-3" data-testid="device-status">
          <Card className="min-h-28">
            <CardHeader className="gap-1">
              <CardDescription className="flex items-center gap-2"><Battery className="size-4" />Battery · Termux:API</CardDescription>
              <CardTitle className="text-lg tabular-nums">{batteryPercent === null ? "Unavailable" : batteryPercent + "%"}</CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground min-h-5 text-xs">
              {batteryCharging === true ? "Charging" : batteryCharging === false ? "Not charging" : "Charge state unavailable"}
              {" · "}{batteryTempC === null ? "Temperature unavailable" : batteryTempC.toFixed(1) + "°C"}
            </CardContent>
          </Card>
          <Card className="min-h-28">
            <CardHeader className="gap-1">
              <CardDescription className="flex items-center gap-2"><Clock3 className="size-4" />Device uptime</CardDescription>
              <CardTitle className="text-lg tabular-nums">{uptime(host?.runtime.systemUptimeSeconds ?? null)}</CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground min-h-5 text-xs">Since device boot</CardContent>
          </Card>
          <Card className="min-h-28">
            <CardHeader className="gap-1">
              <CardDescription className="flex items-center gap-2"><Wifi className="size-4" />DNS · Termux</CardDescription>
              <CardTitle className="text-lg tabular-nums">{dnsMs === null ? "Unavailable" : dnsMs.toFixed(1) + " ms"}</CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground min-h-5 text-xs">
              {dnsFailed === true ? "Fixed DNS lookup failed" : dnsFailed === false ? "Fixed DNS lookup successful" : "No recent DNS sample"}
            </CardContent>
          </Card>
        </div>

        <div role="status" aria-label="Active health alerts"
          className="text-muted-foreground flex min-h-6 flex-wrap gap-x-4 gap-y-1 text-xs">
          {alerts.length ? alerts.map(item => <span key={item}>{item}</span>) : "No alerts in available readings."}
        </div>

        <div className="flex min-h-8 items-center justify-between gap-3">
          <span className="text-muted-foreground text-xs">History · 24 h detailed, 7 d hourly</span>
          <div className="flex gap-1" role="group" aria-label="History window">
            <Button variant={historyRange === "1h" ? "secondary" : "outline"} size="sm" onClick={() => setHistoryRange("1h")}>1 hour</Button>
            <Button variant={historyRange === "24h" ? "secondary" : "outline"} size="sm" onClick={() => setHistoryRange("24h")}>24 hours</Button>
            <Button variant={historyRange === "7d" ? "secondary" : "outline"} size="sm" onClick={() => setHistoryRange("7d")}>7 days</Button>
          </div>
        </div>

        <div className="grid min-w-0 gap-4 xl:grid-cols-2">
          <Card className="min-w-0 xl:col-span-2">
            <CardHeader>
              <CardTitle>Live system resources</CardTitle>
              <CardDescription>Android CPU and system RAM · percent used</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="relative h-[260px] min-w-0 w-full" data-testid="resources-chart-slot">
                <ChartContainer config={resourcesConfig} className="aspect-auto h-full min-w-0 w-full">
                  <AreaChart data={chartSamples} margin={{ top: 12, right: 20, bottom: 10, left: 10 }}>
                    <defs>
                      <linearGradient id="pockethost-cpu-fill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--color-cpu)" stopOpacity={0.07} />
                        <stop offset="95%" stopColor="var(--color-cpu)" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="pockethost-ram-fill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--color-ram)" stopOpacity={0.16} />
                        <stop offset="95%" stopColor="var(--color-ram)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="timestamp" type="number" scale="time" domain={["dataMin", "dataMax"]} tickLine={false} axisLine={false} minTickGap={36} tickMargin={10} tickFormatter={value => historyTime(Number(value), historyRange)} />
                    <YAxis domain={[0, 100]} tickLine={false} axisLine={false} width={48} tickMargin={8} tickFormatter={value => value + "%"} />
                    <ChartTooltip cursor={false} content={<DashboardTooltip range={historyRange} fields={tooltipFields.resources} />} />
                    <Area dataKey="cpu" type="monotone" connectNulls={false} stroke="var(--color-cpu)"
                      strokeOpacity={0.55} fill="url(#pockethost-cpu-fill)" strokeWidth={1.5}
                      dot={false} activeDot={false} isAnimationActive={false} />
                    <Area dataKey="ram" type="monotone" connectNulls={false} stroke="var(--color-ram)"
                      strokeOpacity={0.95} fill="url(#pockethost-ram-fill)" strokeWidth={1.5}
                      dot={false} activeDot={false} isAnimationActive={false} />
                  </AreaChart>
                </ChartContainer>
                {!samples.some(sample => sample.cpu !== null || sample.ram !== null) && <p className="text-muted-foreground pointer-events-none absolute inset-x-12 top-1/2 -translate-y-1/2 text-center text-sm">Waiting for permitted Android / Termux resource readings.</p>}
              </div>
              <div className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 pt-2 text-xs">
                <span>CPU · Android</span>
                <span>RAM used · system-wide</span>
                {historyState !== "ok" && <span>{historyState === "unavailable" ? "Saved history unavailable" : "Loading saved history…"}</span>}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Wifi className="size-4" />Internet connectivity · Termux TCP</CardTitle>
              <CardDescription>TCP handshake to 1.1.1.1:443</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="relative h-[190px] min-w-0 w-full" data-testid="internet-chart-slot">
                <ChartContainer config={latencyConfig} className="aspect-auto h-full min-w-0 w-full">
                  <AreaChart data={chartSamples} margin={{ top: 12, right: 20, bottom: 10, left: 12 }}>
                    <defs>
                      <linearGradient id="pockethost-tcp-fill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--color-internetMs)" stopOpacity={0.16} />
                        <stop offset="95%" stopColor="var(--color-internetMs)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="timestamp" type="number" scale="time" domain={["dataMin", "dataMax"]} tickLine={false} axisLine={false} minTickGap={36} tickMargin={10} tickFormatter={value => historyTime(Number(value), historyRange)} />
                    <YAxis width={62} tickMargin={8} tickLine={false} axisLine={false} tickFormatter={value => value + " ms"} />
                    <ChartTooltip cursor={false} content={<DashboardTooltip range={historyRange} fields={tooltipFields.internet} />} />
                    <Area type="monotone" dataKey="internetMs" stroke="var(--color-internetMs)"
                      fill="url(#pockethost-tcp-fill)" strokeWidth={1.5} connectNulls={false}
                      dot={false} activeDot={false} isAnimationActive={false} />
                  </AreaChart>
                </ChartContainer>
                {!samples.some(sample => sample.internetMs !== null) && <p className="text-muted-foreground pointer-events-none absolute inset-x-8 top-1/2 -translate-y-1/2 text-center text-sm">No successful Internet TCP connection measured yet.</p>}
              </div>
              <p className="text-muted-foreground min-h-10 pt-2 text-xs tabular-nums">
                {internet?.state === "reachable" ? "TCP endpoint reachable" : internet?.state === "unreachable" ? "TCP endpoint check failed" : "TCP probe unavailable"}
                {" · "}{latencySummary(samples.map(sample => sample.internetMs))}
                {" · "}{samples.filter(sample => sample.internetFailed === true).length} failures
                {" · "}{samples.filter(sample => sample.internetFailed === null).length} unavailable
                {" · "}Panel API {samples.at(-1)?.apiMs ?? "—"} ms
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Wifi className="size-4" />Android network · RX / TX</CardTitle>
              <CardDescription>Android TrafficStats · sampled RX/TX, all interfaces</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="relative h-[190px] min-w-0 w-full" data-testid="traffic-chart-slot">
                <ChartContainer config={trafficConfig} className="aspect-auto h-full min-w-0 w-full">
                  <AreaChart data={trafficSamples} margin={{ top: 12, right: 20, bottom: 10, left: 12 }}>
                    <defs>
                      <linearGradient id="pockethost-traffic-fill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--color-networkRxMbps)" stopOpacity={0.12} />
                        <stop offset="95%" stopColor="var(--color-networkRxMbps)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="timestamp" type="number" scale="time" domain={["dataMin", "dataMax"]} tickLine={false} axisLine={false} minTickGap={36} tickMargin={10} tickFormatter={value => historyTime(Number(value), historyRange)} />
                    <YAxis width={62} tickMargin={8} tickLine={false} axisLine={false} tickFormatter={value => value + " Mb/s"} />
                    <ChartTooltip cursor={false} content={<DashboardTooltip range={historyRange} fields={tooltipFields.traffic} />} />
                    <Area dataKey="networkRxMbps" type="monotone" connectNulls={false} stroke="var(--color-networkRxMbps)"
                      fill="url(#pockethost-traffic-fill)" strokeWidth={1.5} dot={false} activeDot={false} isAnimationActive={false} />
                    <Area dataKey="networkTxMbps" type="monotone" connectNulls={false} stroke="var(--color-networkTxMbps)"
                      strokeOpacity={0.45} fill="transparent" strokeWidth={1.25} dot={false} activeDot={false} isAnimationActive={false} />
                  </AreaChart>
                </ChartContainer>
                {!trafficSamples.some(sample => sample.networkRxMbps !== null || sample.networkTxMbps !== null) &&
                  <p className="text-muted-foreground pointer-events-none absolute inset-x-8 top-1/2 -translate-y-1/2 text-center text-sm">
                    Waiting for two supported Android network counter readings.
                  </p>}
              </div>
              <p className="text-muted-foreground min-h-9 pt-2 text-xs tabular-nums" aria-label="Android transfer rates">
                RX: {formatTrafficMbps(rxMbps)} · TX: {formatTrafficMbps(txMbps)}
                {" · "}{trafficFresh && lastTraffic?.networkObservedAt
                  ? "Measured " + clock(lastTraffic.networkObservedAt) : "Native source unavailable or stale"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Wifi className="size-4" />Android Bridge connectivity</CardTitle>
              <CardDescription>Bridge status API response time</CardDescription>
            </CardHeader>
            <CardContent className="min-w-0">
              <div className="relative h-[190px] min-w-0 w-full" data-testid="bridge-chart-slot">
                <ChartContainer config={bridgeConfig} className="aspect-auto h-full min-w-0 w-full">
                  <AreaChart data={chartSamples} margin={{ top: 12, right: 20, bottom: 10, left: 12 }}>
                    <defs>
                      <linearGradient id="pockethost-bridge-fill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--color-bridgeMs)" stopOpacity={0.16} />
                        <stop offset="95%" stopColor="var(--color-bridgeMs)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="timestamp" type="number" scale="time" domain={["dataMin", "dataMax"]} tickLine={false} axisLine={false} minTickGap={36} tickMargin={10} tickFormatter={value => historyTime(Number(value), historyRange)} />
                    <YAxis width={62} tickMargin={8} tickLine={false} axisLine={false} tickFormatter={value => value + " ms"} />
                    <ChartTooltip cursor={false} content={<DashboardTooltip range={historyRange} fields={tooltipFields.bridge} />} />
                    <Area type="monotone" dataKey="bridgeMs" stroke="var(--color-bridgeMs)"
                      fill="url(#pockethost-bridge-fill)" strokeWidth={1.5} connectNulls={false}
                      dot={false} activeDot={false} isAnimationActive={false} />
                  </AreaChart>
                </ChartContainer>
                {!samples.some(sample => sample.bridgeMs !== null) && <p className="text-muted-foreground pointer-events-none absolute inset-x-8 top-1/2 -translate-y-1/2 text-center text-sm">No successful Bridge status API request yet.</p>}
              </div>
              <p className="text-muted-foreground flex min-h-9 flex-wrap items-center gap-2 pt-2 text-xs tabular-nums">
                <span>{bridgeHealth}</span><span>·</span><span>{samples.filter(sample => sample.bridgeOnline === false).length} disconnected samples</span>
              </p>
            </CardContent>
          </Card>
                  <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Battery className="size-4" />Power & storage</CardTitle>
              <CardDescription>Battery and Termux storage · percent</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="relative h-[190px] min-w-0 w-full" data-testid="power-chart-slot">
                <ChartContainer config={powerConfig} className="aspect-auto h-full min-w-0 w-full">
                  <AreaChart data={chartSamples} margin={{ top: 12, right: 20, bottom: 10, left: 10 }}>
                    <defs>
                      <linearGradient id="pockethost-power-fill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--color-batteryPercent)" stopOpacity={0.14} />
                        <stop offset="95%" stopColor="var(--color-batteryPercent)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="timestamp" type="number" scale="time" domain={["dataMin", "dataMax"]} tickLine={false} axisLine={false} minTickGap={36} tickMargin={10} tickFormatter={value => historyTime(Number(value), historyRange)} />
                    <YAxis domain={[0, 100]} tickLine={false} axisLine={false} width={48} tickMargin={8} tickFormatter={value => value + "%"} />
                    <ChartTooltip cursor={false} content={<DashboardTooltip range={historyRange} fields={tooltipFields.power} />} />
                    <Area dataKey="batteryPercent" type="monotone" stroke="var(--color-batteryPercent)"
                      fill="url(#pockethost-power-fill)" strokeWidth={1.5} connectNulls={false}
                      dot={false} activeDot={false} isAnimationActive={false} />
                    <Area dataKey="storageUsedPercent" type="monotone" stroke="var(--color-storageUsedPercent)"
                      strokeOpacity={0.45} fill="transparent" strokeWidth={1.25} connectNulls={false}
                      dot={false} activeDot={false} isAnimationActive={false} />
                  </AreaChart>
                </ChartContainer>
                {!samples.some(sample => sample.batteryPercent != null || sample.storageUsedPercent != null) &&
                  <p className="text-muted-foreground pointer-events-none absolute inset-x-8 top-1/2 -translate-y-1/2 text-center text-sm">
                    Waiting for permitted power or storage readings.
                  </p>}
              </div>
            </CardContent>
          </Card>

          <Card className="xl:col-span-2">
            <CardHeader>
              <CardTitle>Recent system events</CardTitle>
              <CardDescription>Verified changes and owned actions · retained up to 7 days</CardDescription>
            </CardHeader>
            <CardContent>
              {recentEvents.length ? (
                <ul className="space-y-2 text-sm" aria-label="Recent system events">
                  {[...recentEvents].reverse().slice(0, 7).map(event => (
                    <li key={event.observedAt + event.code + event.service}
                      className="flex items-center justify-between gap-4 border-b border-border/50 pb-2">
                      <span>{event.code.replaceAll("-", " ")}{event.service ? " · " + event.service : ""}</span>
                      <span className="text-muted-foreground shrink-0 text-xs tabular-nums">{clock(event.observedAt)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground text-sm">
                  {historyState === "ok" ? "No recorded state changes in this window." : "Event history unavailable."}
                </p>
              )}
            </CardContent>
          </Card>
        </div>

      </div>
    </BaseLayout>
  )
}
