import * as React from "react"
import { Archive, Boxes, FolderOpen, Package, RefreshCw, ServerCog, ShieldCheck } from "lucide-react"
import { BaseLayout } from "@/components/layouts/base-layout"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { parseObservabilitySnapshot, type ObservabilitySnapshot } from "@/lib/observability-schema"
import { parseFleetReleases, parseFleetSites, type FleetRelease, type FleetSite } from "@/lib/site-fleet-schema"
import { parseH3Files, parseH3Tools, type H3Files, type H3Tools } from "@/lib/termux-center-schema"
import { PackageActions, WorkspaceManager, SiteServiceActions, WorkspaceBackupActions, RunitServiceActions, PackageCatalog } from "@/app/termux/admin-actions"

async function getData<T>(endpoint: string, parse: (value: unknown) => T, signal?: AbortSignal): Promise<T> {
  const response = await fetch(endpoint, { method: "GET", cache: "no-store", credentials: "same-origin", signal })
  if (!response.ok) throw new Error("read-unavailable")
  return parse(await response.json() as unknown)
}

function State({ value }: { value: string }) {
  return <Badge variant="outline">{value}</Badge>
}
function GuardNotice({ children }: { children: React.ReactNode }) {
  return <p className="text-muted-foreground text-xs">{children}</p>
}

export default function TermuxCenterPage() {
  const [snapshot, setSnapshot] = React.useState<ObservabilitySnapshot | null>(null)
  const [sites, setSites] = React.useState<FleetSite[] | null>(null)
  const [tools, setTools] = React.useState<H3Tools | null>(null)
  const [reading, setReading] = React.useState(false)
  const [errors, setErrors] = React.useState({ snapshot: false, sites: false, tools: false })
  const [query, setQuery] = React.useState("")
  const [selectedFiles, setSelectedFiles] = React.useState<{ site: string; items: H3Files } | null>(null)
  const [selectedReleases, setSelectedReleases] = React.useState<{ site: string; items: FleetRelease[] } | null>(null)
  const [detailError, setDetailError] = React.useState<string | null>(null)
  const [detailsBusy, setDetailsBusy] = React.useState(false)

  const refresh = React.useCallback(async (signal?: AbortSignal) => {
    setReading(true)
    const [observed, owned, optional] = await Promise.allSettled([
      getData("/api/v1/observability", parseObservabilitySnapshot, signal),
      getData("/api/v1/sites", parseFleetSites, signal),
      getData("/api/v1/termux-tools", parseH3Tools, signal),
    ])
    if (signal?.aborted) return
    setSnapshot(observed.status === "fulfilled" ? observed.value : null)
    setSites(owned.status === "fulfilled" ? owned.value : null)
    setTools(optional.status === "fulfilled" ? optional.value : null)
    setErrors({
      snapshot: observed.status === "rejected",
      sites: owned.status === "rejected",
      tools: optional.status === "rejected",
    })
    setSelectedFiles(null)
    setSelectedReleases(null)
    setDetailError(null)
    setReading(false)
  }, [])

  React.useEffect(() => {
    const controller = new AbortController()
    void refresh(controller.signal)
    return () => controller.abort()
  }, [refresh])

  const inspect = async (site: FleetSite, kind: "files" | "releases") => {
    if (detailsBusy || site.state === "unknown") return
    setDetailsBusy(true)
    setDetailError(null)
    try {
      if (kind === "files") {
        const items = await getData("/api/v1/sites/" + site.id + "/files", parseH3Files)
        setSelectedFiles({ site: site.id, items })
      } else {
        const items = await getData("/api/v1/sites/" + site.id + "/releases", parseFleetReleases)
        setSelectedReleases({ site: site.id, items })
      }
    } catch {
      setDetailError("This inventory cannot be read safely. No files or releases were changed.")
      if (kind === "files") setSelectedFiles(null)
      else setSelectedReleases(null)
    } finally {
      setDetailsBusy(false)
    }
  }

  const installed = snapshot?.packages.installed.filter(item =>
    (item.ecosystem + " " + item.name + " " + item.version).toLowerCase().includes(query.toLowerCase().trim()),
  ) ?? []
  const restic = tools?.tools.find(item => item.id === "restic")
  const tooling = tools?.tools ?? []

  return (
    <BaseLayout title="Termux Control Center" description="Manage Termux packages, workspace, owned services and snapshots">
      <div className="flex flex-col gap-5 px-4 pb-8 lg:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Badge variant="outline" className="gap-1"><ShieldCheck className="size-3" /> H3 · owner operations</Badge>
          <Button variant="outline" onClick={() => void refresh()} disabled={reading}>
            <RefreshCw className={reading ? "size-4 animate-spin" : "size-4"} /> Refresh
          </Button>
        </div>
        <GuardNotice>
          This trusted-LAN development panel has no login. Administrative actions are available
          without passwords, with explicit confirmations and fixed Termux commands.
          Do not expose this panel to public networks.
        </GuardNotice>
        <Tabs defaultValue="packages" className="w-full">
          <TabsList className="h-auto flex-wrap justify-start gap-1 p-1" aria-label="Termux modules">
            <TabsTrigger value="packages"><Package className="size-4" /> Packages</TabsTrigger>
            <TabsTrigger value="files"><FolderOpen className="size-4" /> Files</TabsTrigger>
            <TabsTrigger value="services"><ServerCog className="size-4" /> Services</TabsTrigger>
            <TabsTrigger value="backups"><Archive className="size-4" /> Backups</TabsTrigger>
          </TabsList>

          <TabsContent value="packages">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Package className="size-5" /> Installed software</CardTitle>
                <CardDescription>Reuses O1's bounded dpkg, npm and pip inventory; cached update hints are not verified.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input aria-label="Filter installed packages" placeholder="Search installed packages…" value={query}
                  onChange={event => setQuery(event.target.value)} />
                {errors.snapshot && <p role="alert">Package inventory unavailable in this session.</p>}
                {snapshot && <>
                  <div className="flex flex-wrap gap-2">
                    <State value={snapshot.packages.state} />
                    <State value={snapshot.packages.updates.state === "cached-unverified" ? "Cached updates · unverified" : "Update status unknown"} />
                    {snapshot.packages.truncated && <State value="Partial inventory" />}
                  </div>
                  <div className="max-h-[32rem] space-y-1 overflow-auto">
                    {installed.map(item => <div key={item.ecosystem + ":" + item.name}
                      className="flex flex-wrap justify-between gap-2 border-b py-2 text-sm">
                      <span>{item.name} <span className="text-muted-foreground">({item.ecosystem})</span></span>
                      <span className="font-mono text-xs">{item.version}</span>
                    </div>)}
                    {installed.length === 0 && <p className="text-muted-foreground">No matching packages in the bounded sample.</p>}
                  </div>
                  <GuardNotice>Package modifications execute only when you select and confirm an action.</GuardNotice>
                </>}
                {!snapshot && !errors.snapshot && <p role="status">Reading package metadata…</p>}
                <PackageActions />
                <PackageCatalog />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="files">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><FolderOpen className="size-5" /> Managed site files</CardTitle>
                <CardDescription>Actual active-release file names and sizes, limited to explicitly PocketHost-owned static sites.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {errors.sites && <p role="alert">Owned site inventory unavailable or disabled.</p>}
                {sites?.length === 0 && <p>No managed static sites.</p>}
                <div className="space-y-2">
                  {sites?.map(site => <div key={site.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3">
                    <div>
                      <p className="font-medium">{site.name}</p>
                      <p className="text-muted-foreground text-xs">{site.fileCount} files · {site.bytes} bytes · {site.state}</p>
                    </div>
                    <Button size="sm" variant="outline" disabled={detailsBusy || site.state === "unknown" || !site.activeRelease}
                      onClick={() => void inspect(site, "files")}>Inspect files</Button>
                  </div>)}
                </div>
                {selectedFiles && <>
                  <p className="text-sm font-medium">Active release assets ({selectedFiles.items.length})</p>
                  <div className="max-h-80 overflow-auto rounded-md border">
                    {selectedFiles.items.map(item => <div key={item.name} className="flex justify-between gap-3 border-b px-3 py-2 text-xs">
                      <span className="break-all font-mono">{item.name}</span><span className="shrink-0">{item.bytes} B</span>
                    </div>)}
                    {selectedFiles.items.length === 0 && <p className="p-3">No active files.</p>}
                  </div>
                </>}
                {detailError && <p role="alert">{detailError}</p>}
                <a className="text-sm underline underline-offset-4" href="/sites">Open existing site upload and version manager</a>
                <WorkspaceManager />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="services">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><ServerCog className="size-5" /> Termux services</CardTitle>
                <CardDescription>Existing allowlisted runit status checks. Observed services are externally owned, not adopted.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {errors.snapshot && <p role="alert">Service observations unavailable.</p>}
                {snapshot?.host.services.map(service => <div key={service.id} className="flex flex-wrap items-center justify-between gap-3 border-b py-2">
                  <span className="text-sm font-medium">{service.label}</span>
                  <div className="flex gap-2"><Badge variant="outline">External</Badge><State value={service.state} /></div>
                </div>)}
                {!snapshot && !errors.snapshot && <p role="status">Reading service states…</p>}
                <SiteServiceActions sites={sites} reload={() => refresh()} />
                <RunitServiceActions />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="backups">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Archive className="size-5" /> Backup readiness</CardTitle>
                <CardDescription>Optional Restic tool detection and existing immutable website release points.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline"><Boxes className="size-3" /> Restic: {restic?.state ?? "unverified"}</Badge>
                  <Badge variant="outline">Restic jobs: not configured</Badge>
                </div>
                {errors.tools && <p role="alert">Optional tool detection unavailable.</p>}
                {errors.sites && <p role="alert">Existing site release inventory unavailable.</p>}
                {sites?.map(site => <div key={site.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3">
                  <div><p className="font-medium">{site.name}</p>
                    <p className="text-muted-foreground text-xs">{site.releases} immutable releases · not an independent backup</p>
                  </div>
                  <Button variant="outline" size="sm" disabled={detailsBusy || site.state === "unknown" || site.releases === 0}
                    onClick={() => void inspect(site, "releases")}>View release history</Button>
                </div>)}
                {selectedReleases && <div className="max-h-80 space-y-2 overflow-auto rounded-md border p-3">
                  <p className="text-sm font-medium">Stored release points</p>
                  {selectedReleases.items.map(release => <div key={release.id} className="flex flex-wrap justify-between gap-2 border-b py-2 text-xs">
                    <span className="break-all font-mono">{release.id.slice(0, 14)}…</span>
                    <span>{release.createdAt.slice(0, 10)} · {release.bytes} B</span>
                    <span>{release.active ? "Active" : release.rollbackTarget ? "Rollback target" : "Archive"}</span>
                  </div>)}
                </div>}
                {detailError && <p role="alert">{detailError}</p>}
                <WorkspaceBackupActions />
                <GuardNotice>Snapshots protect the H3 workspace; website releases are separate and do not replace a full Termux backup.</GuardNotice>
                <p className="text-sm font-medium">Optional integrations</p>
                <div className="flex flex-wrap gap-2">{tooling.map(item =>
                  <Badge key={item.id} variant="outline">{item.id}: {item.state}</Badge>)}</div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </BaseLayout>
  )
}
