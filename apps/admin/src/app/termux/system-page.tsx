import { Activity, Battery, Clock3, Cpu, HardDrive, RefreshCw, ServerCog, Wifi } from "lucide-react"
import { Link } from "react-router-dom"
import { BaseLayout } from "@/components/layouts/base-layout"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { formatMemory } from "@/lib/format-memory"
import { formatUptime } from "@/lib/format-uptime"
import { useSystemData } from "./system-data"
import { systemViewData } from "./system-view-data"
import { SummaryCard } from "./system-summary-card"
import { SystemCharts, clock } from "./system-charts"

export default function SystemPage() {
  const data = useSystemData()
  const view = systemViewData(data)
  const { host, bridge, sampledAt, historyRange, setHistoryRange, setGeneration } = data
  const {
    collectorLabel, batteryPercent, batteryCharging, batteryTempC, dnsMs, dnsFailed,
    alerts, companionReady, cpu, androidTrafficReady, dnsReady, servicesRunning,
    serviceUnknown, active, bridgeState,
  } = view

  return (
    <BaseLayout>
      <div className="flex flex-col gap-5 px-4 pb-8 lg:px-6">
        <div className="flex min-h-10 flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="outline">{host ? "Termux online" : "Termux unavailable"}</Badge>
              <Badge variant="outline">{collectorLabel}</Badge>
              {sampledAt && <span className="tabular-nums">Checked {clock(sampledAt)}</span>}
            </div>
          </div>
          <Button variant="outline" size="lg" className="min-h-10" onClick={() => setGeneration(value => value + 1)}>
            <RefreshCw className="size-4" />Refresh
          </Button>
        </div>

        <div className="space-y-1 text-xs text-muted-foreground" role="status"
          aria-label="Monitoring source availability">
          <p className="font-medium text-foreground">
            {companionReady ? "Enhanced monitoring · Companion + Shizuku" : "Basic monitoring · Termux"}
          </p>
          {!companionReady && <p>
            {bridge === null ? "Companion status API unavailable." :
              !bridge.connected ? "PocketHost Companion disconnected." :
              !bridge.authorized ? "Shizuku authorization required." :
              "Authorized Companion reading not fresh."}
            {" "}Android-only readings are hidden, not treated as host failures.
            {" "}<Link to="/shizuku" className="inline-flex min-h-10 items-center underline underline-offset-2">Android &amp; Shizuku settings</Link>
          </p>}
          {companionReady && (cpu === null || !androidTrafficReady) &&
            <p>Some Android readings are unavailable; their charts are hidden.</p>}
        </div>
        <div data-testid="system-metrics" aria-busy={active} className="grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-4">
          <SummaryCard title="Android CPU"
            value={cpu === null ? null : cpu.toFixed(1) + "%"}
            icon={Cpu} loading={active} detail={cpu === null ? bridgeState : ""} />
          <SummaryCard title="Available RAM" value={host ? formatMemory(host.runtime.freeMemoryMiB) : null}
            icon={Activity} loading={active} detail={host ? "of " + formatMemory(host.runtime.totalMemoryMiB) + " · system-wide" : "Termux measurement unavailable"} />
          <SummaryCard title="Termux storage" value={host?.runtime.storage ? formatMemory(host.runtime.storage.availableMiB) : null}
            icon={HardDrive} loading={active} detail="Free on the Termux home filesystem" />
          <SummaryCard title="Observed services" value={servicesRunning === null ? null : servicesRunning + " / " + host!.services.length}
            icon={ServerCog} loading={active} detail={serviceUnknown ? "Some states unknown · read-only" : "Observed runit units · read-only"} />
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3" data-testid="device-status">
          <Card className="gap-2 py-3">
            <CardHeader className="gap-1 px-4">
              <CardDescription className="flex items-center gap-2"><Battery className="size-4" />Battery · Termux:API / sysfs</CardDescription>
              <CardTitle className="text-lg tabular-nums">{batteryPercent === null ? "Unavailable" : batteryPercent + "%"}</CardTitle>
            </CardHeader>
            <CardContent className="px-4 text-xs text-muted-foreground">
              {batteryCharging === true ? "Charging" : batteryCharging === false ? "Not charging" : "Charge state unavailable"}
              {" · "}{batteryTempC === null ? "Temperature not provided" : batteryTempC.toFixed(1) + "°C"}
            </CardContent>
          </Card>
          <Card className="gap-2 py-3">
            <CardHeader className="gap-1 px-4">
              <CardDescription className="flex items-center gap-2"><Clock3 className="size-4" />Device uptime</CardDescription>
              <CardTitle className="text-lg tabular-nums">{formatUptime(host?.runtime.systemUptimeSeconds ?? null)}</CardTitle>
            </CardHeader>
            <CardContent className="px-4 text-xs text-muted-foreground">Since device boot</CardContent>
          </Card>
          <Card className="col-span-2 gap-2 py-3 sm:col-span-1">
            <CardHeader className="gap-1 px-4">
              <CardDescription className="flex items-center gap-2"><Wifi className="size-4" />DNS · Termux</CardDescription>
              <CardTitle className="text-lg tabular-nums">{dnsMs === null ? dnsFailed === true ? "Lookup failed" : "Unavailable" : dnsMs.toFixed(1) + " ms"}</CardTitle>
            </CardHeader>
            <CardContent className="px-4 text-xs text-muted-foreground">
              {dnsFailed === true ? "Fixed DNS lookup failed" : dnsReady ? "Fixed DNS lookup successful" : "Termux DNS reading unavailable"}
            </CardContent>
          </Card>
        </div>

        <div role="status" aria-label="Active health alerts"
          className="text-muted-foreground flex min-h-6 flex-wrap gap-x-4 gap-y-1 text-xs">
          {alerts.length ? alerts.map(item => <span key={item}>{item}</span>) : "No alerts in available readings."}
        </div>

        <div className="flex min-h-10 flex-wrap items-center justify-between gap-3">
          <span className="text-muted-foreground text-xs">History · 24 h detailed, 7 d hourly</span>
          <div className="flex gap-1" role="group" aria-label="History window">
            <Button variant={historyRange === "1h" ? "secondary" : "outline"} size="lg" className="min-h-10" aria-pressed={historyRange === "1h"} onClick={() => setHistoryRange("1h")}>1 hour</Button>
            <Button variant={historyRange === "24h" ? "secondary" : "outline"} size="lg" className="min-h-10" aria-pressed={historyRange === "24h"} onClick={() => setHistoryRange("24h")}>24 hours</Button>
            <Button variant={historyRange === "7d" ? "secondary" : "outline"} size="lg" className="min-h-10" aria-pressed={historyRange === "7d"} onClick={() => setHistoryRange("7d")}>7 days</Button>
          </div>
        </div>

        <SystemCharts data={data} view={view} />

      </div>
    </BaseLayout>
  )
}
