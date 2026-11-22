import * as React from "react"
import {
  api, parseCandidates,
  type Candidate, type RuntimeState, type RuntimePlan,
} from "./node-project-client"

type ReadJson = (url: string) => Promise<Record<string, unknown>>

/** Read-only Node project inspection, scoped to the current selection generation. */
export function useNodeProjectInspection(getJson: ReadJson, resetRuntimeReviews: () => void) {
  const [releases, setReleases] = React.useState<Candidate[]>([])
  const [releasesLoading, setReleasesLoading] = React.useState(false)
  const [releasesChecked, setReleasesChecked] = React.useState(false)
  const [releasesError, setReleasesError] = React.useState(false)
  const [runtime, setRuntime] = React.useState<RuntimeState | null>(null)
  const [plan, setPlan] = React.useState<RuntimePlan | null>(null)
  const [executionEnabled, setExecutionEnabled] = React.useState(false)
  const generation = React.useRef(0)
  const releaseSequence = React.useRef(0)
  const runtimeSequence = React.useRef(0)

  const beginInspection = React.useCallback(() => {
    generation.current += 1
    releaseSequence.current += 1
    runtimeSequence.current += 1
    setReleases([])
    setReleasesLoading(false)
    setReleasesChecked(false)
    setReleasesError(false)
    setRuntime(null)
    setPlan(null)
    setExecutionEnabled(false)
    resetRuntimeReviews()
  }, [resetRuntimeReviews])

  React.useEffect(() => () => { generation.current += 1 }, [])

  const loadReleases = React.useCallback(async (id: string): Promise<void> => {
    const selectedGeneration = generation.current
    const request = ++releaseSequence.current
    const current = () =>
      generation.current === selectedGeneration && releaseSequence.current === request
    setReleases([])
    setReleasesLoading(true)
    setReleasesChecked(false)
    setReleasesError(false)
    try {
      const data = await getJson(api + "/" + id + "/releases")
      if (!current()) return
      const received = parseCandidates(data.releases)
      setReleases(received)
      setReleasesChecked(true)
    } catch (cause) {
      if (current()) {
        setReleasesError(true)
        throw cause
      }
    } finally {
      if (current()) setReleasesLoading(false)
    }
  }, [getJson])

  const loadRuntime = React.useCallback(async (id: string): Promise<RuntimeState | null> => {
    const selectedGeneration = generation.current
    const request = ++runtimeSequence.current
    const current = () =>
      generation.current === selectedGeneration && runtimeSequence.current === request
    // A fresh review invalidates the previous runtime/plan immediately.
    // Failed or invalid readback must never leave a stale publish gate enabled.
    setRuntime(null)
    setPlan(null)
    setExecutionEnabled(false)
    resetRuntimeReviews()
    let status: Record<string, unknown>
    let preview: Record<string, unknown>
    try {
      const data = await Promise.all([
        getJson(api + "/" + id + "/runtime"),
        getJson(api + "/" + id + "/plan"),
      ])
      status = data[0]
      preview = data[1]
    } catch (cause) {
      if (current()) throw cause
      return null
    }
    if (!current()) return null
    if (!status.runtime || typeof status.runtime !== "object" ||
        Array.isArray(status.runtime) || !preview.plan ||
        typeof preview.plan !== "object" || Array.isArray(preview.plan))
      throw new Error("Invalid Node runtime report")
    const reviewedPlan = preview.plan as Record<string, unknown>
    // Browser permissions must be literal booleans, not truthy strings or objects.
    // Older read-only reports may omit "allowed"; those are never actionable.
    if ((reviewedPlan.allowed !== undefined && typeof reviewedPlan.allowed !== "boolean") ||
        (reviewedPlan.release !== undefined && reviewedPlan.release !== null &&
         (typeof reviewedPlan.release !== "string" ||
          !/^r-[a-f0-9]{32}$/.test(reviewedPlan.release))) ||
        (reviewedPlan.missingTools !== undefined &&
         (!Array.isArray(reviewedPlan.missingTools) ||
          !reviewedPlan.missingTools.every(item => typeof item === "string"))) ||
        (reviewedPlan.conflicts !== undefined &&
         (!Array.isArray(reviewedPlan.conflicts) ||
          !reviewedPlan.conflicts.every(item => typeof item === "string"))))
      throw new Error("Invalid Node runtime plan")
    const observed = status.runtime as RuntimeState
    if (!["not-provisioned", "stopped", "running", "unknown"].includes(observed.state) ||
        !["stopped", "running"].includes(observed.desired) ||
        (observed.activeRelease !== null &&
         (typeof observed.activeRelease !== "string" ||
          !/^r-[a-f0-9]{32}$/.test(observed.activeRelease))))
      throw new Error("Invalid Node runtime state")
    setRuntime(observed)
    setPlan({ ...reviewedPlan, allowed: reviewedPlan.allowed === true } as RuntimePlan)
    setExecutionEnabled(status.executionEnabled === true && preview.executionEnabled === true)
    return observed
  }, [getJson, resetRuntimeReviews])

  return {
    releases, releasesLoading, releasesChecked, releasesError,
    runtime, setRuntime, plan, setPlan,
    executionEnabled, setExecutionEnabled, beginInspection, loadReleases, loadRuntime,
  }
}
