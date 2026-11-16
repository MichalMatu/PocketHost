import * as React from "react"
import { Link } from "react-router-dom"
import { RefreshCw, ShieldCheck } from "lucide-react"
import { BaseLayout } from "@/components/layouts/base-layout"
import { Button } from "@/components/ui/button"

type GitStatus = {
  version: 1
  mode: "read-only"
  scope: "running-panel-checkout"
  observedAt: string
  git: "available" | "unavailable"
  checkout: "clean" | "dirty" | "unverified"
  branch: "attached" | "detached" | "unverified"
  origin: "github" | "other" | "missing" | "unverified"
  head: string | null
  credentials: "not-checked"
  remoteConnectivity: "not-checked"
  operations: "none"
}
type BootStatus = {
  state: "scripts-present" | "no-scripts" | "unverified"
  scriptCount: number | null
  androidPermission: "not-verified"
  rebootReadback: "not-verified"
}
type SshStatus = {
  mode: "read-only"
  runit: { state: "running" | "stopped" | "unknown" }
  notice: "external-protected-no-lifecycle-control"
}
type LanStatus = { enabled: boolean; mode: "auto" | "manual"; bind: string | null }

async function inspect<T>(route: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(route, { cache: "no-store", credentials: "same-origin", signal })
  if (!response.ok) throw new Error("platform-status-unavailable")
  return await response.json() as T
}

export default function PlatformPage() {
  const [status, setStatus] = React.useState<{
    git: GitStatus | null
    boot: BootStatus | null
    ssh: SshStatus | null
    lan: LanStatus | null
  } | null>(null)
  const [refreshId, setRefreshId] = React.useState(0)
  const [loading, setLoading] = React.useState(false)

  React.useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    void Promise.allSettled([
      inspect<GitStatus>("/api/v1/termux-admin?mode=git-workspace", controller.signal),
      inspect<BootStatus>("/api/v1/termux-admin?mode=service-boot", controller.signal),
      inspect<SshStatus>("/api/v1/termux-admin?mode=ssh-diagnostics", controller.signal),
      inspect<LanStatus>("/api/v1/network-access", controller.signal),
    ]).then(results => {
      if (controller.signal.aborted) return
      const [git, boot, ssh, lan] = results.map(result => result.status === "fulfilled" ? result.value : null)
      setStatus({
        git: git && git.version === 1 && git.mode === "read-only" &&
          git.scope === "running-panel-checkout" && git.credentials === "not-checked" &&
          git.remoteConnectivity === "not-checked" && git.operations === "none" ? git : null,
        boot: boot && boot.androidPermission === "not-verified" &&
          boot.rebootReadback === "not-verified" ? boot : null,
        ssh: ssh && ssh.mode === "read-only" &&
          ssh.notice === "external-protected-no-lifecycle-control" ? ssh : null,
        lan: lan && typeof lan.enabled === "boolean" &&
          (lan.mode === "auto" || lan.mode === "manual") ? lan : null,
      })
    }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [refreshId])

  const rows = [
    {
      title: "Private LAN",
      detail: status?.lan ? (status.lan.enabled
        ? "Enabled · " + status.lan.mode : "Disabled") : "Unverified",
      url: "/settings/network", link: "Configure LAN",
    },
    {
      title: "SSH",
      detail: status?.ssh ? "Runit " + status.ssh.runit.state + " · protected / read-only" : "Unverified",
      url: "/services/ssh", link: "Inspect SSH",
    },
    {
      title: "Termux:Boot",
      detail: status?.boot ? (status.boot.state === "scripts-present"
        ? status.boot.scriptCount + " script(s) detected · reboot unverified"
        : status.boot.state === "no-scripts" ? "No scripts detected · reboot unverified"
        : "Boot configuration unverified") : "Unverified",
      url: "/services/autostart", link: "Inspect autostart",
    },
    {
      title: "Git / GitHub",
      detail: status?.git?.git === "available"
        ? "Checkout " + status.git.checkout + " · origin " + status.git.origin
        : "Local Git unverified",
      url: null, link: null,
    },
  ]

  return <BaseLayout title="Platform" description="LAN, SSH, Android boot and Git/GitHub">
    <div className="space-y-4 px-4 pb-8 lg:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="size-4" /> Observation only; no service actions
        </p>
        <Button size="sm" variant="outline" disabled={loading}
          onClick={() => setRefreshId(id => id + 1)}>
          <RefreshCw className="size-4" /> Refresh
        </Button>
      </div>
      <section aria-label="Platform status" className="divide-y rounded-md border">
        {rows.map(item => <div key={item.title}
          className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <p className="text-sm font-medium">{item.title}</p>
            <p className="text-xs text-muted-foreground">{item.detail}</p>
          </div>
          {item.url && <Link to={item.url}
            className="text-sm underline-offset-4 hover:underline">{item.link}</Link>}
        </div>)}
      </section>
      {status?.git?.head && <p className="text-xs text-muted-foreground">
        Local HEAD: <code>{status.git.head.slice(0, 12)}</code> · {status.git.branch}
      </p>}
      <p className="text-xs text-muted-foreground">
        Git credentials and remote connectivity are not checked. Startup after reboot is
        unverified. SSH is protected and cannot be changed here.
      </p>
    </div>
  </BaseLayout>
}
