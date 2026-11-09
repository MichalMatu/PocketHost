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
import { RemoteShellPanel } from "./remote-shell-panel"
import { AndroidActionButton } from "./android-action-button"
import { ShizukuDiagnosticsPanel } from "./diagnostics-panel"
import {
  parseShizukuStatus, parseShizukuApps, parseShizukuSystem, parseShizukuApp,
  type ShizukuStatus, type ShizukuApps, type ShizukuSystem, type ShizukuApp,
} from "@/lib/shizuku-schema"

type Section = "applications" | "processes" | "permissions" | "services" | "shell" | "power" | "diagnostics"
type PackageFilter = "all" | "user" | "system"
const PAGE_SIZE = 80
const PERMISSION_APP_PAGE_SIZE = 20

const sections = [
  { id: "applications", label: "Applications", icon: AppWindow },
  { id: "processes", label: "CPU & processes", icon: Cpu },
  { id: "permissions", label: "Permissions", icon: LockKeyhole },
  { id: "services", label: "Services & settings", icon: Settings2 },
  { id: "shell", label: "Advanced shell", icon: Terminal },
  { id: "power", label: "Power & hardware", icon: Battery },
  { id: "diagnostics", label: "Diagnostics", icon: Activity },
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

export default function ShizukuPage() {
  const [status, setStatus] = React.useState<ShizukuStatus | null>(null)
  const [apps, setApps] = React.useState<ShizukuApps | null>(null)
  const [system, setSystem] = React.useState<ShizukuSystem | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [appsLoading, setAppsLoading] = React.useState(false)
  const [systemLoading, setSystemLoading] = React.useState(false)
  const [appsError, setAppsError] = React.useState(false)
  const [systemError, setSystemError] = React.useState(false)
  const [detailError, setDetailError] = React.useState(false)
  const [refreshKey, setRefreshKey] = React.useState(0)
  const [section, setSection] = React.useState<Section>("applications")
  const [packageFilter, setPackageFilter] = React.useState<PackageFilter>("all")
  const [appSearch, setAppSearch] = React.useState("")
  const [processSearch, setProcessSearch] = React.useState("")
  const [serviceSearch, setServiceSearch] = React.useState("")
  const [permissionSearch, setPermissionSearch] = React.useState("")
  const [permissionAppSearch, setPermissionAppSearch] = React.useState("")
  const [permissionPackageFilter, setPermissionPackageFilter] = React.useState<PackageFilter>("all")
  const [permissionAppPage, setPermissionAppPage] = React.useState(0)
  const [selectedService, setSelectedService] = React.useState<string | null>(null)
  const [selectedProcessPid, setSelectedProcessPid] = React.useState<number | null>(null)
  const [sortProcessBy, setSortProcessBy] = React.useState<"pid" | "name" | "user" | "rss" | "cpu">("pid")
  const [descending, setDescending] = React.useState(false)
  const [brightnessDraft, setBrightnessDraft] = React.useState("")
  const [timeoutDraft, setTimeoutDraft] = React.useState("")
  const [cpuHistory, setCpuHistory] = React.useState<Array<{ time: string; value: number }>>([])
  const [servicePage, setServicePage] = React.useState(0)
  const [appPage, setAppPage] = React.useState(0)
  const [processPage, setProcessPage] = React.useState(0)
  const [selectedPackage, setSelectedPackage] = React.useState<string | null>(null)
  const [appDetail, setAppDetail] = React.useState<ShizukuApp | null>(null)
  const [detailLoading, setDetailLoading] = React.useState(false)
  const detailRequest = React.useRef(0)

  async function selectPackage(packageName: string) {
    const request = ++detailRequest.current
    setSelectedPackage(packageName)
    setAppDetail(null)
    setDetailError(false)
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
      if (request === detailRequest.current) {
        setAppDetail(null)
        setDetailError(true)
      }
    } finally {
      if (request === detailRequest.current) setDetailLoading(false)
    }
  }

  React.useEffect(() => {
    if (section !== "processes") return
    const controller = new AbortController()
    let busy = false
    const poll = async () => {
      if (busy || controller.signal.aborted) return
      busy = true
      try {
        const statusSample = parseShizukuStatus(await readJson(
          "/api/v1/shizuku/status", AbortSignal.any([controller.signal, AbortSignal.timeout(9000)],
        )))
        if (controller.signal.aborted) return
        setStatus(statusSample)
        if (statusSample.cpuPercent != null) setCpuHistory(current => {
          if (current.some(point => point.time === statusSample.observedAt)) return current
          return [...current, { time: statusSample.observedAt, value: statusSample.cpuPercent! }].slice(-40)
        })
        const systemSample = parseShizukuSystem(await readJson(
          "/api/v1/shizuku/system", AbortSignal.any([controller.signal, AbortSignal.timeout(15000)],
        )))
        if (!controller.signal.aborted) {
          setSystem(systemSample)
          setSystemError(false)
        }
      } catch {
        if (!controller.signal.aborted) setSystemError(true)
      } finally {
        busy = false
      }
    }
    const interval = window.setInterval(() => { void poll() }, 15000)
    return () => { controller.abort(); window.clearInterval(interval) }
  }, [section])

  React.useEffect(() => {
    const controller = new AbortController()
    const signal = controller.signal
    // CPU/session status is independent of potentially slow package and process scans.
    void readJson("/api/v1/shizuku/status", AbortSignal.any([
      signal, AbortSignal.timeout(8000),
    ]))
      .then(parseShizukuStatus)
      .then(nativeStatus => {
        if (signal.aborted) return
        setStatus(nativeStatus)
        if (nativeStatus.cpuPercent != null) setCpuHistory(current => {
          if (current.some(point => point.time === nativeStatus.observedAt)) return current
          return [...current, { time: nativeStatus.observedAt, value: nativeStatus.cpuPercent! }].slice(-40)
        })
        if (!nativeStatus.connected || !nativeStatus.authorized) return

        setAppsLoading(true)
        void readJson("/api/v1/shizuku/apps", AbortSignal.any([
          signal, AbortSignal.timeout(25000),
        ]))
          .then(parseShizukuApps)
          .then(packages => { if (!signal.aborted) setApps(packages) })
          .catch(() => { if (!signal.aborted) setAppsError(true) })
          .finally(() => { if (!signal.aborted) setAppsLoading(false) })

        setSystemLoading(true)
        void readJson("/api/v1/shizuku/system", AbortSignal.any([
          signal, AbortSignal.timeout(15000),
        ]))
          .then(parseShizukuSystem)
          .then(diagnostics => { if (!signal.aborted) setSystem(diagnostics) })
          .catch(() => { if (!signal.aborted) setSystemError(true) })
          .finally(() => { if (!signal.aborted) setSystemLoading(false) })
      })
      .catch(() => { if (!signal.aborted) setStatus(null) })
      .finally(() => { if (!signal.aborted) setLoading(false) })
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
  ).sort((a, b) => {
    const order = sortProcessBy === "pid" ? a.pid - b.pid :
      sortProcessBy === "rss" ? (a.rssKb ?? -1) - (b.rssKb ?? -1) :
      sortProcessBy === "cpu" ? (a.cpuPercent ?? -1) - (b.cpuPercent ?? -1) :
      String(a[sortProcessBy]).localeCompare(String(b[sortProcessBy]))
    return descending ? -order : order
  })
  const selectedProcess = system?.processes.find(process => process.pid === selectedProcessPid)
  const appProcesses = selectedPackage ? (system?.processes ?? []).filter(process =>
    process.name === selectedPackage || process.name.startsWith(selectedPackage + ":")
  ) : []
  const appRssKb = appProcesses.some(process => process.rssKb != null) ?
    appProcesses.reduce((sum, process) => sum + (process.rssKb ?? 0), 0) : null
  const appCpuPercent = appProcesses.some(process => process.cpuPercent != null) ?
    appProcesses.reduce((sum, process) => sum + (process.cpuPercent ?? 0), 0) : null
  const shownServices = (system?.services.names ?? []).filter(item =>
    item.toLowerCase().includes(serviceSearch.trim().toLowerCase())
  )
  // Bound DOM work on Android: never render the full 1024/1200 item inventory.
  const visibleApps = shownApps.slice(appPage * PAGE_SIZE, (appPage + 1) * PAGE_SIZE)
  const visibleProcesses = shownProcesses.slice(processPage * PAGE_SIZE, (processPage + 1) * PAGE_SIZE)
  const visibleServices = shownServices.slice(servicePage * PAGE_SIZE, (servicePage + 1) * PAGE_SIZE)
  const permissionApps = (apps?.packages ?? []).filter(item =>
    (permissionPackageFilter === "all" ||
      (permissionPackageFilter === "system" ? item.system : !item.system)) &&
    (item.packageName.toLowerCase().includes(permissionAppSearch.trim().toLowerCase()) ||
      item.label.toLowerCase().includes(permissionAppSearch.trim().toLowerCase()))
  )
  const visiblePermissionApps = permissionApps.slice(
    permissionAppPage * PERMISSION_APP_PAGE_SIZE,
    (permissionAppPage + 1) * PERMISSION_APP_PAGE_SIZE,
  )
  const visiblePermissions = (appDetail?.permissions ?? []).filter(permission =>
    permission.name.toLowerCase().includes(permissionSearch.trim().toLowerCase())
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
            onClick={() => {
              detailRequest.current++
              setAppDetail(null)
              setSelectedPackage(null)
              setDetailError(false)
              setDetailLoading(false)
              setApps(null)
              setSystem(null)
              setStatus(null)
              setAppsError(false)
              setSystemError(false)
              setAppsLoading(false)
              setSystemLoading(false)
              setSelectedService(null)
              setServicePage(0)
              setAppPage(0)
              setProcessPage(0)
              setLoading(true)
              setRefreshKey(k => k + 1)
            }}>
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

        <div className="flex gap-2 overflow-x-auto pb-2" role="tablist" aria-label="Android modules">
          {sections.map((item, index) => {
            const Icon = item.icon
            return <Button key={item.id} id={"android-tab-" + item.id} size="sm" role="tab"
              aria-controls="android-module-panel" aria-selected={section === item.id}
              tabIndex={section === item.id ? 0 : -1}
              className="shrink-0 whitespace-nowrap"
              variant={section === item.id ? "default" : "outline"}
              onKeyDown={event => {
                if (!["ArrowRight", "ArrowLeft", "Home", "End"].includes(event.key)) return
                event.preventDefault()
                const next = event.key === "Home" ? 0 :
                  event.key === "End" ? sections.length - 1 :
                    (index + (event.key === "ArrowRight" ? 1 : -1) + sections.length) % sections.length
                setSection(sections[next].id)
                document.getElementById("android-tab-" + sections[next].id)?.focus()
              }}
              onClick={() => setSection(item.id)}>
              <Icon className="size-4" />{item.label}
            </Button>
          })}
        </div>

        <div id="android-module-panel" role="tabpanel" aria-labelledby={"android-tab-" + section}>
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
                    value={appSearch} onChange={e => { setAppSearch(e.target.value); setAppPage(0) }}
                    placeholder="Find application or package..." />
                </div>
                {(["all", "user", "system"] as const).map(filter => (
                  <Button size="sm" key={filter} variant={packageFilter === filter ? "default" : "outline"}
                    onClick={() => { setPackageFilter(filter); setAppPage(0) }}>{filter === "all" ? "All" : filter === "user" ? "User" : "System"}</Button>
                ))}
              </div>
              {!apps ? <p role="status" className="text-muted-foreground text-sm">{appsLoading ? "Loading Android applications…" : appsError ? "Application inventory request failed. Try Refresh." : "Package inventory unavailable or not authorized."}</p> :
                <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(240px,340px)]">
                  <div className="max-h-[440px] overflow-y-auto rounded-lg border">
                    {visibleApps.map(item => <button key={item.packageName} type="button"
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
                    <div className="flex items-center justify-between gap-2 p-2 text-xs text-muted-foreground">
                      <span>{shownApps.length ? appPage * PAGE_SIZE + 1 : 0}–{Math.min((appPage + 1) * PAGE_SIZE, shownApps.length)} of {shownApps.length}</span>
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" aria-label="Previous applications" disabled={appPage === 0} onClick={() => setAppPage(p => p - 1)}>Previous</Button>
                        <Button size="sm" variant="outline" aria-label="Next applications" disabled={(appPage + 1) * PAGE_SIZE >= shownApps.length} onClick={() => setAppPage(p => p + 1)}>Next</Button>
                      </div>
                    </div>
                  </div>
                  <div className="min-w-0 space-y-3 rounded-lg border p-4">
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
                        <div className="space-y-1 rounded-md border p-3 text-sm">
                          <p className="font-medium">Matching Android processes ({appProcesses.length})</p>
                          <p className="text-muted-foreground text-xs">Name-based match, not Android usage attribution.</p>
                          <p>RSS: {gib(appRssKb, 4)} · CPU: {unavailable(appCpuPercent, "%")}</p>
                        </div>
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
                      <p role="status" className="text-muted-foreground text-sm">{detailError ? "App detail request failed. Select the app again to retry." : "Detailed metadata unavailable for this Android user."}</p>
                    )}
                    {selectedPackage && appDetail && connected && (
                      <div className="flex flex-wrap gap-2">
                        <AndroidActionButton action="launch" target={selectedPackage} onSuccess={() => void selectPackage(selectedPackage)}>Launch</AndroidActionButton>
                        <AndroidActionButton action="force-stop" target={selectedPackage}>Force stop</AndroidActionButton>
                        <AndroidActionButton action={appDetail.enabled ? "disable" : "enable"} target={selectedPackage}
                          onSuccess={() => { void selectPackage(selectedPackage); setRefreshKey(k => k + 1) }}>
                          {appDetail.enabled ? "Disable" : "Enable"}
                        </AndroidActionButton>
                        <AndroidActionButton action="uninstall" target={selectedPackage}
                          onSuccess={() => { setSelectedPackage(null); setAppDetail(null); setRefreshKey(k => k + 1) }}>
                          Uninstall for user 0
                        </AndroidActionButton>
                      </div>
                    )}
                    <p className="text-muted-foreground text-xs">Direct browser actions run immediately with actual Shizuku permissions. Uninstall targets Android user 0.</p>
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
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <label htmlFor="android-process-sort">Sort by</label>
                <select id="android-process-sort" aria-label="Sort Android processes" className="bg-background rounded-md border px-3 py-2"
                  value={sortProcessBy} onChange={e => { setSortProcessBy(e.target.value as typeof sortProcessBy); setProcessPage(0) }}>
                  <option value="pid">PID</option><option value="name">Name</option>
                  <option value="user">Owner</option><option value="rss">RSS</option><option value="cpu">CPU</option>
                </select>
                <Button size="sm" variant="outline" onClick={() => { setDescending(x => !x); setProcessPage(0) }}>
                  {descending ? "Descending" : "Ascending"}
                </Button>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-sm font-medium">CPU history · current session</p>
                {cpuHistory.length < 2 ? <p className="text-muted-foreground text-sm">Collecting samples…</p> :
                  <svg viewBox="0 0 600 110" className="h-28 w-full" preserveAspectRatio="none"
                    role="img" aria-label="Observed Android CPU history">
                    <polyline fill="none" stroke="currentColor" strokeWidth="2"
                      points={cpuHistory.map((point, i) =>
                        (i * 600 / Math.max(1, cpuHistory.length - 1)) + "," + (100 - point.value)
                      ).join(" ")} />
                  </svg>}
                <p className="text-muted-foreground text-xs">{cpuHistory.length} actual samples</p>
              </div>
              <Input aria-label="Search Android processes" value={processSearch}
                onChange={e => { setProcessSearch(e.target.value); setProcessPage(0) }} placeholder="Search PID, user or process..." />
              {!system || system.processError ? <p role="status" className="text-muted-foreground text-sm">{systemLoading ? "Loading Android processes…" : systemError ? "Android diagnostics request failed. Try Refresh." : "Process inventory unavailable; CPU headline remains independent."}</p> :
                <>
                  <div className="max-h-[460px] overflow-auto rounded-lg border">
                    <table className="w-full min-w-[570px] text-left text-sm">
                      <thead className="bg-muted/60 sticky top-0">
                        <tr><th className="p-3">PID</th><th className="p-3">Process</th><th className="p-3">User</th><th className="p-3 text-right">RSS</th><th className="p-3 text-right">CPU</th></tr>
                      </thead><tbody>
                        {visibleProcesses.map(proc => <tr className="border-t" key={proc.pid}>
                          <td className="p-3 font-mono">
                            <button type="button" className="underline underline-offset-2"
                              aria-label={"Inspect process " + proc.pid}
                              onClick={() => setSelectedProcessPid(proc.pid)}>{proc.pid}</button>
                          </td>
                          <td className="max-w-80 break-all p-3">{proc.name}</td>
                          <td className="p-3">{proc.user}</td>
                          <td className="p-3 text-right" title="Resident memory (GiB)">{gib(proc.rssKb, 4)}</td>
                          <td className="p-3 text-right">{unavailable(proc.cpuPercent, "%")}</td>
                        </tr>)}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span>Showing {shownProcesses.length ? processPage * PAGE_SIZE + 1 : 0}–{Math.min((processPage + 1) * PAGE_SIZE, shownProcesses.length)} of {shownProcesses.length}{system.processesTruncated ? " · inventory capped at 1200" : ""}</span>
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" aria-label="Previous processes" disabled={processPage === 0} onClick={() => setProcessPage(p => p - 1)}>Previous</Button>
                      <Button size="sm" variant="outline" aria-label="Next processes" disabled={(processPage + 1) * PAGE_SIZE >= shownProcesses.length} onClick={() => setProcessPage(p => p + 1)}>Next</Button>
                    </div>
                  </div>
                  {selectedProcess && (
                    <div className="space-y-2 rounded-lg border p-3 text-sm">
                      <p className="font-medium">Selected PID {selectedProcess.pid}</p>
                      <p className="break-all">{selectedProcess.name} · {selectedProcess.user} · {gib(selectedProcess.rssKb, 4)}</p>
                      <AndroidActionButton action="process-stop" target={String(selectedProcess.pid)}
                        onSuccess={() => setRefreshKey(k => k + 1)}>Send TERM to PID</AndroidActionButton>
                    </div>
                  )}
                  <p className="text-muted-foreground text-xs">Per-process CPU is only shown if Android reports it.</p>
                  <LastSample observedAt={system.observedAt} />
                </>}
            </CardContent>
          </Card>
        )}
        {section === "permissions" && (
          <div className="space-y-3">
            <Card>
              <CardHeader>
                <CardTitle>Android app permissions</CardTitle>
                <CardDescription>Choose an app and inspect its actual requested permission grants here. A reported grant does not guarantee Android will allow changing it.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
                  <div className="min-w-0 space-y-3">
                    <p className="text-sm font-medium">Applications</p>
                    <div className="relative">
                      <Search className="text-muted-foreground absolute left-3 top-2.5 size-4" />
                      <Input aria-label="Search applications for permissions" className="pl-9"
                        value={permissionAppSearch}
                        onChange={event => { setPermissionAppSearch(event.target.value); setPermissionAppPage(0) }}
                        placeholder="Find application or package..." />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {(["all", "user", "system"] as const).map(filter => (
                        <Button size="sm" key={filter}
                          variant={permissionPackageFilter === filter ? "default" : "outline"}
                          onClick={() => { setPermissionPackageFilter(filter); setPermissionAppPage(0) }}>
                          {filter === "all" ? "All" : filter === "user" ? "User" : "System"}
                        </Button>
                      ))}
                    </div>
                    {!apps ? <p role="status" className="text-muted-foreground text-sm">
                      {appsLoading ? "Loading Android applications…" :
                        appsError ? "Application inventory request failed. Try Refresh." :
                          "Package inventory unavailable or not authorized."}
                    </p> : (
                      <>
                        <div className="max-h-[360px] overflow-y-auto rounded-lg border">
                          {visiblePermissionApps.map(item => (
                            <button key={item.packageName} type="button"
                              aria-label={"Inspect permissions for " + item.label + " (" + item.packageName + ")"}
                              aria-pressed={selectedPackage === item.packageName}
                              className={"flex w-full items-center justify-between gap-2 border-b p-3 text-left text-sm last:border-b-0 hover:bg-muted/60 " +
                                (selectedPackage === item.packageName ? "bg-muted" : "")}
                              onClick={() => { setPermissionSearch(""); void selectPackage(item.packageName) }}>
                              <span className="min-w-0 space-y-1">
                                <span className="block font-medium break-words">{item.label || item.packageName}</span>
                                <span className="block font-mono text-muted-foreground text-xs break-all">{item.packageName}</span>
                              </span>
                              <Badge variant="outline">{item.system ? "System" : "User"}</Badge>
                            </button>
                          ))}
                          {permissionApps.length === 0 && (
                            <p className="p-3 text-sm text-muted-foreground">No matching applications.</p>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                          <span>
                            {permissionApps.length ? permissionAppPage * PERMISSION_APP_PAGE_SIZE + 1 : 0}–
                            {Math.min((permissionAppPage + 1) * PERMISSION_APP_PAGE_SIZE, permissionApps.length)} of {permissionApps.length}
                            {apps.truncated ? " · inventory truncated" : ""}
                          </span>
                          <div className="flex gap-1">
                            <Button size="sm" variant="outline" aria-label="Previous permission applications"
                              disabled={permissionAppPage === 0}
                              onClick={() => setPermissionAppPage(p => p - 1)}>Previous</Button>
                            <Button size="sm" variant="outline" aria-label="Next permission applications"
                              disabled={(permissionAppPage + 1) * PERMISSION_APP_PAGE_SIZE >= permissionApps.length}
                              onClick={() => setPermissionAppPage(p => p + 1)}>Next</Button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                  <div className="min-w-0 space-y-3 rounded-lg border p-4">
                    <p className="text-sm font-medium">Selected application permissions</p>
                    {selectedPackage ? (
                      <div className="min-w-0">
                        <p className="font-medium break-words">{appDetail?.label || selectedPackage}</p>
                        <p className="font-mono text-muted-foreground text-xs break-all">{selectedPackage}</p>
                      </div>
                    ) : <p className="text-muted-foreground text-sm">Select an application from the list to inspect its permissions.</p>}
                    {detailLoading && <p role="status" className="text-muted-foreground text-sm">Reading app permissions…</p>}
                    {selectedPackage && !detailLoading && !appDetail && (
                      <div className="space-y-2">
                        <p role="status" className="text-muted-foreground text-sm">
                          {detailError ? "Permissions could not be read. Retry here or select another app." : "No verified app details available."}
                        </p>
                        <Button size="sm" variant="outline"
                          onClick={() => { void selectPackage(selectedPackage) }}>Retry permissions</Button>
                      </div>
                    )}
                    {appDetail && (
                      <>
                        <div className="flex flex-wrap gap-2 text-sm">
                          <Badge variant="outline">{appDetail.permissions.length} requested</Badge>
                          <Badge variant="outline">{appDetail.permissions.filter(permission => permission.granted).length} granted</Badge>
                          <Badge variant="outline">{appDetail.permissions.filter(permission => !permission.granted).length} not granted</Badge>
                        </div>
                        <Input aria-label="Search Android permissions" value={permissionSearch}
                          onChange={event => setPermissionSearch(event.target.value)}
                          placeholder="Filter permission name…" />
                        <div className="max-h-96 overflow-y-auto rounded-lg border">
                          {visiblePermissions.map(permission => (
                            <div key={permission.name} className="flex min-w-0 flex-wrap items-center justify-between gap-2 border-b p-3 text-sm last:border-b-0">
                              <span className="min-w-0 flex-1 break-all font-mono text-xs">{permission.name}</span>
                              <Badge variant="outline">{permission.granted ? "Granted" : "Not granted"}</Badge>
                              {selectedPackage && connected && <AndroidActionButton
                                action={permission.granted ? "revoke" : "grant"} target={selectedPackage}
                                value={permission.name} onSuccess={() => void selectPackage(selectedPackage)}>
                                {permission.granted ? "Revoke" : "Grant"}
                              </AndroidActionButton>}
                            </div>
                          ))}
                          {!visiblePermissions.length && (
                            <p className="p-3 text-sm text-muted-foreground">
                              {appDetail.permissions.length ? "No permissions match this filter." : "Android reported no requested permissions."}
                            </p>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>
                <LastSample observedAt={apps?.observedAt} />
              </CardContent>
            </Card>
            <p className="text-muted-foreground text-xs">Grant and Revoke execute directly through Shizuku; real Android refusals remain visible.</p>
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
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2 rounded-lg border p-3">
                  <p className="text-sm font-medium">Set brightness (0–255)</p>
                  <Input aria-label="Set screen brightness" type="number" min={0} max={255}
                    value={brightnessDraft} placeholder={String(system?.settings.brightness ?? "128")}
                    onChange={e => setBrightnessDraft(e.target.value)} />
                  {brightnessDraft.trim() !== "" && connected &&
                    <AndroidActionButton action="brightness" value={brightnessDraft}
                      onSuccess={() => setRefreshKey(k => k + 1)}>Apply brightness</AndroidActionButton>}
                </div>
                <div className="space-y-2 rounded-lg border p-3">
                  <p className="text-sm font-medium">Screen timeout (milliseconds)</p>
                  <p className="text-muted-foreground text-xs">Current: {unavailable(system?.settings.screenTimeoutMs, " ms")}</p>
                  <Input aria-label="Set screen timeout" type="number" min={15000} max={3600000}
                    value={timeoutDraft} placeholder="60000"
                    onChange={e => setTimeoutDraft(e.target.value)} />
                  {timeoutDraft.trim() !== "" && connected &&
                    <AndroidActionButton action="timeout" value={timeoutDraft}
                      onSuccess={() => setRefreshKey(k => k + 1)}>Apply timeout</AndroidActionButton>}
                </div>
              </div>
              <Input aria-label="Search Android services" value={serviceSearch}
                onChange={e => { setServiceSearch(e.target.value); setServicePage(0) }}
                placeholder="Search service component..." />
              {!system || system.services.error ? (
                <p role="status" className="text-muted-foreground text-sm">
                  {systemLoading ? "Loading Android services…" : systemError ? "Android system request failed. Try Refresh." :
                    system?.services.error || "Android service inventory unavailable."}
                </p>
              ) : (
                <>
                  <p className="text-muted-foreground text-xs">
                    {system.services.names.length} observed service components{system.services.truncated ? " · capped at 256; sample incomplete" : " · bounded snapshot"}
                  </p>
                  <div className="max-h-72 overflow-y-auto rounded-lg border">
                    {visibleServices.map(service => (
                      <button type="button" key={service}
                        aria-pressed={selectedService === service}
                        className={"block w-full border-b p-3 text-left font-mono text-xs break-all last:border-b-0 hover:bg-muted/60 " +
                          (selectedService === service ? "bg-muted" : "")}
                        onClick={() => setSelectedService(service)}>{service}</button>
                    ))}
                    {!shownServices.length && <p className="p-3 text-muted-foreground text-sm">No matching services in the observed sample.</p>}
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span>{shownServices.length ? servicePage * PAGE_SIZE + 1 : 0}–{Math.min((servicePage + 1) * PAGE_SIZE, shownServices.length)} of {shownServices.length} matches</span>
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" aria-label="Previous services"
                        disabled={servicePage === 0} onClick={() => setServicePage(p => p - 1)}>Previous</Button>
                      <Button size="sm" variant="outline" aria-label="Next services"
                        disabled={(servicePage + 1) * PAGE_SIZE >= shownServices.length}
                        onClick={() => setServicePage(p => p + 1)}>Next</Button>
                    </div>
                  </div>
                  {selectedService && (
                    <div className="space-y-1 rounded-lg border p-3 text-sm">
                      <p className="font-medium">Selected Android component</p>
                      <p className="break-all font-mono text-xs">{selectedService}</p>
                      <p className="text-muted-foreground text-xs">Android may refuse control of this observed service.</p>
                      <div className="flex flex-wrap gap-2">
                        <AndroidActionButton action="service-start" target={selectedService}
                          onSuccess={() => setRefreshKey(k => k + 1)}>Start service</AndroidActionButton>
                        <AndroidActionButton action="service-stop" target={selectedService}
                          onSuccess={() => setRefreshKey(k => k + 1)}>Stop service</AndroidActionButton>
                      </div>
                    </div>
                  )}
                </>
              )}
              <p className="text-muted-foreground text-xs">These controls execute immediately through Shizuku. Actual Android refusals are shown.</p>
            </CardContent></Card>
          </div>
        )}
        {section === "shell" && <RemoteShellPanel />}
        {section === "diagnostics" && <ShizukuDiagnosticsPanel />}
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

        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <p>Browser = direct Shizuku diagnostics and actions · ADB ≠ root · Private LAN DEV</p>
          <Button size="sm" variant="outline" nativeButton={false} render={<Link to="/observability" />}>
            <Activity className="size-4" /> Termux monitoring
          </Button>
        </div>
      </div>
    </BaseLayout>
  )
}
