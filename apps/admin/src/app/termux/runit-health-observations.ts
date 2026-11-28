import {
  getJson, validProcess, serviceName, type HealthOverview,
  type VerifiedService, type RecoveryReview, type RunitHealth,
  type HttpReadinessResult,
} from "./runit-health-contract"

type ObservationContext = {
  services: VerifiedService[] | null
  busy: string | null
  setBusy: (value: string | null) => void
  setError: (value: string | null) => void
  setNotice: (value: string | null) => void
  setOverview: (value: HealthOverview | null) => void
  setReadback: (value: RunitHealth | null) => void
  setRecovery: (value: RecoveryReview | null) => void
  httpPort: string
  httpPath: string
  setHttpResult: (value: HttpReadinessResult | null) => void
}

/** Read-only observations preserve the original inventory and response checks. */
export function createRunitHealthObservations({
  services, busy, setBusy, setError, setNotice, setOverview,
  setReadback, setRecovery, httpPort, httpPath, setHttpResult,
}: ObservationContext) {
  const refreshOverview = async () => {
    if (busy !== null || services === null) return
    setBusy("__overview__")
    setError(null)
    setNotice(null)
    setOverview(null)
    try {
      const result = await getJson<HealthOverview>("?mode=service-health-overview")
      // A snapshot cannot confer Health ownership by itself. Match every
      // observed worker to the separately attested current inventory.
      const seen = new Set<string>()
      if (!result || !Array.isArray(result.rows) || result.rows.length > 4 ||
          !result.rows.every(row => {
            const registered = services.find(item => item.name === row.name)
            if (!registered || registered.template !== row.template ||
                seen.has(row.name)) return false
            seen.add(row.name)
            return true
          }) ||
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

  const inspect = async (service: VerifiedService) => {
    if (busy || !service.registered || service.protected ||
        service.control !== "standalone" ||
        service.identity !== "verified" ||
        service.identityReason !== "run-sha-attested" ||
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
  return { refreshOverview, inspect, inspectHttp }
}
