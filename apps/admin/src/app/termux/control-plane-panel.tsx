import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { ControlPlaneDiagnostic } from "@/lib/control-plane-schema"
import { formatAgentDuration } from "@/lib/local-agent-time"

const short = (value: string | null) => value ? value.slice(0, 12) : "Not available from this diagnostic"
const ownerReason: Record<string, string> = {
  unavailable: "Owner evidence could not be read",
  "invalid-owner": "Owner record could not be validated",
  "untrusted-checkout": "Checkout validation failed",
  "invalid-process": "Process identity could not be verified",
  "invalid-source": "Source revision could not be verified",
}
type Runit = ControlPlaneDiagnostic["localAgent"]["runit"]
const status = (data: Runit) => data.state + (data.uptimeSeconds === null
  ? " · uptime unavailable" : " · " + formatAgentDuration(data.uptimeSeconds))

export function ControlPlanePanel({
  data, loading, error,
}: {
  data: ControlPlaneDiagnostic | null
  loading: boolean
  error: boolean
}) {
  return <Card>
    <CardHeader>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <CardTitle className="text-base">Local Agent & PocketHost</CardTitle>
        <Badge variant="outline">Protected · read-only</Badge>
      </div>
    </CardHeader>
    <CardContent className="space-y-3 text-sm">
      {loading && <p role="status">Reading control-plane diagnostics…</p>}
      {error && <p role="alert">
        Control-plane diagnostics unavailable.{" "}
        {data ? "Last successful snapshot shown; it may be stale." : "No snapshot available."}{" "}
        No services were changed.
      </p>}
      {data && <>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-md border p-3 space-y-1">
            <h3 className="font-medium">Local Agent</h3>
            <p>Runit: {status(data.localAgent.runit)}</p>
            <p>Emergency STOP marker: {data.localAgent.intake}</p>
            <p>Local claims: {data.localAgent.claims ?? "unverified"}</p>
            <p>Local result spools: {data.localAgent.spooled ?? "unverified"}</p>
            <p>Claims without local spool: {data.localAgent.unspooledClaims ?? "unverified"}</p>
            <p>Orphan local spools: {data.localAgent.orphanSpools ?? "unverified"}</p>
            <p>Latest locally correlated result: {data.localAgent.lastResult}</p>
            {data.localAgent.lastResultAt && <p>
              Local spool modified: {new Date(data.localAgent.lastResultAt).toLocaleString()}
            </p>}
            <p>Remote publication: {data.localAgent.publication}</p>
            <p className="text-xs text-muted-foreground">
              No STOP marker does not prove that task intake works. File counts do not prove
              remote delivery or authenticated Agent identity. Last result is matched to a local
              claim only. Missing spools can indicate ongoing or interrupted work; never auto-replay.
            </p>
          </div>
          <div className="rounded-md border p-3 space-y-1">
            <h3 className="font-medium">PocketHost</h3>
            <p>Runit: {status(data.pocketHost.runit)}</p>
            <p>Watch: {status(data.pocketHost.watch)}</p>
            <p>Process ownership: {data.pocketHost.owner.state === "verified"
              ? "Verified by this diagnostic" :
              ownerReason[data.pocketHost.owner.reason ?? ""] ?? "Not established by this diagnostic"}</p>
            <p>{data.pocketHost.owner.pid === null ? "PID not reported by this diagnostic" :
              "PID " + data.pocketHost.owner.pid + " · start ticks " + data.pocketHost.owner.startTicks}</p>
          </div>
        </div>
        <div className="rounded-md border p-3 space-y-1">
          <h3 className="font-medium">Source revision</h3>
          <p>Recorded startup SHA: <code>{short(data.pocketHost.owner.markerSha)}</code></p>
          <p>Gateway marker SHA: <code>{short(data.pocketHost.owner.gatewaySha)}</code></p>
          <p>Owner record agreement: <strong>{data.pocketHost.owner.markerAgreement === "unverified"
            ? "Not established by this diagnostic" : data.pocketHost.owner.markerAgreement}</strong></p>
          <p>Checkout HEAD: <code>{short(data.pocketHost.owner.checkoutSha)}</code></p>
          <p>Revision comparison: <strong>{data.pocketHost.owner.revision === "unverified"
            ? "Not established by this diagnostic" : data.pocketHost.owner.revision}</strong></p>
          <p>Git history: {data.pocketHost.owner.revisionEvidence.state === "unavailable"
            ? "Not available from this diagnostic" : data.pocketHost.owner.revisionEvidence.state}</p>
          {data.pocketHost.owner.revisionEvidence.areas && <p>
            Files changed: {data.pocketHost.owner.revisionEvidence.changedFiles}
            {" · Admin UI: "}{data.pocketHost.owner.revisionEvidence.areas.adminUI}
            {" · Host: "}{data.pocketHost.owner.revisionEvidence.areas.hostBackend}
            {" · Tests: "}{data.pocketHost.owner.revisionEvidence.areas.tests}
            {" · Docs: "}{data.pocketHost.owner.revisionEvidence.areas.docs}
            {" · Other: "}{data.pocketHost.owner.revisionEvidence.areas.other}
          </p>}
          <p>Checkout clean: {data.pocketHost.owner.checkoutClean === null
            ? "Not established by this diagnostic" : data.pocketHost.owner.checkoutClean ? "yes" : "no"}</p>
          {data.pocketHost.owner.reason && <p>Diagnostic: {data.pocketHost.owner.reason}</p>}
          <p className="text-xs text-muted-foreground">
            Historical changes do not prove the JavaScript version loaded in memory.
          </p>
        </div>
        <p role="status">This read-only diagnostic cannot authorize a PocketHost restart.
          Missing ownership evidence here does not by itself mean that the running service is stopped.
        </p>
        <p className="text-xs text-muted-foreground">
          No lifecycle controls are granted. Observed {new Date(data.observedAt).toLocaleString()}.
        </p>
      </>}
    </CardContent>
  </Card>
}
