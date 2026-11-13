import * as React from "react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { controlPlaneSchema, type ControlPlaneDiagnostic } from "@/lib/control-plane-schema"

const short = (value: string | null) => value ? value.slice(0, 12) : "unverified"
type Runit = ControlPlaneDiagnostic["localAgent"]["runit"]
const status = (data: Runit) => data.state + (data.uptimeSeconds === null
  ? " · uptime unavailable" : " · " + data.uptimeSeconds + "s")

export function ControlPlanePanel({ refreshToken = 0 }: { refreshToken?: number }) {
  const [data, setData] = React.useState<ControlPlaneDiagnostic | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState(false)
  React.useEffect(() => {
    const controller = new AbortController()
    setData(null)
    setError(false)
    setLoading(true)
    void fetch("/api/v1/termux-admin?mode=control-plane-diagnostics", {
      method: "GET", credentials: "same-origin", cache: "no-store", signal: controller.signal,
    }).then(async response => {
      if (!response.ok) throw Error("unavailable")
      return controlPlaneSchema.parse(await response.json() as unknown)
    }).then(value => {
      if (!controller.signal.aborted) { setData(value); setLoading(false) }
    }).catch(() => {
      if (!controller.signal.aborted) { setError(true); setLoading(false) }
    })
    return () => controller.abort()
  }, [refreshToken])
  return <Card>
    <CardHeader>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <CardTitle className="text-base">Local Agent & PocketHost</CardTitle>
        <Badge variant="outline">Protected · read-only</Badge>
      </div>
    </CardHeader>
    <CardContent className="space-y-3 text-sm">
      {loading && <p role="status">Reading control-plane diagnostics…</p>}
      {error && <p role="alert">Control-plane diagnostics unavailable. No services were changed.</p>}
      {data && !loading && <>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-md border p-3 space-y-1">
            <h3 className="font-medium">Local Agent</h3>
            <p>Runit: {status(data.localAgent.runit)}</p>
            <p>Emergency STOP marker: {data.localAgent.intake}</p>
            <p>Local claims: {data.localAgent.claims ?? "unverified"}</p>
            <p>Local result spools: {data.localAgent.spooled ?? "unverified"}</p>
            <p>Claims without local spool: {data.localAgent.unspooledClaims ?? "unverified"}</p>
            <p>Last result outcome: {data.localAgent.lastResult}</p>
            <p>Remote publication: {data.localAgent.publication}</p>
            <p className="text-xs text-muted-foreground">
              No STOP marker does not prove that task intake works. File counts do not prove
              spool integrity, task completion or GitHub delivery. Missing spool records can
              indicate execution still in progress or interrupted work; do not automatically replay.
            </p>
          </div>
          <div className="rounded-md border p-3 space-y-1">
            <h3 className="font-medium">PocketHost</h3>
            <p>Runit: {status(data.pocketHost.runit)}</p>
            <p>Watch: {status(data.pocketHost.watch)}</p>
            <p>Process ownership: {data.pocketHost.owner.state}</p>
            <p>{data.pocketHost.owner.pid === null ? "PID unavailable" :
              "PID " + data.pocketHost.owner.pid + " · start ticks " + data.pocketHost.owner.startTicks}</p>
          </div>
        </div>
        <div className="rounded-md border p-3 space-y-1">
          <h3 className="font-medium">Source revision</h3>
          <p>Recorded startup SHA: <code>{short(data.pocketHost.owner.markerSha)}</code></p>
          <p>Gateway marker SHA: <code>{short(data.pocketHost.owner.gatewaySha)}</code></p>
          <p>Owner record agreement: <strong>{data.pocketHost.owner.markerAgreement}</strong></p>
          <p>Checkout HEAD: <code>{short(data.pocketHost.owner.checkoutSha)}</code></p>
          <p>Revision comparison: <strong>{data.pocketHost.owner.revision}</strong></p>
          <p>Git history: {data.pocketHost.owner.revisionEvidence.state}</p>
          {data.pocketHost.owner.revisionEvidence.areas && <p>
            Files changed: {data.pocketHost.owner.revisionEvidence.changedFiles}
            {" · Admin UI: "}{data.pocketHost.owner.revisionEvidence.areas.adminUI}
            {" · Host: "}{data.pocketHost.owner.revisionEvidence.areas.hostBackend}
            {" · Tests: "}{data.pocketHost.owner.revisionEvidence.areas.tests}
            {" · Docs: "}{data.pocketHost.owner.revisionEvidence.areas.docs}
            {" · Other: "}{data.pocketHost.owner.revisionEvidence.areas.other}
          </p>}
          <p>Checkout clean: {data.pocketHost.owner.checkoutClean === null
            ? "unverified" : data.pocketHost.owner.checkoutClean ? "yes" : "no"}</p>
          {data.pocketHost.owner.reason && <p>Diagnostic: {data.pocketHost.owner.reason}</p>}
          <p className="text-xs text-muted-foreground">
            Historical changes do not prove the JavaScript version loaded in memory.
          </p>
        </div>
        <p role="status">Update readiness: manual review required · restart blocked.</p>
        <p className="text-xs text-muted-foreground">
          No lifecycle controls are granted. Observed {new Date(data.observedAt).toLocaleString()}.
        </p>
      </>}
    </CardContent>
  </Card>
}
