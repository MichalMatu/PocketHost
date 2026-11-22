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
    try {
      const data = await getJson(api + "/" + id + "/releases")
      if (!current()) return
      setReleases(parseCandidates(data.releases))
    } catch (cause) {
      if (current()) throw cause
    } finally {
      if (current()) setReleasesLoading(false)
    }
  }, [getJson])

  const loadRuntime = React.useCallback(async (id: string): Promise<RuntimeState | null> => {
    const selectedGeneration = generation.current
    const request = ++runtimeSequence.current
    const current = () =>
      generation.current === selectedGeneration && runtimeSequence.current === request
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
        Array.isArray(status.runtime) || !preview.plan)
      throw new Error("Invalid Node runtime report")
    const observed = status.runtime as RuntimeState
    if (!["not-provisioned", "stopped", "running", "unknown"].includes(observed.state) ||
        !["stopped", "running"].includes(observed.desired) ||
        (observed.activeRelease !== null &&
         (typeof observed.activeRelease !== "string" ||
          !/^r-[a-f0-9]{32}$/.test(observed.activeRelease))))
      throw new Error("Invalid Node runtime state")
    setRuntime(observed)
    resetRuntimeReviews()
    setPlan(preview.plan as RuntimePlan)
    setExecutionEnabled(status.executionEnabled === true && preview.executionEnabled === true)
    return observed
  }, [getJson, resetRuntimeReviews])

  return {
    releases, releasesLoading, runtime, setRuntime, plan, setPlan,
    executionEnabled, setExecutionEnabled, beginInspection, loadReleases, loadRuntime,
  }
}
