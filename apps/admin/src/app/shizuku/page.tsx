import * as React from "react"
import {
  Activity, AppWindow, Battery, Cpu, LockKeyhole, RefreshCw, Settings2,
  ShieldCheck, Smartphone, Terminal, Search, ExternalLink,
} from "lucide-react"
import { Link } from "react-router-dom"
import { BaseLayout } from "@/components/layouts/base-layout"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  parseShizukuStatus, parseShizukuApps, parseShizukuSystem, parseShizukuApp,
  type ShizukuStatus, type ShizukuApps, type ShizukuSystem, type ShizukuApp,
} from "@/lib/shizuku-schema"

type Section = "applications" | "processes" | "permissions" | "services" | "shell" | "power"
type PackageFilter = "all" | "user" | "system"

const sections = [
  { id: "applications", label: "Applications", icon: AppWindow },
  { id: "processes", label: "CPU & processes", icon: Cpu },
  { id: "permissions", label: "Permissions", icon: LockKeyhole },
  { id: "services", label: "Services & settings", icon: Settings2 },
  { id: "shell", label: "Advanced shell", icon: Terminal },
  { id: "power", label: "Power & hardware", icon: Battery },
] as const

async function readJson(url: string, signal: AbortSignal): Promise<unknown> {
  const response = await fetch(url, {
    method: "GET", cache: "no-store", credentials: "same-origin", signal,
  })
  if (!response.ok) throw new Error("Endpoint unavailable")
  return response.json() as Promise<unknown>
}

function unavailable(value: string | number | null | undefined, suffix = "") {
  return value == null ? "Unavailable" : String(value) + suffix
}

/** Android meminfo / ps report KiB; display real binary gigabytes. */
function gib(value: number | null, precision = 2) {
  return value == null ? "Unavailable" : (value / (1024 * 1024)).toFixed(precision) + " GiB"
}

function LastSample({ observedAt }: { observedAt?: string }) {
  return <span className="text-muted-foreground text-xs">
    {observedAt ? "Sample: " + new Date(observedAt).toLocaleTimeString() : "No verified reading"}
  </span>
}

function NativeOwnerNotice({ specific }: { specific: string }) {
  return <Card>
    <CardContent className="space-y-2 py-4 text-sm">
      <p className="flex items-center gap-2 font-medium">
        <ShieldCheck className="size-4" /> Owner-approved Android actions
      </p>
      <p className="text-muted-foreground">
        {specific} To change the phone, open the PocketHost Companion on your Samsung and
        approve the exact action there. Commands and mutations are never forwarded
        through this login-free LAN dashboard.
      </p>
    </CardContent>
  </Card>
}

export default function ShizukuPage() {
  const [status, setStatus] = React.useState<ShizukuStatus | null>(null)
  const [apps, setApps] = React.useState<ShizukuApps | null>(null)
  const [system, setSystem] = React.useState<ShizukuSystem | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [refreshKey, setRefreshKey] = React.useState(0)
  const [section, setSection] = React.useState<Section>("applications")
  const [packageFilter, setPackageFilter] = React.useState<PackageFilter>("all")
  const [appSearch, setAppSearch] = React.useState("")
  const [processSearch, setProcessSearch] = React.useState("")
  const [serviceSearch, setServiceSearch] = React.useState("")
  const [selectedPackage, setSelectedPackage] = React.useState<string | null>(null)
  const [appDetail, setAppDetail] = React.useState<ShizukuApp | null>(null)
  const [detailLoading, setDetailLoading] = React.useState(false)
  const detailRequest = React.useRef(0)

  async function selectPackage(packageName: string) {
    const request = ++detailRequest.current
    setSelectedPackage(packageName)
    setAppDetail(null)
    setDetailLoading(true)
    try {
      const result = parseShizukuApp(await readJson(
        "/api/v1/shizuku/app?package=" + encodeURIComponent(packageName),
        AbortSignal.timeout(10000),
      ))
      if (request === detailRequest.current && result.packageName === packageName) {
        setAppDetail(result)
      }
    } catch {
      if (request === detailRequest.current) setAppDetail(null)
    } finally {
      if (request === detailRequest.current) setDetailLoading(false)
    }
  }

  React.useEffect(() => {
    const controller = new AbortController()
    const signal = controller.signal
    void (async () => {
      try {
        const nativeStatus = parseShizukuStatus(
          await readJson("/api/v1/shizuku/status", signal),
        )
        if (signal.aborted) return
        setStatus(nativeStatus)
        if (!nativeStatus.connected || !nativeStatus.authorized) {
          setApps(null)
          setSystem(null)
          return
        }
        const [packages, diagnostics] = await Promise.allSettled([
          readJson("/api/v1/shizuku/apps", signal).then(parseShizukuApps),
          readJson("/api/v1/shizuku/system", signal).then(parseShizukuSystem),
        ])
        if (signal.aborted) return
        setApps(packages.status === "fulfilled" ? packages.value : null)
        setSystem(diagnostics.status === "fulfilled" ? diagnostics.value : null)
      } catch {
        if (!signal.aborted) {
          setStatus(null)
          setApps(null)
          setSystem(null)
        }
      } finally {
        if (!signal.aborted) setLoading(false)
      }
    })()
    return () => controller.abort()
  }, [refreshKey])

  const connected = status?.connected === true && status.authorized === true
  const shownApps = (apps?.packages ?? []).filter(item =>
    (packageFilter === "all" || (packageFilter === "system" ? item.system : !item.system)) &&
    (item.packageName.toLowerCase().includes(appSearch.trim().toLowerCase()) ||
      item.label.toLowerCase().includes(appSearch.trim().toLowerCase()))
  )
  const shownProcesses = (system?.processes ?? []).filter(item =>
    item.name.toLowerCase().includes(processSearch.trim().toLowerCase()) ||
    item.user.toLowerCase().includes(processSearch.trim().toLowerCase()) ||
    String(item.pid).includes(processSearch.trim())
  )
  const shownServices = (system?.services.names ?? []).filter(item =>
    item.toLowerCase().includes(serviceSearch.trim().toLowerCase())
  )

  return (
    <BaseLayout title="Android & Shizuku" description="Android-wide diagnostics and on-device privileged controls">
      <div className="space-y-5 px-4 pb-8 lg:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Badge variant="outline"><Smartphone className="size-3" /> Samsung Android</Badge>
            <Badge variant="outline"><ShieldCheck className="size-3" /> {connected ? "Shizuku " + status.mode : "Not connected"}</Badge>
            <LastSample observedAt={status?.observedAt} />
          </div>
          <Button variant="outline" size="sm" disabled={loading}
            onClick={() => { detailRequest.current++; setAppDetail(null); setDetailLoading(false); setLoading(true); setRefreshKey(k => k + 1) }}>
            <RefreshCw className={loading ? "size-4 animate-spin" : "size-4"} /> Refresh
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Card><CardHeader>
            <CardDescription>Connection</CardDescription>
            <CardTitle>{loading ? "Checking…" : connected ? "Connected" : "Unavailable"}</CardTitle>
          </CardHeader><CardContent className="text-muted-foreground text-xs">
            {connected ? "Authorized native " + status.mode.toUpperCase() + " service" : "Open Companion and authorize Shizuku"}
          </CardContent></Card>
          <Card><CardHeader><CardDescription>Android CPU</CardDescription>
            <CardTitle>{connected && status?.cpuPercent != null ? status.cpuPercent.toFixed(1) + "%" : "—"}</CardTitle>
          </CardHeader><CardContent className="text-muted-foreground text-xs">Full-device observed utilization</CardContent></Card>
          <Card><CardHeader><CardDescription>Visible processes</CardDescription>
            <CardTitle>{connected ? unavailable(status?.visibleProcesses) : "—"}</CardTitle>
          </CardHeader><CardContent className="text-muted-foreground text-xs">Android-wide process count</CardContent></Card>
          <Card><CardHeader><CardDescription>Installed packages</CardDescription>
            <CardTitle>{apps ? apps.packages.length + (apps.truncated ? "+" : "") : "—"}</CardTitle>
          </CardHeader><CardContent className="text-muted-foreground text-xs">Companion inventory, maximum 1024 entries</CardContent></Card>
        </div>

        {!connected && !loading && (
          <Card>
            <CardHeader><CardTitle>Native connection required</CardTitle>
              <CardDescription>These pages never invent privileged Android data.</CardDescription>
            </CardHeader><CardContent className="text-sm text-muted-foreground">
              Start Shizuku, authorize PocketHost Companion on the phone, then refresh the dashboard.
              <a className="ml-2 inline-flex items-center gap-1 underline underline-offset-4"
                href="https://shizuku.rikka.app/guide/setup/" target="_blank" rel="noreferrer">
                Setup guide <ExternalLink className="size-3" />
              </a>
            </CardContent>
          </Card>
        )}

        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Android modules">
          {sections.map(item => {
            const Icon = item.icon
            return <Button key={item.id} size="sm" role="tab"
              aria-selected={section === item.id} variant={section === item.id ? "default" : "outline"}
              onClick={() => setSection(item.id)}>
              <Icon className="size-4" />{item.label}
            </Button>
          })}
        </div>

        {section === "applications" && (
          <Card>
            <CardHeader><CardTitle>Android applications</CardTitle>
              <CardDescription>Search actual Android app names or package IDs. Select an app for version, SDK and permission details. Changes run only on the phone in Companion.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative min-w-48 flex-1">
                  <Search className="text-muted-foreground absolute left-3 top-2.5 size-4" />
                  <Input aria-label="Search Android packages" className="pl-9"
                    value={appSearch} onChange={e => setAppSearch(e.target.value)}
                    placeholder="Find application or package..." />
                </div>
                {(["all", "user", "system"] as const).map(filter => (
                  <Button size="sm" key={filter} variant={packageFilter === filter ? "default" : "outline"}
                    onClick={() => setPackageFilter(filter)}>{filter === "all" ? "All" : filter === "user" ? "User" : "System"}</Button>
                ))}
              </div>
              {!apps ? <p className="text-muted-foreground text-sm">Package inventory unavailable or not authorized.</p> :
                <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(240px,340px)]">
                  <div className="max-h-[440px] overflow-y-auto rounded-lg border">
                    {shownApps.map(item => <button key={item.packageName} type="button"
                      className={"flex w-full items-center justify-between gap-3 border-b p-3 text-left text-sm last:border-b-0 hover:bg-muted/60 " +
                        (selectedPackage === item.packageName ? "bg-muted" : "")}
                      onClick={() => { void selectPackage(item.packageName) }}>
                      <span className="min-w-0 space-y-1">
                        <span className="block text-sm font-medium break-words">{item.label || item.packageName}</span>
                        <span className="block font-mono text-muted-foreground text-xs break-all">{item.packageName}</span>
                      </span>
                      <Badge variant="outline">{item.system ? "System" : "User"}</Badge>
                    </button>)}
                    {shownApps.length === 0 && <p className="p-4 text-sm text-muted-foreground">No matching packages.</p>}
                  </div>
                  <div className="space-y-3 rounded-lg border p-4">
                    <p className="font-medium">Selected application</p>
                    {selectedPackage ? (
                      <p className="break-all font-mono text-xs text-muted-foreground">{selectedPackage}</p>
                    ) : <p className="text-muted-foreground text-sm">Choose an app from the list</p>}
                    {detailLoading && <p role="status" className="text-muted-foreground text-sm">Reading Android package details…</p>}
                    {appDetail && (
                      <div className="space-y-3">
                        <div className="flex items-center gap-3">
                          {appDetail.iconPng ? <img
                            src={"data:image/png;base64," + appDetail.iconPng}
                            alt=""
                            width={44} height={44} className="size-11 rounded-lg object-contain" /> :
                            <AppWindow aria-hidden="true" className="size-8 text-muted-foreground" />}
                          <p className="font-medium break-words">{appDetail.label || appDetail.packageName}</p>
                        </div>
                        <dl className="grid grid-cols-2 gap-2 text-sm">
                          <dt className="text-muted-foreground">Version</dt><dd className="break-all">{appDetail.versionName || "Unknown"}</dd>
                          <dt className="text-muted-foreground">Version code</dt><dd>{appDetail.versionCode}</dd>
                          <dt className="text-muted-foreground">Target SDK</dt><dd>{appDetail.targetSdk}</dd>
                          <dt className="text-muted-foreground">Enabled</dt><dd>{appDetail.enabled ? "Yes" : "No"}</dd>
                        </dl>
                        <p className="text-sm font-medium">Requested permissions ({appDetail.permissions.length})</p>
                        <div className="max-h-48 overflow-auto rounded-md border">
                          {appDetail.permissions.map(p => <div key={p.name}
                            className="flex items-start justify-between gap-2 border-b p-2 text-xs last:border-b-0">
                            <span className="break-all">{p.name}</span>
                            <Badge variant="outline">{p.granted ? "Granted" : "Not granted"}</Badge>
                          </div>)}
                          {appDetail.permissions.length === 0 && <p className="p-2 text-xs text-muted-foreground">No requested permissions reported.</p>}
                        </div>
                      </div>
                    )}
                    {selectedPackage && !detailLoading && !appDetail && (
                      <p className="text-muted-foreground text-sm">Detailed metadata unavailable for this Android user.</p>
                    )}
                    <p className="text-muted-foreground text-sm">
                      Launch, force-stop, uninstall and permission changes require confirmation
                      inside PocketHost Companion on the Samsung.
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {shownApps.length} matching · {apps.packages.length} reported
                      {apps.truncated ? " · truncated" : ""}
                    </p>
                  </div>
                </div>}
              <LastSample observedAt={apps?.observedAt} />
            </CardContent>
          </Card>
        )}
        {section === "processes" && (
          <Card>
            <CardHeader><CardTitle>Android CPU & processes</CardTitle>
              <CardDescription>Real PID, owner, RSS and CPU (where Android reports it). No fabricated per-process CPU usage.</CardDescription>
            </CardHeader><CardContent className="space-y-3">
              <Input aria-label="Search Android processes" value={processSearch}
                onChange={e => setProcessSearch(e.target.value)} placeholder="Search PID, user or process..." />
              {!system || system.processError ? <p className="text-muted-foreground text-sm">Process inventory unavailable; CPU headline remains independent.</p> :
                <>
                  <div className="max-h-[460px] overflow-auto rounded-lg border">
                    <table className="w-full min-w-[570px] text-left text-sm">
                      <thead className="bg-muted/60 sticky top-0">
                        <tr><th className="p-3">PID</th><th className="p-3">Process</th><th className="p-3">User</th><th className="p-3 text-right">RSS</th><th className="p-3 text-right">CPU</th></tr>
                      </thead><tbody>
                        {shownProcesses.map(proc => <tr className="border-t" key={proc.pid}>
                          <td className="p-3 font-mono">{proc.pid}</td>
                          <td className="max-w-80 break-all p-3">{proc.name}</td>
                          <td className="p-3">{proc.user}</td>
                          <td className="p-3 text-right" title="Resident memory (GiB)">{gib(proc.rssKb, 4)}</td>
                          <td className="p-3 text-right">{unavailable(proc.cpuPercent, "%")}</td>
                        </tr>)}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-muted-foreground text-xs">
                    {shownProcesses.length} listed{system.processesTruncated ? " · inventory capped at 1200" : ""}. Individual process stop is available locally in Companion after confirmation.
                  </p>
                  <LastSample observedAt={system.observedAt} />
                </>}
            </CardContent>
          </Card>
        )}
        {section === "permissions" && (
          <div className="space-y-3">
            <NativeOwnerNotice specific="Inspect per-app runtime permissions and grant/revoke specific permissions in Companion → Permissions." />
            <Card><CardHeader><CardTitle>Package permission inspection</CardTitle>
              <CardDescription>Permission results come from Android package manager, not inferred from installation.</CardDescription>
            </CardHeader><CardContent className="space-y-2 text-sm">
              <p>Selected application: <span className="font-mono break-all">{selectedPackage ?? "None"}</span></p>
              <p className="text-muted-foreground">Use Companion → Applications → Read app details / permissions. Then use Companion → Permissions to grant or revoke a specific runtime permission if Android allows it.</p>
            </CardContent></Card>
          </div>
        )}
        {section === "services" && (
          <div className="space-y-3">
            <Card><CardHeader><CardTitle>Services & Android settings</CardTitle>
              <CardDescription>Observed Android services and settings from native Shizuku.</CardDescription>
            </CardHeader><CardContent className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border p-4"><p className="text-sm text-muted-foreground">Screen brightness</p>
                  <p className="text-2xl font-semibold">{unavailable(system?.settings.brightness)}</p></div>
                <div className="rounded-lg border p-4"><p className="text-sm text-muted-foreground">Airplane mode</p>
                  <p className="text-2xl font-semibold">{system?.settings.airplaneMode == null ? "Unavailable" : system.settings.airplaneMode ? "On" : "Off"}</p></div>
              </div>
              <Input aria-label="Search Android services" value={serviceSearch} onChange={e => setServiceSearch(e.target.value)}
                placeholder="Search service component..." />
              {!system || system.services.error ? <p className="text-muted-foreground text-sm">Android service inventory unavailable.</p> :
                <div className="max-h-72 overflow-auto rounded-lg border">
                  {shownServices.map((service, index) => <p key={service + index} className="border-b p-3 font-mono text-xs break-all last:border-b-0">{service}</p>)}
                  {!shownServices.length && <p className="p-3 text-muted-foreground text-sm">No observed matching services.</p>}
                </div>}
              <p className="text-muted-foreground text-xs">The service list is sampled and may be incomplete. Start/stop a specific Android component or change brightness/timeout from Companion on the phone.</p>
            </CardContent></Card>
          </div>
        )}
        {section === "shell" && (
          <div className="space-y-3">
            <NativeOwnerNotice specific="Advanced shell commands run with the actual Shizuku ADB/root UID. Command entry and execution are available ONLY in Companion → Advanced shell." />
            <Card><CardHeader><CardTitle>Execution boundary</CardTitle>
              <CardDescription>There is deliberately no executable command input on this LAN origin.</CardDescription>
            </CardHeader><CardContent className="text-sm text-muted-foreground">
              Use PocketHost Companion on the Samsung. Every command is displayed before confirmation,
              executes with bounded output and a timeout, and reports Android refusals without claiming success.
            </CardContent></Card>
          </div>
        )}
        {section === "power" && (
          <Card><CardHeader><CardTitle>Power & hardware</CardTitle>
            <CardDescription>Real battery, temperature and Android RAM observations.</CardDescription>
          </CardHeader><CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                ["Battery level", unavailable(system?.power.batteryLevel, "%")],
                ["Charging", system?.power.chargingState ? ({ charging: "Charging", discharging: "Discharging", full: "Full", "not-charging": "Not charging", unknown: "Unavailable" } as const)[system.power.chargingState] : system?.power.charging == null ? "Unavailable" : system.power.charging ? "Yes" : "No"],
                ["External power", system?.power.powerConnected == null ? "Unavailable" : system.power.powerConnected ? "Connected" : "Disconnected"],
                ["Battery temperature", unavailable(system?.power.batteryTemperatureC, " °C")],
                ["Available Android RAM", gib(system?.power.memoryAvailableKb ?? null)],
              ].map(([label, value]) => <div className="rounded-lg border p-4" key={label}>
                <p className="text-muted-foreground text-sm">{label}</p>
                <p className="mt-2 text-xl font-semibold">{value}</p>
              </div>)}
            </div>
            <p className="text-muted-foreground text-sm">Total system RAM: {gib(system?.power.memoryTotalKb ?? null)}</p>
            <LastSample observedAt={system?.observedAt} />
            {!system && <p className="text-muted-foreground text-sm">Android hardware sample unavailable.</p>}
          </CardContent></Card>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <p>Browser = read-only diagnostics · Companion on Samsung = confirmed privileged actions · ADB ≠ root</p>
          <Button size="sm" variant="outline" render={<Link to="/observability" />}>
            <Activity className="size-4" /> Termux monitoring
          </Button>
        </div>
      </div>
    </BaseLayout>
  )
}
