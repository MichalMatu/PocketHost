import * as React from "react"
import { Link } from "react-router-dom"
import { Archive, Boxes, RefreshCw, ShieldCheck } from "lucide-react"
import { BaseLayout } from "@/components/layouts/base-layout"
import { navGroups } from "@/config/navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { parseObservabilitySnapshot, type ObservabilitySnapshot } from "@/lib/observability-schema"
import { parseH3Tools, type H3Tools } from "@/lib/termux-center-schema"
import { TermuxFileExplorer } from "@/app/termux/full-files"
import { TermuxTerminalPanel } from "@/app/termux/terminal-panel"
import { FullTermuxBackups } from "@/app/termux/system-backups"
import { AgentApiPanel } from "@/app/termux/agent-panel"
import { PackageManager, WorkspaceBackupActions, RunitServiceActions, ResticActions } from "@/app/termux/admin-actions"

async function getData<T>(endpoint: string, parse: (value: unknown) => T, signal?: AbortSignal): Promise<T> {
  const response = await fetch(endpoint, { method: "GET", cache: "no-store", credentials: "same-origin", signal })
  if (!response.ok) throw new Error("read-unavailable")
  return parse(await response.json() as unknown)
}

function GuardNotice({ children }: { children: React.ReactNode }) {
  return <p className="text-muted-foreground text-xs">{children}</p>
}

export type TermuxSection = "packages" | "files" | "services" | "backups" | "terminal" | "agents"

const sectionTitles: Record<TermuxSection, string> = {
  packages: "Packages & Software",
  files: "File Manager",
  services: "Services",
  backups: "Backups & Recovery",
  terminal: "Terminal",
  agents: "Agents & API",
}

export default function TermuxCenterPage({ section = "packages" }: { section?: TermuxSection }) {
  const [snapshot, setSnapshot] = React.useState<ObservabilitySnapshot | null>(null)
  const [tools, setTools] = React.useState<H3Tools | null>(null)
  const [reading, setReading] = React.useState(false)
  const [errors, setErrors] = React.useState({ snapshot: false, tools: false })
  const [sectionRefreshToken, setSectionRefreshToken] = React.useState(0)
  const [lastOverviewRead, setLastOverviewRead] = React.useState<number | null>(null)

  const refresh = React.useCallback(async (signal?: AbortSignal) => {
    setReading(true)
    const [observed, optional] = await Promise.allSettled([
      section === "packages"
        ? getData("/api/v1/observability", parseObservabilitySnapshot, signal)
        : Promise.resolve(null),
      ["backups", "terminal"].includes(section)
        ? getData("/api/v1/termux-tools", parseH3Tools, signal)
        : Promise.resolve(null),
    ])
    if (signal?.aborted) return
    if ((observed.status === "fulfilled" && observed.value !== null) ||
        (optional.status === "fulfilled" && optional.value !== null)) setLastOverviewRead(Date.now())
    setSnapshot(previous => observed.status === "fulfilled" ? observed.value : previous)
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

  const restic = tools?.tools.find(item => item.id === "restic")
  const tooling = tools?.tools ?? []
  const overviewTracked = ["packages", "backups", "terminal"].includes(section)
  const overviewFailed = (section === "packages" && errors.snapshot) ||
    (["backups", "terminal"].includes(section) && errors.tools)
  const overviewSource = section === "packages" ? "Observability" : "Tool inventory"
  const serviceLinks = navGroups.find(group => group.label === "Services")
    ?.items.filter(item => item.url !== "/services") ?? []

  return (
    <BaseLayout title={sectionTitles[section]} >
      <div className="flex flex-col gap-5 px-4 pb-8 lg:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="gap-1"><ShieldCheck className="size-3" />Termux</Badge>
            <Link to="/settings/network" className="text-muted-foreground text-xs underline-offset-4 hover:underline">
              <Badge variant="outline">LAN only · no login</Badge>
            </Link>
          </div>
          {overviewTracked && <p role="status" className="text-xs text-muted-foreground">
            {overviewSource}: {reading ? "Loading…" : overviewFailed ? "Unavailable · retry" :
              lastOverviewRead === null ? "Not checked" : "Ready"}
            {lastOverviewRead !== null && !reading &&
              <span> · last successful read {new Date(lastOverviewRead).toLocaleTimeString()}</span>}
          </p>}
          <Button variant="outline" onClick={() => { setSectionRefreshToken(value => value + 1); void refresh() }} disabled={reading}>
            <RefreshCw className={reading ? "size-4 animate-spin" : "size-4"} /> Refresh
          </Button>
        </div>
        <div className="space-y-5">
  
          {section === "packages" && <section className="space-y-4">
            <Card>
              <CardHeader><CardTitle>Software inventory and catalog</CardTitle></CardHeader>
              <CardContent>
                <PackageManager summary={snapshot?.packages} summaryError={errors.snapshot}
                  refreshToken={sectionRefreshToken} onChanged={() => void refresh()} />
              </CardContent>
            </Card>
          </section>}

          {section === "files" && <section className="space-y-4">
            <Card>
              <CardContent className="space-y-4 pt-4">
                <TermuxFileExplorer refreshToken={sectionRefreshToken} />
              </CardContent>
            </Card>
          </section>}

          {section === "services" && <section className="space-y-4">
            <div className="space-y-3">
              <div>
                <h2 className="text-sm font-semibold">Service workspaces</h2>
                <p className="text-xs text-muted-foreground">
                  Each service has its own page. External services remain read-only.
                </p>
              </div>
              <nav aria-label="Service workspaces" className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {serviceLinks.map(({ title, url, icon: Icon }) =>
                  <Link key={url} to={url}
                    className="flex min-w-0 items-center gap-3 rounded-lg border px-3 py-3 text-sm
                      transition-colors hover:bg-accent hover:text-accent-foreground">
                    <Icon className="size-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate font-medium">{title}</span>
                    <span className="text-xs text-muted-foreground">Open</span>
                  </Link>)}
              </nav>
            </div>
            <div className="space-y-2">
              <h2 className="text-sm font-semibold">Runit inventory</h2>
              <p className="text-xs text-muted-foreground">
                Discovered processes are not automatically owned by PocketHost.
              </p>
              <RunitServiceActions refreshToken={sectionRefreshToken} />
            </div>
          </section>}

          {section === "backups" && <section className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Archive className="size-5" /> Backup readiness</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Badge variant="outline"><Boxes className="size-3" /> Restic: {restic?.state ?? "unverified"}</Badge>
                {errors.tools && <p role="alert">Optional tool detection unavailable.</p>}
                <GuardNotice>
                  These are local recovery mechanisms, not off-device disaster recovery.
                  Keep an independent copy and its recovery key outside this phone.
                  Termux backups, PocketHost workspace snapshots, and <a href="/sites"
                    className="underline underline-offset-4">website versions</a> are separate.
                  Restores use an isolated location.
                </GuardNotice>
                <div className="flex flex-wrap gap-2">{tooling.map(item =>
                  <Badge key={item.id} variant="outline">{item.id}: {item.state}</Badge>)}</div>
              </CardContent>
            </Card>
            <div className="space-y-2">
              <h2 className="text-sm font-semibold">1. PocketHost workspace</h2>
              <p className="text-xs text-muted-foreground">Fast snapshots of PocketHost-owned files only.</p>
              <WorkspaceBackupActions refreshToken={sectionRefreshToken} />
            </div>
            <div className="space-y-2">
              <h2 className="text-sm font-semibold">2. Encrypted workspace archive</h2>
              <p className="text-xs text-muted-foreground">Restic protects the workspace locally; recovery needs the key.</p>
              <ResticActions detected={restic?.state === "detected"} refreshToken={sectionRefreshToken} />
            </div>
            <div className="space-y-2">
              <h2 className="text-sm font-semibold">3. Termux system archive</h2>
              <p className="text-xs text-muted-foreground">Choose HOME, PREFIX or both. Restores go to staging.</p>
              <FullTermuxBackups detected={restic?.state === "detected"} refreshToken={sectionRefreshToken} />
            </div>
          </section>}
          {section === "terminal" && <section className="space-y-4">
            <TermuxTerminalPanel
              detected={tools ? tools.tools.some(item => item.id === "ttyd" && item.state === "detected") : undefined}
              detectionError={errors.tools} refreshToken={sectionRefreshToken} />
          </section>}
          {section === "agents" && <section className="space-y-4">
            <AgentApiPanel refreshToken={sectionRefreshToken} />
          </section>}
        </div>
      </div>
    </BaseLayout>
  )
}
