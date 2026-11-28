import * as React from "react"
import { Link } from "react-router-dom"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  getJson, serviceName, needsAttention,
  type VerifiedService, type RecoveryReview, type RunitHealth,
  type HealthOverview, type HttpReadinessResult,
} from "./runit-health-contract"
import { createRunitHealthObservations } from "./runit-health-observations"
import { createRunitHealthRecovery } from "./runit-health-recovery"

export function RunitHealthPanel() {
  const [services, setServices] = React.useState<VerifiedService[] | null>(null)
  const [busy, setBusy] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [readback, setReadback] = React.useState<RunitHealth | null>(null)
  const [recovery, setRecovery] = React.useState<RecoveryReview | null>(null)
  const [notice, setNotice] = React.useState<string | null>(null)
  const [overview, setOverview] = React.useState<HealthOverview | null>(null)
  const [httpPort, setHttpPort] = React.useState("")
  const [httpPath, setHttpPath] = React.useState("/health")
  const [httpResult, setHttpResult] = React.useState<HttpReadinessResult | null>(null)

  const refresh = React.useCallback(async () => {
    // On unavailable or untrusted inventory, no old health/recovery controls survive.
    setServices(null)
    setOverview(null)
    setHttpResult(null)
    setReadback(null)
    setRecovery(null)
    setNotice(null)
    setError(null)
    const result = await getJson<{ services: VerifiedService[] }>("?mode=services")
    if (!Array.isArray(result.services) || result.services.length > 100 ||
        !result.services.every(service =>
          serviceName.test(service.name) &&
          typeof service.registered === "boolean" &&
          typeof service.protected === "boolean" &&
          ["standalone", "delegated", "read-only"].includes(service.control) &&
          ["verified", "unregistered", "legacy", "changed", "archive-conflict",
           "reserved"].includes(service.identity) &&
          typeof service.identityReason === "string" &&
          service.identityReason.length < 96 &&
          (service.template === undefined ||
            service.template === "heartbeat-worker-v1" ||
            service.template === "python-heartbeat-v1" ||
            service.template === "python-source-v1" ||
            service.template === "node-source-v1"))) {
      throw new Error("Invalid service inventory")
    }
    setServices(result.services.filter(service =>
      service.registered && !service.protected &&
      service.control === "standalone" &&
      service.identity === "verified" &&
      service.identityReason === "run-sha-attested" &&
      service.template !== undefined))
  }, [])

  React.useEffect(() => {
    void Promise.resolve().then(refresh).catch(() => setError("Service inventory unavailable"))
  }, [refresh])

  const { refreshOverview, inspect, inspectHttp } = createRunitHealthObservations({
    services, busy, setBusy, setError, setNotice, setOverview,
    setReadback, setRecovery, httpPort, httpPath, setHttpResult,
  })
  const { setHeartbeat, reviewRecovery, recoverOnce } = createRunitHealthRecovery({
    services, busy, recovery, setBusy, setError, setNotice,
    setReadback, setRecovery, setHttpResult,
  })

  return <section className="space-y-3 rounded-md border p-3" aria-label="Runit health observations">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className="text-sm font-medium">Runit process observations</h3>
      <Button variant="outline" disabled={busy !== null}
        onClick={() => void refresh().catch(() => setError("Service inventory unavailable"))}>
        Refresh services
      </Button>
    </div>
    <p className="text-xs text-muted-foreground">
      Health observations are manual and read-only; fixed-template recovery and heartbeat policy changes require an explicit action.
      Process state and recent log output are not application readiness.
      Recovery requires a separate manual review. It is limited to PocketHost's fixed
      Node.js/Python workers and never runs in the background.
    </p>
    <section className="space-y-2 rounded-md border p-3" aria-label="Standalone worker health overview">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-medium">Standalone workers · health snapshot</h4>
        <Button variant="outline" disabled={busy !== null || services === null}
          onClick={() => void refreshOverview()}>
          {busy === "__overview__" ? "Reading…" : "Inspect all workers"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        One manual read of up to four verified PocketHost workers. No polling,
        HTTP readiness claim or automatic recovery.
      </p>
      {overview && <>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">Workers: {overview.rows.length}</Badge>
          <Badge variant="outline">Needs attention: {overview.rows.filter(row =>
            row.status === "unavailable" || needsAttention(row.health)).length}</Badge>
          <Badge variant="outline">Unverified registrations: {overview.blockedRegistrations}</Badge>
        </div>
        {overview.rows.map(row => <div key={row.name}
          className="flex flex-wrap items-center justify-between gap-2 border-b py-2">
          <div className="space-y-1">
            <p className="text-sm font-medium">{row.name}</p>
            {row.status === "unavailable" ?
              <p role="alert" className="text-xs">Ownership or observation changed · no health claim</p> :
              <div className="flex flex-wrap gap-1">
                <Badge variant="outline">Runit: {row.health.observed}</Badge>
                <Badge variant="outline">Heartbeat: {row.health.heartbeat.mode === "disabled"
                  ? "off" : row.health.heartbeat.status}</Badge>
                <Badge variant="outline">Process: {row.health.process.status === "observed"
                  ? "PID " + row.health.process.pid + " · " +
                    row.health.process.uptimeSeconds + "s"
                  : row.health.process.status}</Badge>
                <Badge variant="outline">{needsAttention(row.health)
                  ? "Needs inspection" : "Observed · readiness unverified"}</Badge>
              </div>}
          </div>
          {row.status === "observed" && <Button variant="outline"
            disabled={busy !== null} onClick={() => {
              const service = services?.find(item => item.name === row.name)
              if (service) void inspect(service)
            }}>Details</Button>}
        </div>)}
        {overview.rows.length === 0 && <p className="text-xs">No attested standalone workers.</p>}
        {overview.truncated && <p role="alert" className="text-xs">
          Worker limit exceeded; snapshot incomplete.
        </p>}
        <p className="text-xs text-muted-foreground">
          Observed {new Date(overview.checkedAt).toLocaleString()} · no automatic refresh
        </p>
      </>}
    </section>
    {error && <p role="alert" className="text-xs">{error}</p>}
    {notice && <p role="status" className="text-xs">{notice}</p>}
    {services === null && !error && <p className="text-xs text-muted-foreground">Loading verified services…</p>}
    {services?.length === 0 && <div className="flex flex-wrap items-center gap-3 rounded-md border p-3">
      <p className="text-xs text-muted-foreground">
        No verified standalone workers. Create a stopped PocketHost-owned worker
        in Runit services, then return here for manual Health and Recovery.
      </p>
      <Button variant="outline" render={<Link to="/services/runit" />}>
        Create standalone worker
      </Button>
    </div>}
    {services?.map(service => <div key={service.name}
      className="flex flex-wrap items-center justify-between gap-2 border-b py-2">
      <span className="text-sm">{service.name}</span>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" disabled={busy !== null}
          onClick={() => void inspect(service)}>
          {busy === service.name ? "Inspecting…" : "Inspect health"}
        </Button>
        {(service.template === "heartbeat-worker-v1" || service.template === "python-heartbeat-v1") &&
          <Button variant="outline" disabled={busy !== null}
          onClick={() => void reviewRecovery(service)}>Review recovery</Button>}
      </div>
    </div>)}
    {recovery && <div className="space-y-2 rounded-md border p-3" aria-label="Reviewed recovery eligibility">
      <p className="text-sm font-medium">Recovery review: {recovery.name}</p>
      <div className="flex flex-wrap gap-2">
        <Badge variant="outline">Runit: {recovery.observed}</Badge>
        <Badge variant="outline">Recovery: {recovery.action === "start" ? "eligible" : "blocked"}</Badge>
        <Badge variant="outline">Attempts: {recovery.attempts}/{recovery.maxAttempts}</Badge>
      </div>
      <p className="text-xs text-muted-foreground">
        Reason: {recovery.reason}. Application readiness remains unverified.
        {recovery.nextEligibleAt && " Cooldown ends: " +
          new Date(recovery.nextEligibleAt).toLocaleString() + "."}
        {recovery.windowEndsAt && " Retry window ends: " +
          new Date(recovery.windowEndsAt).toLocaleString() + "."}
      </p>
      {recovery.action === "start" && <Button variant="outline"
        disabled={busy !== null}
        onClick={() => void recoverOnce()}>Request one recovery start</Button>}
    </div>}
    {readback && <div className="space-y-2 rounded-md border p-3" role="status">
      <p className="text-sm font-medium">{readback.name}</p>
      <div className="flex flex-wrap gap-2">
        <Badge variant="outline">Runit: {readback.observed}</Badge>
        <Badge variant="outline">Process: {readback.process.status === "observed"
          ? "PID " + readback.process.pid + " · " + readback.process.uptimeSeconds + "s"
          : readback.process.status}</Badge>
        <Badge variant="outline">App readiness: unverified</Badge>
        <Badge variant="outline">Worker heartbeat: {readback.heartbeat.mode === "disabled"
          ? "off" : readback.heartbeat.status}</Badge>
        <Badge variant="outline">Autostart: {readback.autostart === null
          ? "unknown" : readback.autostart ? "enabled" : "disabled"}</Badge>
      </div>
      {services?.some(service => service.name === readback.name &&
          (service.template === "heartbeat-worker-v1" || service.template === "python-heartbeat-v1")) &&
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Built-in worker heartbeat threshold (manual checks only). Fresh logs prove
            worker output, not HTTP readiness. No background monitor or restart.
          </p>
          <div className="flex flex-wrap gap-2" aria-label="Worker heartbeat policy">
            {(["disabled", "180", "300", "600"] as const).map(choice => <Button
              key={choice} variant={
                (choice === "disabled" && readback.heartbeat.mode === "disabled") ||
                (choice !== "disabled" && readback.heartbeat.staleAfterSeconds === Number(choice))
                  ? "secondary" : "outline"}
              disabled={busy !== null}
              onClick={() => void setHeartbeat(readback.name, choice)}>
              {choice === "disabled" ? "Off" : Number(choice) / 60 + " min"}
            </Button>)}
          </div>
          {readback.heartbeat.lastOutputAt && <p className="text-xs text-muted-foreground">
            Last matching heartbeat output: {new Date(readback.heartbeat.lastOutputAt).toLocaleString()}
          </p>}
        </div>}
      {services?.some(service => service.name === readback.name &&
          service.registered && !service.protected && service.template !== undefined) ?
        <div className="space-y-2 rounded-md border p-3" aria-label="Manual HTTP readiness">
        <p className="text-sm font-medium">Manual HTTP readiness · owned worker only</p>
        <p className="text-xs text-muted-foreground">
          The probe sends one GET to 127.0.0.1 only if the listener can be proven
          to belong to this worker's corroborated PID. It never follows redirects,
          supplies credentials, or stores a schedule. An unverified socket is never probed.
        </p>
        <div className="flex flex-wrap gap-2">
          <label className="text-xs">Local port (1024–65535)
            <input aria-label="Worker loopback port" type="number" min={1024} max={65535}
              value={httpPort} onChange={event => { setHttpPort(event.target.value); setHttpResult(null) }}
              className="mt-1 block w-32 rounded-md border bg-background p-2 text-sm"
              placeholder="3000" />
          </label>
          <label className="text-xs">Path (no query parameters)
            <input aria-label="Worker readiness path" type="text" maxLength={97}
              value={httpPath} onChange={event => { setHttpPath(event.target.value); setHttpResult(null) }}
              className="mt-1 block w-48 rounded-md border bg-background p-2 text-sm"
              placeholder="/health" />
          </label>
        </div>
        <Button variant="outline" disabled={busy !== null ||
          !/^[0-9]{4,5}$/.test(httpPort) ||
          Number(httpPort) < 1024 || Number(httpPort) > 65535 ||
          !/^\/(?:[a-zA-Z0-9._~-]|\/){0,96}$/.test(httpPath) ||
          httpPath.startsWith("//") || httpPath.includes("/../") ||
          httpPath.endsWith("/..")}
          onClick={() => void inspectHttp()}>
          {busy === "__http__" ? "Checking…" : "Check owned HTTP endpoint once"}
        </Button>
        {httpResult && <div role="status" className="space-y-1 text-xs">
          <p>HTTP readiness: {httpResult.status}
            {httpResult.httpStatus !== null ? " · HTTP " + httpResult.httpStatus : ""}
            {" · " + httpResult.reason}</p>
          <p>Observed: {new Date(httpResult.checkedAt).toLocaleString()}.
            Readiness is a point-in-time result only.</p>
        </div>}
        </div> :
        <p className="text-xs text-muted-foreground">
          HTTP readiness for delegated services is managed under Hosting.
          This manual probe is limited to attested standalone workers.
        </p>}
      {readback.process.status === "observed" &&
        <p className="text-xs text-muted-foreground">
          Proc start ticks: {readback.process.startTicks} · same-UID process,
          corroborated by runit and /proc. This does not attest application code or HTTP readiness.
        </p>}
      <p className="text-xs text-muted-foreground">
        Log write: {readback.logEvidence === "log-write" && readback.lastLogWriteAt
          ? new Date(readback.lastLogWriteAt).toLocaleString()
          : readback.logEvidence === "untrusted" ? "untrusted path" : "no recent evidence available"}
      </p>
      <p className="text-xs text-muted-foreground">
        Observed: {new Date(readback.checkedAt).toLocaleString()}.
        A running supervisor is not proof of a healthy application.
      </p>
    </div>}
  </section>
}
