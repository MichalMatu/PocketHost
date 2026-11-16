import * as React from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

type VerifiedService = {
  name: string
  registered: boolean
  protected: boolean
  template?: "heartbeat-worker-v1" | "python-heartbeat-v1" | "python-source-v1" | "node-source-v1"
}
type RecoveryReview = {
  name: string
  template: "heartbeat-worker-v1" | "python-heartbeat-v1"
  observed: "running" | "stopped" | "unknown"
  readiness: "not-verified"
  action: "start" | "none" | "blocked"
  reason: string
  attempts: number
  maxAttempts: number
  nextEligibleAt: string | null
  windowEndsAt: string | null
  checkedAt: string
}
type HeartbeatPolicy = {
  mode: "disabled" | "log-heartbeat"
  staleAfterSeconds: 180 | 300 | 600 | null
  status: "disabled" | "fresh" | "stale" | "missing" | "unknown"
  lastOutputAt: string | null
}
type HealthOverviewRow =
  | { name: string; template: VerifiedService["template"]; status: "observed"; health: RunitHealth }
  | { name: string; template: VerifiedService["template"]; status: "unavailable" }

type HealthOverview = {
  checkedAt: string
  blockedRegistrations: number
  truncated: boolean
  rows: HealthOverviewRow[]
}

type RunitProcess = {
  status: "observed" | "stopped" | "unverified"
  pid: number | null
  uptimeSeconds: number | null
  startTicks: string | null
}

type HttpReadinessResult = {
  name: string
  status: "ready" | "not-ready" | "unverified"
  httpStatus: number | null
  reason: "http-2xx" | "http-other" | "process-unverified" |
    "socket-owner-unverified" | "transport-unverified" | "worker-changed"
  checkedAt: string
}

type RunitHealth = {
  name: string
  identity: "verified"
  observed: "running" | "stopped" | "unknown"
  readiness: "not-verified"
  process: RunitProcess
  heartbeat: HeartbeatPolicy
  autostart: boolean | null
  logEvidence: "log-write" | "no-log" | "untrusted"
  lastLogWriteAt: string | null
  checkedAt: string
}

const base = "/api/v1/termux-admin"
const serviceName = /^[a-z][a-z0-9-]{1,63}$/

function validProcess(value: RunitProcess | undefined, observed: RunitHealth["observed"]): boolean {
  if (!value || !["observed", "stopped", "unverified"].includes(value.status)) return false
  if (value.status === "observed") {
    return observed === "running" && Number.isSafeInteger(value.pid) &&
      value.pid! > 1 && Number.isSafeInteger(value.uptimeSeconds) &&
      value.uptimeSeconds! >= 0 && typeof value.startTicks === "string" &&
      /^[0-9]{1,24}$/.test(value.startTicks) && !/^0+$/.test(value.startTicks)
  }
  return value.pid === null && value.uptimeSeconds === null &&
    value.startTicks === null &&
    (value.status === "stopped" ? observed === "stopped" : observed !== "stopped")
}

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(base + path, {
    credentials: "same-origin", cache: "no-store",
  })
  if (!response.ok) throw new Error("Termux observation unavailable")
  return await response.json() as T
}

async function postJson<T>(payload:
  | { action: "service-recover"; name: "once"; path: string }
  | { action: "service-heartbeat"; name: "disabled" | "180" | "300" | "600"; path: string }
): Promise<T> {
  const response = await fetch(base, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-PocketHost-Intent": "termux-admin",
    },
    credentials: "same-origin",
    body: JSON.stringify(payload),
  })
  if (!response.ok) throw new Error("Recovery command refused")
  return await response.json() as T
}

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
    const result = await getJson<{ services: VerifiedService[] }>("?mode=services")
    if (!Array.isArray(result.services) || result.services.length > 100 ||
        !result.services.every(service =>
          serviceName.test(service.name) &&
          typeof service.registered === "boolean" &&
          typeof service.protected === "boolean" &&
          (service.template === undefined ||
            service.template === "heartbeat-worker-v1" ||
            service.template === "python-heartbeat-v1" ||
            service.template === "python-source-v1" ||
            service.template === "node-source-v1"))) {
      throw new Error("Invalid service inventory")
    }
    setServices(result.services.filter(service =>
      service.registered && !service.protected))
    setOverview(null)
    setHttpResult(null)
    setReadback(null)
    setRecovery(null)
    setNotice(null)
    setError(null)
  }, [])

  React.useEffect(() => {
    void refresh().catch(() => setError("Service inventory unavailable"))
  }, [refresh])

  const refreshOverview = async () => {
    if (busy !== null) return
    setBusy("__overview__")
    setError(null)
    setNotice(null)
    setOverview(null)
    try {
      const result = await getJson<HealthOverview>("?mode=service-health-overview")
      if (!result || !Array.isArray(result.rows) || result.rows.length > 4 ||
          !Number.isSafeInteger(result.blockedRegistrations) ||
          result.blockedRegistrations < 0 || result.blockedRegistrations > 32 ||
          typeof result.truncated !== "boolean" ||
          !Number.isFinite(Date.parse(result.checkedAt)) ||
          !result.rows.every(row =>
            serviceName.test(row.name) &&
            ["heartbeat-worker-v1", "python-heartbeat-v1", "python-source-v1",
             "node-source-v1"].includes(row.template ?? "") &&
            (row.status === "unavailable" ||
              (row.status === "observed" && row.health &&
               row.health.name === row.name && row.health.identity === "verified" &&
               row.health.readiness === "not-verified" &&
               ["running", "stopped", "unknown"].includes(row.health.observed) &&
               validProcess(row.health.process, row.health.observed) &&
               ["log-write", "no-log", "untrusted"].includes(row.health.logEvidence) &&
               ["disabled", "log-heartbeat"].includes(row.health.heartbeat?.mode) &&
               ["disabled", "fresh", "stale", "missing", "unknown"].includes(
                 row.health.heartbeat?.status) &&
               (row.health.autostart === null || typeof row.health.autostart === "boolean") &&
               Number.isFinite(Date.parse(row.health.checkedAt))))))
        throw new Error("Untrusted health overview")
      setOverview(result)
    } catch {
      setError("Worker health overview unavailable or changed during observation. No repair was attempted.")
    } finally {
      setBusy(null)
    }
  }

  const needsAttention = (health: RunitHealth): boolean =>
    health.observed === "unknown" ||
    (health.observed === "running" && health.process.status !== "observed") ||
    (health.autostart === true && health.observed === "stopped") ||
    health.logEvidence === "untrusted" ||
    (health.heartbeat.mode === "log-heartbeat" &&
      ["stale", "missing", "unknown"].includes(health.heartbeat.status))

  const inspect = async (service: VerifiedService) => {
    if (busy || !service.registered || service.protected ||
        !serviceName.test(service.name)) return
    setBusy(service.name)
    setError(null)
    setReadback(null)
    setHttpResult(null)
    setRecovery(null)
    setNotice(null)
    try {
      const result = await getJson<RunitHealth>(
        "?mode=service-health&name=" + encodeURIComponent(service.name))
      if (!result || result.name !== service.name ||
          result.identity !== "verified" ||
          !["running", "stopped", "unknown"].includes(result.observed) ||
          result.readiness !== "not-verified" ||
          !validProcess(result.process, result.observed) ||
          !result.heartbeat ||
          !["disabled", "log-heartbeat"].includes(result.heartbeat.mode) ||
          !["disabled", "fresh", "stale", "missing", "unknown"].includes(result.heartbeat.status) ||
          (result.heartbeat.mode === "disabled"
            ? result.heartbeat.staleAfterSeconds !== null
            : ![180, 300, 600].includes(result.heartbeat.staleAfterSeconds as number)) ||
          (result.heartbeat.lastOutputAt !== null &&
            (typeof result.heartbeat.lastOutputAt !== "string" ||
              !Number.isFinite(Date.parse(result.heartbeat.lastOutputAt)))) ||
          (result.autostart !== null && typeof result.autostart !== "boolean") ||
          !["log-write", "no-log", "untrusted"].includes(result.logEvidence) ||
          (result.lastLogWriteAt !== null &&
            (typeof result.lastLogWriteAt !== "string" ||
              !Number.isFinite(Date.parse(result.lastLogWriteAt)))) ||
          !Number.isFinite(Date.parse(result.checkedAt))) {
        throw new Error("Untrusted service health response")
      }
      setReadback(result)
    } catch {
      setError("Health observation refused or unavailable; do not infer readiness.")
    } finally {
      setBusy(null)
    }
  }

  const inspectHttp = async () => {
    if (!readback || busy !== null || !services?.some(service =>
      service.name === readback.name && service.registered && !service.protected &&
      service.template !== undefined) ||
      !/^[0-9]{4,5}$/.test(httpPort) || Number(httpPort) < 1024 ||
      Number(httpPort) > 65535 ||
      !/^\/(?:[a-zA-Z0-9._~-]|\/){0,96}$/.test(httpPath) ||
      httpPath.startsWith("//") || httpPath.includes("/../") ||
      httpPath.endsWith("/..")) return
    const targetName = readback.name
    setBusy("__http__")
    setHttpResult(null)
    setError(null)
    try {
      const result = await getJson<HttpReadinessResult>(
        "?mode=service-http-readiness&name=" + encodeURIComponent(targetName) +
        "&port=" + encodeURIComponent(httpPort) +
        "&path=" + encodeURIComponent(httpPath))
      if (!result || result.name !== targetName ||
          !["ready", "not-ready", "unverified"].includes(result.status) ||
          !["http-2xx", "http-other", "process-unverified", "socket-owner-unverified",
            "transport-unverified", "worker-changed"].includes(result.reason) ||
          (result.status === "unverified" ? result.httpStatus !== null :
            !Number.isSafeInteger(result.httpStatus) ||
            result.httpStatus! < 100 || result.httpStatus! > 599 ||
            (result.status === "ready") !==
              (result.httpStatus! >= 200 && result.httpStatus! <= 299)) ||
          !Number.isFinite(Date.parse(result.checkedAt)))
        throw new Error("Untrusted HTTP readiness response")
      setHttpResult(result)
    } catch {
      setError("HTTP readiness refused or unverified. No conclusion about application health.")
    } finally {
      setBusy(null)
    }
  }

  const setHeartbeat = async (name: string, choice: "disabled" | "180" | "300" | "600") => {
    if (busy || !services?.some(item => item.name === name &&
        (item.template === "heartbeat-worker-v1" || item.template === "python-heartbeat-v1") &&
        item.registered && !item.protected)) return
    setBusy(name)
    setError(null)
    setNotice(null)
    setHttpResult(null)
    try {
      const result = await postJson<{ changed: boolean; heartbeat: HeartbeatPolicy }>({
        action: "service-heartbeat", name: choice, path: name,
      })
      if (!result || !result.heartbeat ||
          !["disabled", "log-heartbeat"].includes(result.heartbeat.mode))
        throw new Error("Heartbeat policy confirmation missing")
      const current = await getJson<RunitHealth>(
        "?mode=service-health&name=" + encodeURIComponent(name))
      if (current.name !== name || current.identity !== "verified" ||
          current.readiness !== "not-verified" ||
          current.heartbeat?.mode !== result.heartbeat.mode ||
          current.heartbeat.staleAfterSeconds !== result.heartbeat.staleAfterSeconds)
        throw new Error("Heartbeat policy readback mismatch")
      setReadback(current)
      setNotice(name + ": worker heartbeat policy saved and confirmed.")
    } catch {
      setError("Heartbeat policy refused or readback unconfirmed. Refresh before another change.")
      setReadback(null)
    } finally {
      setBusy(null)
    }
  }

  const reviewRecovery = async (service: VerifiedService) => {
    if (busy || (service.template !== "heartbeat-worker-v1" &&
        service.template !== "python-heartbeat-v1") ||
        !service.registered || service.protected) return
    setBusy(service.name)
    setError(null)
    setRecovery(null)
    setReadback(null)
    setNotice(null)
    try {
      const result = await getJson<RecoveryReview>(
        "?mode=service-recovery&name=" + encodeURIComponent(service.name))
      if (!result || result.name !== service.name || result.template !== service.template ||
          !["running", "stopped", "unknown"].includes(result.observed) ||
          result.readiness !== "not-verified" ||
          !["start", "none", "blocked"].includes(result.action) ||
          typeof result.reason !== "string" || result.reason.length > 120 ||
          !Number.isInteger(result.attempts) || result.attempts < 0 ||
          result.maxAttempts !== 2 || result.attempts > result.maxAttempts ||
          (result.nextEligibleAt !== null &&
            (typeof result.nextEligibleAt !== "string" ||
              !Number.isFinite(Date.parse(result.nextEligibleAt)))) ||
          (result.windowEndsAt !== null &&
            (typeof result.windowEndsAt !== "string" ||
              !Number.isFinite(Date.parse(result.windowEndsAt)))) ||
          !Number.isFinite(Date.parse(result.checkedAt)))
        throw new Error("Invalid recovery review")
      setRecovery(result)
    } catch {
      setError("Recovery eligibility unavailable or refused; no command was issued.")
    } finally {
      setBusy(null)
    }
  }

  const recoverOnce = async () => {
    if (!recovery || busy || recovery.action !== "start" ||
        recovery.observed !== "stopped" ||
        !services?.some(item => item.name === recovery.name && item.registered &&
          !item.protected && item.template === recovery.template) ||
        !window.confirm("Request one bounded recovery start for " + recovery.name +
          "? This changes only the attested builtin runit worker. " +
          "It does not verify application readiness and consumes one attempt even if it fails.")) return
    const serviceName = recovery.name
    setBusy(serviceName)
    setNotice(null)
    setError(null)
    setHttpResult(null)
    try {
      // A saved browser review is not permission to act on a later state.
      // The server independently re-attests ownership and the retry budget.
      const before = await getJson<RecoveryReview>(
        "?mode=service-recovery&name=" + encodeURIComponent(serviceName))
      if (before.name !== serviceName || before.template !== recovery.template ||
          before.action !== "start" || before.observed !== "stopped" ||
          before.attempts !== recovery.attempts || before.maxAttempts !== recovery.maxAttempts)
        throw new Error("Recovery review changed")
      const outcome = await postJson<{
        requested: true
        review: RecoveryReview
      }>({ action: "service-recover", name: "once", path: serviceName })
      if (outcome.requested !== true || outcome.review?.name !== serviceName ||
          outcome.review.template !== recovery.template ||
          outcome.review.attempts <= before.attempts)
        throw new Error("Unconfirmed recovery receipt")
      setRecovery(outcome.review)
      // One on-demand observation after the command. Never poll or infer
      // application readiness from a runit process.
      const observed = await getJson<RunitHealth>(
        "?mode=service-health&name=" + encodeURIComponent(serviceName))
      if (observed.name !== serviceName || observed.identity !== "verified" ||
          observed.readiness !== "not-verified" ||
          !["running", "stopped", "unknown"].includes(observed.observed))
        throw new Error("Recovery state readback untrusted")
      setReadback(observed)
      setNotice(serviceName + ": one recovery attempt recorded; runit " +
        observed.observed + ". Application readiness unverified.")
    } catch {
      setRecovery(null)
      setReadback(null)
      setError("Recovery refused or readback unconfirmed. Attempt budget may have been consumed. Inspect before retrying.")
    } finally {
      setBusy(null)
    }
  }

  return <section className="space-y-3 rounded-md border p-3" aria-label="Runit health observations">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className="text-sm font-medium">Runit process observations</h3>
      <Button size="sm" variant="outline" disabled={busy !== null}
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
        <Button size="sm" variant="outline" disabled={busy !== null}
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
          {row.status === "observed" && <Button size="sm" variant="outline"
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
    {services?.length === 0 && <p className="text-xs text-muted-foreground">
      No verified runit services to inspect. Add a PocketHost-owned service under Runit services.
    </p>}
    {services?.map(service => <div key={service.name}
      className="flex flex-wrap items-center justify-between gap-2 border-b py-2">
      <span className="text-sm">{service.name}</span>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" disabled={busy !== null}
          onClick={() => void inspect(service)}>
          {busy === service.name ? "Inspecting…" : "Inspect health"}
        </Button>
        {(service.template === "heartbeat-worker-v1" || service.template === "python-heartbeat-v1") &&
          <Button size="sm" variant="outline" disabled={busy !== null}
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
      {recovery.action === "start" && <Button size="sm" variant="outline"
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
              key={choice} size="sm" variant={
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
        <Button size="sm" variant="outline" disabled={busy !== null ||
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
