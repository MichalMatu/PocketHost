import {
  getJson, postJson, validProcess, type HeartbeatPolicy,
  type VerifiedService, type RecoveryReview, type RunitHealth,
  type HttpReadinessResult,
} from "./runit-health-contract"

type RecoveryContext = {
  services: VerifiedService[] | null
  busy: string | null
  recovery: RecoveryReview | null
  setBusy: (value: string | null) => void
  setError: (value: string | null) => void
  setNotice: (value: string | null) => void
  setReadback: (value: RunitHealth | null) => void
  setRecovery: (value: RecoveryReview | null) => void
  setHttpResult: (value: HttpReadinessResult | null) => void
}

/** Manual policy changes and recovery keep their original exact readback gates. */
export function createRunitHealthRecovery({
  services, busy, recovery, setBusy, setError, setNotice,
  setReadback, setRecovery, setHttpResult,
}: RecoveryContext) {
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
      // Compare the receipt to the user's requested policy, not merely to
      // another potentially matching (but wrong) server observation.
      const expectedSeconds = choice === "disabled" ? null : Number(choice)
      const expectedMode = choice === "disabled" ? "disabled" : "log-heartbeat"
      if (!result || typeof result.changed !== "boolean" || !result.heartbeat ||
          result.heartbeat.mode !== expectedMode ||
          result.heartbeat.staleAfterSeconds !== expectedSeconds ||
          !["disabled", "fresh", "stale", "missing", "unknown"].includes(
            result.heartbeat.status) ||
          (expectedMode === "disabled" && result.heartbeat.status !== "disabled"))
        throw new Error("Heartbeat policy command receipt differs from requested choice")
      const current = await getJson<RunitHealth>(
        "?mode=service-health&name=" + encodeURIComponent(name))
      if (!current || current.name !== name || current.identity !== "verified" ||
          current.readiness !== "not-verified" ||
          !["running", "stopped", "unknown"].includes(current.observed) ||
          !validProcess(current.process, current.observed) ||
          current.heartbeat?.mode !== expectedMode ||
          current.heartbeat.staleAfterSeconds !== expectedSeconds ||
          !["disabled", "fresh", "stale", "missing", "unknown"].includes(
            current.heartbeat.status) ||
          (expectedMode === "disabled" && current.heartbeat.status !== "disabled") ||
          !Number.isFinite(Date.parse(current.checkedAt)))
        throw new Error("Heartbeat policy readback differs from requested choice")
      setReadback(current)
      setNotice(name + (result.changed
        ? ": worker heartbeat policy saved and verified."
        : ": worker heartbeat policy already set and verified."))
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
      if (!before || before.name !== serviceName ||
          before.template !== recovery.template ||
          before.action !== "start" || before.observed !== "stopped" ||
          !Number.isSafeInteger(before.attempts) ||
          before.attempts !== recovery.attempts ||
          before.maxAttempts !== 2 || before.attempts >= before.maxAttempts ||
          !Number.isFinite(Date.parse(before.checkedAt)))
        throw new Error("Recovery review changed")
      const outcome = await postJson<{
        requested: true
        result: { exit: number; output: string }
        review: RecoveryReview
      }>({ action: "service-recover", name: "once", path: serviceName })
      // The budget is consumed before sv up. Both its exact increment and
      // the successful command receipt must be proven; neither alone suffices.
      if (!outcome || outcome.requested !== true ||
          outcome.result?.exit !== 0 ||
          typeof outcome.result.output !== "string" ||
          outcome.result.output.length > 12000 ||
          outcome.review?.name !== serviceName ||
          outcome.review.template !== before.template ||
          outcome.review.attempts !== before.attempts + 1 ||
          outcome.review.maxAttempts !== before.maxAttempts ||
          !Number.isFinite(Date.parse(outcome.review.checkedAt)))
        throw new Error("Unconfirmed recovery command receipt")
      const after = await getJson<RecoveryReview>(
        "?mode=service-recovery&name=" + encodeURIComponent(serviceName))
      if (!after || after.name !== serviceName ||
          after.template !== before.template ||
          after.readiness !== "not-verified" ||
          !["running", "stopped", "unknown"].includes(after.observed) ||
          !["start", "none", "blocked"].includes(after.action) ||
          !Number.isSafeInteger(after.attempts) ||
          after.attempts !== before.attempts + 1 ||
          after.maxAttempts !== before.maxAttempts ||
          !Number.isFinite(Date.parse(after.checkedAt)))
        throw new Error("Recovery budget readback unconfirmed")
      // One on-demand observation after the command. Never poll or infer
      // application readiness from a runit process.
      const observed = await getJson<RunitHealth>(
        "?mode=service-health&name=" + encodeURIComponent(serviceName))
      if (!observed || observed.name !== serviceName ||
          observed.identity !== "verified" ||
          observed.readiness !== "not-verified" ||
          !["running", "stopped", "unknown"].includes(observed.observed) ||
          !validProcess(observed.process, observed.observed) ||
          !Number.isFinite(Date.parse(observed.checkedAt)))
        throw new Error("Recovery state readback untrusted")
      setRecovery(after)
      setReadback(observed)
      setNotice(serviceName + ": one recovery attempt recorded and independently verified; runit " +
        observed.observed + ". Application readiness unverified.")
    } catch {
      setRecovery(null)
      setReadback(null)
      setError("Recovery refused or readback unconfirmed. Attempt budget may have been consumed. Inspect before retrying.")
    } finally {
      setBusy(null)
    }
  }
  return { setHeartbeat, reviewRecovery, recoverOnce }
}
