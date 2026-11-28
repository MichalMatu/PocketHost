import { Battery, Wifi } from "lucide-react"
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart"
import { DashboardTooltip, type TooltipFields } from "./dashboard-tooltip"
import { historyTime } from "./dashboard-history-time"
import { formatTrafficMbps } from "@/lib/network-traffic"
import type { useSystemData } from "./system-data"
import type { systemViewData } from "./system-view-data"

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

export function clock(value: string | number) {
  return new Date(value).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" })
}

function latencySummary(values: (number | null)[]) {
  const valid = values.filter((value): value is number => value !== null && Number.isFinite(value)).sort((a, b) => a - b)
  if (!valid.length) return "No latency readings"
  const median = valid[Math.floor((valid.length - 1) / 2)]!
  return "Median " + Math.round(median) + " ms · peak " + Math.round(valid[valid.length - 1]!) + " ms"
}

type ChartsProps = {
  data: ReturnType<typeof useSystemData>
  view: ReturnType<typeof systemViewData>
}

export function SystemCharts({ data, view }: ChartsProps) {
  const { samples, historyState, historyRange, recentEvents, internet } = data
  const {
    chartSamples, trafficSamples, cpu, androidTrafficReady, rxMbps, txMbps,
    trafficFresh, lastTraffic, companionReady, bridgeHealth,
  } = view

  return (
    <div className="grid min-w-0 gap-4 xl:grid-cols-2">
      <Card className="min-w-0 xl:col-span-2">
        <CardHeader>
          <CardTitle>Live system resources</CardTitle>
          <CardDescription>{cpu !== null ? "Android CPU and system RAM · percent used" : "Termux system RAM · percent used"}</CardDescription>
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
                {cpu !== null && <Area dataKey="cpu" type="monotone" connectNulls={false} stroke="var(--color-cpu)"
                  strokeOpacity={0.55} fill="url(#pockethost-cpu-fill)" strokeWidth={1.5}
                  dot={false} activeDot={false} isAnimationActive={false} />}
                <Area dataKey="ram" type="monotone" connectNulls={false} stroke="var(--color-ram)"
                  strokeOpacity={0.95} fill="url(#pockethost-ram-fill)" strokeWidth={1.5}
                  dot={false} activeDot={false} isAnimationActive={false} />
              </AreaChart>
            </ChartContainer>
            {!samples.some(sample => sample.cpu !== null || sample.ram !== null) && <p className="text-muted-foreground pointer-events-none absolute inset-x-12 top-1/2 -translate-y-1/2 text-center text-sm">Waiting for permitted Android / Termux resource readings.</p>}
          </div>
          <div className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 pt-2 text-xs">
            {cpu !== null && <span>CPU · Android</span>}
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
          <p className="text-muted-foreground pt-2 text-xs tabular-nums">
            {internet?.state === "reachable" ? "TCP endpoint reachable" : internet?.state === "unreachable" ? "TCP endpoint check failed" : "TCP probe unavailable"}
            {" · "}{latencySummary(samples.map(sample => sample.internetMs))}
            {" · "}{samples.filter(sample => sample.internetFailed === true).length} failures
            {" · "}{samples.filter(sample => sample.internetFailed === null).length} unavailable
            {" · "}Panel API {samples.at(-1)?.apiMs ?? "—"} ms
          </p>
        </CardContent>
      </Card>

      {androidTrafficReady && <Card>
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
          <p className="text-muted-foreground pt-2 text-xs tabular-nums" aria-label="Android transfer rates">
            RX: {formatTrafficMbps(rxMbps)} · TX: {formatTrafficMbps(txMbps)}
            {" · "}{trafficFresh && lastTraffic?.networkObservedAt
              ? "Measured " + clock(lastTraffic.networkObservedAt) : "Waiting for two supported counter readings"}
          </p>
        </CardContent>
      </Card>}

      {companionReady && <Card>
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
      </Card>}
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
                  className="flex items-center justify-between gap-4 border-b border-border/50 pb-2 last:border-b-0 last:pb-0">
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
  )
}
