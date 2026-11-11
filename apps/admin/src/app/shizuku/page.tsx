import * as React from "react"
import {
  AppWindow, Cpu, RefreshCw, Settings2,
  ShieldCheck, Terminal, Search, ExternalLink,
} from "lucide-react"
import { BaseLayout } from "@/components/layouts/base-layout"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { RemoteShellPanel } from "./remote-shell-panel"
import { AndroidActionButton } from "./android-action-button"
import { ShizukuDiagnosticsPanel } from "./diagnostics-panel"
import {
  parseShizukuStatus, parseShizukuApps, parseShizukuSystem, parseShizukuApp,
  type ShizukuStatus, type ShizukuApps, type ShizukuSystem, type ShizukuApp,
} from "@/lib/shizuku-schema"

type Section = "applications" | "processes" | "services" | "shell"
type PackageFilter = "all" | "user" | "system"
const PAGE_SIZE = 80

const sections = [
  { id: "applications", label: "Apps & permissions", icon: AppWindow },
  { id: "processes", label: "Android processes", icon: Cpu },
  { id: "services", label: "Android services", icon: Settings2 },
  { id: "shell", label: "Android shell", icon: Terminal },
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

/** Android process RSS is in KiB; show process-scale values in MiB. */
function processMiB(value: number | null) {
  if (value == null) return "Unavailable"
  if (value === 0) return "0 MiB"
  return (value / 1024).toFixed(value < 1024 ? 2 : 1) + " MiB"
}

function LastSample({ observedAt }: { observedAt?: string }) {
  return <Badge variant="outline">
    {observedAt ? "Checked " + new Date(observedAt).toLocaleTimeString() : "No verified sample"}
  </Badge>
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
  const [packageFilter, setPackageFilter] = React.useState<PackageFilter>("user")
  const [appSearch, setAppSearch] = React.useState("")
  const [processSearch, setProcessSearch] = React.useState("")
  const [serviceSearch, setServiceSearch] = React.useState("")
  const [permissionSearch, setPermissionSearch] = React.useState("")
  const [appView, setAppView] = React.useState<"details" | "permissions">("details")
  const [diagnosticsOpen, setDiagnosticsOpen] = React.useState(false)
  const [selectedService, setSelectedService] = React.useState<string | null>(null)
  const [selectedProcessPid, setSelectedProcessPid] = React.useState<number | null>(null)
  const [sortProcessBy, setSortProcessBy] = React.useState<"pid" | "name" | "user" | "rss" | "cpu">("rss")
  const [descending, setDescending] = React.useState(true)
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

  const connected = !loading && status?.connected === true && status.authorized === true
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
  ).sort((a, b) => a.localeCompare(b))
  // Bound DOM work on Android: never render the full 1024/1200 item inventory.
  const visibleApps = shownApps.slice(appPage * PAGE_SIZE, (appPage + 1) * PAGE_SIZE)
  const visibleProcesses = shownProcesses.slice(processPage * PAGE_SIZE, (processPage + 1) * PAGE_SIZE)
  const visibleServices = shownServices.slice(servicePage * PAGE_SIZE, (servicePage + 1) * PAGE_SIZE)
  const visiblePermissions = (appDetail?.permissions ?? []).filter(permission =>
    permission.name.toLowerCase().includes(permissionSearch.trim().toLowerCase())
  )
  function sortBy(column: typeof sortProcessBy) {
    setDescending(current => column === sortProcessBy ? !current : true)
    setSortProcessBy(column)
    setProcessPage(0)
  }

  return (
    <BaseLayout title="Android & Shizuku" description="Android-wide diagnostics and on-device privileged controls">
      <div className="space-y-5 px-4 pb-8 lg:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Badge variant="outline"><ShieldCheck className="size-3" /> {loading ? "Checking Shizuku" : connected ? "Shizuku · " + status.mode.toUpperCase() + (status.uid == null ? "" : " · UID " + status.uid) : "Shizuku unavailable"}</Badge>
            <LastSample observedAt={status?.observedAt} />
          </div>
          <Button variant="outline" size="sm" disabled={loading}
            onClick={() => {
              // Preserve last inventory while refreshing; actions disabled until status verifies.
              setAppsError(false)
              setSystemError(false)
              setLoading(true)
              setRefreshKey(k => k + 1)
            }}>
            <RefreshCw className={loading ? "size-4 animate-spin" : "size-4"} /> Refresh
          </Button>
        </div>

        {!connected && !loading && (
          <Card>
            <CardHeader><CardTitle>Connect Shizuku</CardTitle></CardHeader><CardContent className="text-sm text-muted-foreground">
              Start Shizuku, authorize PocketHost Companion on the phone, then refresh this page.
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

        <div id="android-module-panel" role="tabpanel" aria-labelledby={"android-tab-" + section} className="min-h-[500px] space-y-5">
        {section === "applications" && (
          <Card>
            <CardContent className="space-y-4 pt-4">
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
                  <div className="h-[65vh] min-h-[440px] max-h-[900px] overflow-y-auto rounded-lg border">
                    {visibleApps.map(item => <button key={item.packageName} type="button"
                      className={"flex w-full items-center justify-between gap-3 border-b p-3 text-left text-sm last:border-b-0 hover:bg-muted/60 " +
                        (selectedPackage === item.packageName ? "bg-muted" : "")}
                      onClick={() => { setAppView("details"); setPermissionSearch(""); void selectPackage(item.packageName) }}>
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
                        <div className="flex flex-wrap gap-2" role="group" aria-label="Application detail view">
                          <Button size="sm" variant={appView === "details" ? "default" : "outline"}
                            aria-pressed={appView === "details"} onClick={() => setAppView("details")}>Details</Button>
                          <Button size="sm" variant={appView === "permissions" ? "default" : "outline"}
                            aria-pressed={appView === "permissions"} onClick={() => setAppView("permissions")}>
                            Permissions ({appDetail.permissions.length})
                          </Button>
                        </div>
                        {appView === "details" ? <>
                        <dl className="grid grid-cols-2 gap-2 text-sm">
                          <dt className="text-muted-foreground">Version</dt><dd className="break-all">{appDetail.versionName || "Unknown"}</dd>
                          <dt className="text-muted-foreground">Version code</dt><dd>{appDetail.versionCode}</dd>
                          <dt className="text-muted-foreground">Target SDK</dt><dd>{appDetail.targetSdk}</dd>
                          <dt className="text-muted-foreground">Enabled</dt><dd>{appDetail.enabled ? "Yes" : "No"}</dd>
                        </dl>
                        <div className="space-y-1 rounded-md border p-3 text-sm">
                          <p className="font-medium">Matching Android processes ({appProcesses.length})</p>
                          <p className="text-muted-foreground text-xs">Name-based match, not Android usage attribution.</p>
                          <p>RSS: {processMiB(appRssKb)} · CPU: {unavailable(appCpuPercent, "%")}</p>
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3 text-sm">
                          <span>{appDetail.permissions.length} requested permissions</span>
                          <Button size="sm" variant="outline" onClick={() => setAppView("permissions")}>Manage permissions</Button>
                        </div>
                        </> : <>
                          <div className="flex flex-wrap gap-2 text-xs">
                            <Badge variant="outline">{appDetail.permissions.length} requested</Badge>
                            <Badge variant="outline">{appDetail.permissions.filter(permission => permission.granted).length} granted</Badge>
                            <Badge variant="outline">{appDetail.permissions.filter(permission => !permission.granted).length} not granted</Badge>
                          </div>
                          <Input aria-label="Search Android permissions" value={permissionSearch}
                            onChange={event => setPermissionSearch(event.target.value)}
                            placeholder="Filter permission name…" />
                          <div className="max-h-72 overflow-y-auto rounded-lg border">
                            {visiblePermissions.map(permission => (
                              <div key={permission.name} className="flex min-w-0 flex-wrap items-center justify-between gap-2 border-b p-2 text-sm last:border-b-0">
                                <span className="min-w-0 flex-1 break-all font-mono text-xs">{permission.name}</span>
                                <Badge variant="outline">{permission.granted ? "Granted" : "Not granted"}</Badge>
                                {selectedPackage && connected && <AndroidActionButton
                                  action={permission.granted ? "revoke" : "grant"} target={selectedPackage}
                                  value={permission.name} onSuccess={() => void selectPackage(selectedPackage)}>
                                  {permission.granted ? "Revoke" : "Grant"}
                                </AndroidActionButton>}
                              </div>
                            ))}
                            {!visiblePermissions.length && <p className="p-3 text-muted-foreground text-sm">
                              {appDetail.permissions.length ? "No permissions match this filter." : "Android reported no requested permissions."}
                            </p>}
                          </div>
                          <p className="text-muted-foreground text-xs">Grant and Revoke are explicit Shizuku requests. Android may refuse individual changes.</p>
                        </>}
                      </div>
                    )}
                    {selectedPackage && !detailLoading && !appDetail && (
                      <div className="space-y-2">
                        <p role="status" className="text-muted-foreground text-sm">
                          {detailError ? "App detail request failed. Retry or choose another app." : "Detailed metadata unavailable for this Android user."}
                        </p>
                        <Button size="sm" variant="outline" onClick={() => void selectPackage(selectedPackage)}>Retry app details</Button>
                      </div>
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
            </CardContent>
          </Card>
        )}
        {section === "processes" && (
          <Card>
            <CardContent className="space-y-3 pt-4">
              <Input aria-label="Search Android processes" value={processSearch}
                onChange={e => { setProcessSearch(e.target.value); setProcessPage(0) }} placeholder="Search PID, user or process..." />
              {!system || system.processError ? <p role="status" className="text-muted-foreground text-sm">{systemLoading ? "Loading Android processes…" : systemError ? "Android diagnostics request failed. Try Refresh." : "Process inventory unavailable; CPU headline remains independent."}</p> :
                <>
                  <div className="relative h-[65vh] min-h-[440px] max-h-[900px] overflow-auto rounded-lg border">
                    <table className="w-full min-w-[700px] table-fixed border-separate border-spacing-0 text-left text-sm" aria-label="Android processes">
                      <thead><tr>
                        {([
                          { key: "pid", label: "PID", width: "w-20", right: false },
                          { key: "name", label: "Process", width: "w-[38%]", right: false },
                          { key: "user", label: "User", width: "w-[22%]", right: false },
                          { key: "rss", label: "RSS", width: "w-32", right: true },
                          { key: "cpu", label: "CPU", width: "w-24", right: true },
                        ] as const).map(column => (
                          <th key={column.key} scope="col" className={"sticky top-0 z-20 border-b bg-background p-0 " + column.width}
                            aria-sort={sortProcessBy === column.key ? descending ? "descending" : "ascending" : "none"}>
                            <button type="button" aria-label={"Sort by " + column.label}
                              onClick={() => sortBy(column.key)}
                              className={"flex w-full items-center gap-1 p-3 hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-[-2px] " +
                                (column.right ? "justify-end text-right" : "justify-start text-left")}>
                              <span>{column.label}</span>
                              {sortProcessBy === column.key && <span aria-hidden="true">{descending ? "↓" : "↑"}</span>}
                            </button>
                          </th>
                        ))}
                      </tr></thead><tbody>
                        {visibleProcesses.map(proc => <tr className="border-t" key={proc.pid}>
                          <td className="p-3 font-mono">
                            <button type="button" className="underline underline-offset-2"
                              aria-label={"Inspect process " + proc.pid}
                              onClick={() => setSelectedProcessPid(proc.pid)}>{proc.pid}</button>
                          </td>
                          <td className="max-w-80 break-all p-3">{proc.name}</td>
                          <td className="p-3">{proc.user}</td>
                          <td className="p-3 text-right tabular-nums" title="Resident memory (MiB)">{processMiB(proc.rssKb)}</td>
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
                      <p className="break-all">{selectedProcess.name} · {selectedProcess.user} · {processMiB(selectedProcess.rssKb)}</p>
                      {selectedProcess.pid === 1
                        ? <p role="status" className="text-destructive text-xs">PID 1 is Android init. TERM is not offered for this critical process.</p>
                        : <>
                            <p className="text-muted-foreground text-xs">TERM targets PID {selectedProcess.pid}. Android may deny it; do not stop critical system processes.</p>
                            <AndroidActionButton action="process-stop" target={String(selectedProcess.pid)}
                              onSuccess={() => setRefreshKey(k => k + 1)}>Send TERM to PID {selectedProcess.pid}</AndroidActionButton>
                          </>}
                    </div>
                  )}
                </>}
            </CardContent>
          </Card>
        )}
        {section === "services" && (
          <div className="space-y-3">
            <Card><CardContent className="space-y-3 pt-4">
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
                    {system.services.names.length} observed · {shownServices.length} matching · runtime state unknown{system.services.truncated ? " · capped at 256" : ""}
                  </p>
                  <div className="h-[65vh] min-h-[440px] max-h-[900px] overflow-y-auto rounded-lg border">
                    {visibleServices.map(service => (
                      <button type="button" key={service}
                        aria-pressed={selectedService === service}
                        className={"block w-full border-b p-3 text-left font-mono text-xs break-all last:border-b-0 hover:bg-muted/60 " +
                          (selectedService === service ? "bg-muted" : "")}
                        onClick={() => setSelectedService(service)}>
                           <span className="block font-medium">{service.split("/")[0]}</span>
                           <span className="block font-mono text-xs text-muted-foreground">{service.slice(service.indexOf("/") + 1)}</span>
                         </button>
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
                      <p className="text-muted-foreground text-xs">Runtime state not reported. Start/Stop targets this component; Android may refuse.</p>
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
            </CardContent></Card>
          </div>
        )}
        {section === "shell" && <RemoteShellPanel />}
        <details className="mt-5 rounded-xl border bg-card p-4" onToggle={event => setDiagnosticsOpen(event.currentTarget.open)}>
          <summary className="cursor-pointer text-sm font-medium">Advanced Shizuku diagnostics</summary>
          {diagnosticsOpen && <div className="mt-4 [&>div]:border-0 [&>div]:bg-transparent [&>div]:shadow-none"><ShizukuDiagnosticsPanel /></div>}
        </details>

        </div>

      </div>
    </BaseLayout>
  )
}
