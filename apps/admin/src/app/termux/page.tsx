import * as React from "react"
import { Link } from "react-router-dom"
import { Archive, Boxes, FolderOpen, Package, RefreshCw, ServerCog, ShieldCheck } from "lucide-react"
import { BaseLayout } from "@/components/layouts/base-layout"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { parseObservabilitySnapshot, type ObservabilitySnapshot } from "@/lib/observability-schema"
import { parseH3Tools, type H3Tools } from "@/lib/termux-center-schema"
import { TermuxFileExplorer } from "@/app/termux/full-files"
import { TermuxTerminalPanel } from "@/app/termux/terminal-panel"
import { FullTermuxBackups } from "@/app/termux/system-backups"
import { AgentApiPanel } from "@/app/termux/agent-panel"
import { PackageActions, WorkspaceBackupActions, RunitServiceActions, PackageCatalog, ResticActions } from "@/app/termux/admin-actions"

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

export type TermuxSection = "packages" | "files" | "services" | "backups" | "terminal" | "agents"

const sectionTitles: Record<TermuxSection, string> = {
  packages: "Packages & Software",
  files: "File Manager",
  services: "Services & Processes",
  backups: "Backups & Recovery",
  terminal: "Terminal",
  agents: "Agents & API",
}

export default function TermuxCenterPage({ section = "packages" }: { section?: TermuxSection }) {
  const [snapshot, setSnapshot] = React.useState<ObservabilitySnapshot | null>(null)
  const [tools, setTools] = React.useState<H3Tools | null>(null)
  const [reading, setReading] = React.useState(false)
  const [errors, setErrors] = React.useState({ snapshot: false, tools: false })
  const [query, setQuery] = React.useState("")

  const refresh = React.useCallback(async (signal?: AbortSignal) => {
    setReading(true)
    const [observed, optional] = await Promise.allSettled([
      ["packages", "services"].includes(section)
        ? getData("/api/v1/observability", parseObservabilitySnapshot, signal)
        : Promise.resolve(null),
      ["backups", "terminal"].includes(section)
        ? getData("/api/v1/termux-tools", parseH3Tools, signal)
        : Promise.resolve(null),
    ])
    if (signal?.aborted) return
    setSnapshot(observed.status === "fulfilled" ? observed.value : null)
    setTools(optional.status === "fulfilled" ? optional.value : null)
    setErrors({
      snapshot: observed.status === "rejected",
      tools: optional.status === "rejected",
    })
    setReading(false)
  }, [section])

  React.useEffect(() => {
    const controller = new AbortController()
    void Promise.resolve().then(() => {
      if (!controller.signal.aborted) return refresh(controller.signal)
    })
    return () => controller.abort()
  }, [refresh])

  const installed = snapshot?.packages.installed.filter(item =>
    (item.ecosystem + " " + item.name + " " + item.version).toLowerCase().includes(query.toLowerCase().trim()),
  ) ?? []
  const restic = tools?.tools.find(item => item.id === "restic")
  const tooling = tools?.tools ?? []

  return (
    <BaseLayout title={sectionTitles[section]} description="Manage this Termux installation through scoped, typed controls">
      <div className="flex flex-col gap-5 px-4 pb-8 lg:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="gap-1"><ShieldCheck className="size-3" />Termux</Badge>
            <Link to="/settings/network" className="text-muted-foreground text-xs underline-offset-4 hover:underline">
              LAN only · no login
            </Link>
          </div>
          <Button variant="outline" onClick={() => void refresh()} disabled={reading}>
            <RefreshCw className={reading ? "size-4 animate-spin" : "size-4"} /> Refresh
          </Button>
        </div>
        <div className="space-y-5">
  
          {section === "packages" && <section className="space-y-4">
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
          </section>}

          {section === "files" && <section className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><FolderOpen className="size-5" /> File Manager</CardTitle>
                <CardDescription>One explorer for HOME, PREFIX, shared storage and the H3 workspace.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <TermuxFileExplorer />
                <GuardNotice>
                  Files inside a PocketHost-created website belong to <a className="underline underline-offset-4" href="/sites">Hosting → Websites</a>. This File Manager remains for Termux system paths.
                </GuardNotice>
              </CardContent>
            </Card>
          </section>}

          {section === "services" && <section className="space-y-4">
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
                <RunitServiceActions />
                <GuardNotice>
                  PocketHost-owned websites are managed in <a className="underline underline-offset-4" href="/sites">Hosting → Websites</a>, not in the system service inventory.
                </GuardNotice>
              </CardContent>
            </Card>
          </section>}

          {section === "backups" && <section className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Archive className="size-5" /> Backup readiness</CardTitle>
                <CardDescription>Optional Restic tool detection and scoped Termux backup operations.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline"><Boxes className="size-3" /> Restic: {restic?.state ?? "unverified"}</Badge>
                  <Badge variant="outline">Restic jobs: not configured</Badge>
                </div>
                {errors.tools && <p role="alert">Optional tool detection unavailable.</p>}
                <GuardNotice>
                  Website versions and release rollback belong to <a href="/sites" className="underline underline-offset-4">Hosting → Websites</a>. A release is not an independent data backup.
                </GuardNotice>
                <WorkspaceBackupActions />
                <ResticActions detected={restic?.state === "detected"} />
                <FullTermuxBackups detected={restic?.state === "detected"} />
                <GuardNotice>Snapshots protect the H3 workspace; website releases are separate and do not replace a full Termux backup.</GuardNotice>
                <p className="text-sm font-medium">Optional integrations</p>
                <div className="flex flex-wrap gap-2">{tooling.map(item =>
                  <Badge key={item.id} variant="outline">{item.id}: {item.state}</Badge>)}</div>
              </CardContent>
            </Card>
          </section>}
          {section === "terminal" && <section className="space-y-4">
            <TermuxTerminalPanel detected={tools?.tools.some(item => item.id === "ttyd" && item.state === "detected") ?? false} />
          </section>}
          {section === "agents" && <section className="space-y-4">
            <AgentApiPanel />
          </section>}
        </div>
      </div>
    </BaseLayout>
  )
}
