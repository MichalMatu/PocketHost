export type VerifiedService = {
  name: string
  registered: boolean
  protected: boolean
  control: "standalone" | "delegated" | "read-only"
  identity: "verified" | "unregistered" | "legacy" | "changed" | "archive-conflict" | "reserved"
  identityReason: string
  template?: "heartbeat-worker-v1" | "python-heartbeat-v1" | "python-source-v1" | "node-source-v1"
}
export type RecoveryReview = {
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
export type HeartbeatPolicy = {
  mode: "disabled" | "log-heartbeat"
  staleAfterSeconds: 180 | 300 | 600 | null
  status: "disabled" | "fresh" | "stale" | "missing" | "unknown"
  lastOutputAt: string | null
}
export type HealthOverviewRow =
  | { name: string; template: VerifiedService["template"]; status: "observed"; health: RunitHealth }
  | { name: string; template: VerifiedService["template"]; status: "unavailable" }

export type HealthOverview = {
  checkedAt: string
  blockedRegistrations: number
  truncated: boolean
  rows: HealthOverviewRow[]
}

export type RunitProcess = {
  status: "observed" | "stopped" | "unverified"
  pid: number | null
  uptimeSeconds: number | null
  startTicks: string | null
}

export type HttpReadinessResult = {
  name: string
  status: "ready" | "not-ready" | "unverified"
  httpStatus: number | null
  reason: "http-2xx" | "http-other" | "process-unverified" |
    "socket-owner-unverified" | "transport-unverified" | "worker-changed"
  checkedAt: string
}

export type RunitHealth = {
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
export const serviceName = /^[a-z][a-z0-9-]{1,63}$/

export function validProcess(value: RunitProcess | undefined, observed: RunitHealth["observed"]): boolean {
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

export async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(base + path, {
    credentials: "same-origin", cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  })
  if (!response.ok) throw new Error("Termux observation unavailable")
  return await response.json() as T
}

export async function postJson<T>(payload:
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

export const needsAttention = (health: RunitHealth): boolean =>
  health.observed === "unknown" ||
  (health.observed === "running" && health.process.status !== "observed") ||
  (health.autostart === true && health.observed === "stopped") ||
  health.logEvidence === "untrusted" ||
  (health.heartbeat.mode === "log-heartbeat" &&
    ["stale", "missing", "unknown"].includes(health.heartbeat.status))
