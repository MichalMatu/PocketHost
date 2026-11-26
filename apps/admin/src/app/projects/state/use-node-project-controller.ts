import * as React from "react"
import { useSearchParams } from "react-router-dom"
import { useNodeProjectInspection } from "../use-node-project-inspection"
import { useNodeProjectLogs } from "../use-node-project-logs"
import { useNodeHostDiagnostics } from "../use-node-host-diagnostics"
import { useNodeProjectScopedRead } from "../use-node-project-scoped-read"
import { api, disabledMessage, examplePackage, exampleLock, exampleSource, parseProjectCatalog, requestJson,
  type Project, type NodeHealth, type DependencyReview, type BuildReview, type RollbackPreflight } from "../node-project-client"

/** Shared owner session, selection, mutation serialization and verified inspection. */
export function useNodeProjectController(routeProject?: string | null) {
  const [searchParams, setSearchParams] = useSearchParams()
  const lanView = typeof window !== "undefined" && !["localhost", "127.0.0.1"].includes(window.location.hostname)
  const tokenRef = React.useRef("")
  const [token, setToken] = React.useState("")
  const [tokenAuthorized, setOwnerAuthorized] = React.useState(false)
  const [accessMode, setAccessMode] = React.useState<"protected" | "trusted-lan">("protected")
  const ownerAuthorized = accessMode === "trusted-lan" || tokenAuthorized
  const [ownerConfigured, setOwnerConfigured] = React.useState<boolean | null>(null)
  const getJson = React.useCallback((url: string, method?: "POST", body?: unknown) =>
    requestJson(url, method, body, tokenRef.current), [])
  const requestedProject = routeProject === undefined ? searchParams.get("project") : routeProject
  const appliedDeepLink = React.useRef<string | null>(null)
  const [projects, setProjects] = React.useState<Project[]>([])
  // Out-of-order catalog reads must not replace a newer verified inventory.
  const catalogRequest = React.useRef(0)
  const verifiedCatalog = React.useRef<Project[]>([])
  React.useEffect(() => () => { catalogRequest.current += 1 }, [])
  const [catalogState, setCatalogState] = React.useState<"loading" | "ready" | "disabled" | "error">("loading")
  const [selectedId, setSelectedId] = React.useState("")
  // A stable refresh callback needs the actual selection, not the mount-time value.
  const selectedIdRef = React.useRef(selectedId)
  React.useEffect(() => { selectedIdRef.current = selectedId }, [selectedId])
  const [name, setName] = React.useState("")
  const [createPhase, setCreatePhase] = React.useState<"idle" | "pending" | "confirmed" | "rejected" | "unknown">("idle")
  const creatingRef = React.useRef(false)
  const [manifest, setManifest] = React.useState(examplePackage)
  const [lockfile, setLockfile] = React.useState(exampleLock)
  const [source, setSource] = React.useState(exampleSource)
  const [sourceOrigin, setSourceOrigin] = React.useState<"example" | "github" | "local" | "staged" | "edited">("example")
  const [extraFiles, setExtraFiles] = React.useState<Record<string, string>>({})
  const [assetFiles, setAssetFiles] = React.useState<Record<string, string>>({})
  const [githubRepository, setGithubRepository] = React.useState("")
  const [githubReview, setGithubReview] = React.useState<{
    repository: string; commit: string; changed: string[]
    dependencies: number; buildRequired: boolean; extraCount: number; assetCount: number
  } | null>(null)
  const [editorDirty, setEditorDirty] = React.useState(false)
  const [approved, setApproved] = React.useState(false)
  const [preview, setPreview] = React.useState<{ release: string; body: string } | null>(null)
  const [health, setHealth] = React.useState<NodeHealth | null>(null)
  const [dependencyReview, setDependencyReview] = React.useState<DependencyReview | null>(null)
  const [dependencyInstallEnabled, setDependencyInstallEnabled] = React.useState(false)
  const [dependencyApproved, setDependencyApproved] = React.useState(false)
  const [buildReview, setBuildReview] = React.useState<BuildReview | null>(null)
  const [buildEnabled, setBuildEnabled] = React.useState(false)
  const [buildApproved, setBuildApproved] = React.useState(false)
  const [rollbackPreflight, setRollbackPreflight] = React.useState<RollbackPreflight | null>(null)
  const [buildCheck, setBuildCheck] = React.useState<{
    release: string; status: "syntax-valid" | "syntax-invalid"; executed: false
  } | null>(null)
  const [busy, setBusy] = React.useState(false)
  // This gate closes the pre-render window before React disables action buttons.
  const actionInFlight = React.useRef(false)
  const [error, setError] = React.useState<string | null>(null)
  const [message, setMessage] = React.useState<string | null>(null)
  const {
    nodeTools, registries, toolchainStatus, registryStatus, toolchainError, registryError,
    checkTools, inspectRegistries, resetDiagnostics,
  } = useNodeHostDiagnostics(getJson)
  const { invalidateRead, readScoped } = useNodeProjectScopedRead(getJson)
  const { logLines, logsLoading, logsError, logsChecked, resetLogs, loadLogs } = useNodeProjectLogs(getJson)
  const resetRuntimeReviews = React.useCallback(() => {
    setHealth(null)
    setDependencyReview(null)
    setDependencyApproved(false)
    setDependencyInstallEnabled(false)
    setBuildReview(null)
    setBuildApproved(false)
    setBuildEnabled(false)
    setRollbackPreflight(null)
  }, [])
  const {
    releases, releasesLoading, releasesChecked, releasesError,
    runtime, setRuntime, plan, setPlan,
    executionEnabled, setExecutionEnabled, loadReleases, loadRuntime, beginInspection,
  } = useNodeProjectInspection(getJson, resetRuntimeReviews)
  // Discard one-shot approvals whenever the owner identity changes or locks.
  // A subsequent unlock must review the current release and plan again.
  const revokeOwnerAccess = () => {
    setOwnerAuthorized(false)
    setApproved(false)
    setDependencyApproved(false)
    setDependencyReview(null)
    setDependencyInstallEnabled(false)
    setBuildApproved(false)
    setBuildReview(null)
    setBuildEnabled(false)
    setRollbackPreflight(null)
    setPlan(null)
    setExecutionEnabled(false)
  }
  const selected = projects.find((project) => project.id === selectedId)
  const canPublish = Boolean(
    catalogState === "ready" && selected && !busy && ownerAuthorized && !editorDirty && approved && executionEnabled &&
    plan?.allowed && selected.candidateRelease &&
    plan.release === selected.candidateRelease &&
    runtime?.activeRelease !== selected.candidateRelease
  )
  const refresh = React.useCallback(async () => {
    const request = ++catalogRequest.current
    try {
      const data = await getJson(api)
      // Stale responses do not change the catalog or its dependent selection.
      if (request !== catalogRequest.current) return verifiedCatalog.current
      const catalog = parseProjectCatalog(data.projects)
      if (data.accessMode !== undefined && data.accessMode !== "protected" && data.accessMode !== "trusted-lan")
        throw new Error("Invalid Node access policy")
      setAccessMode(data.accessMode === "trusted-lan" ? "trusted-lan" : "protected")
      const selectedBefore = verifiedCatalog.current.find(project => project.id === selectedIdRef.current)
      const selectedAfter = catalog.find(project => project.id === selectedIdRef.current)
      // Reuse a selected project only while its verified release revision is unchanged.
      // Source staging in this panel re-reads runtime after this invalidation.
      if (selectedBefore && selectedAfter && (
        selectedBefore.candidateRelease !== selectedAfter.candidateRelease ||
        selectedBefore.previousCandidate !== selectedAfter.previousCandidate ||
        selectedBefore.deploymentCount !== selectedAfter.deploymentCount ||
        selectedBefore.state !== selectedAfter.state
      )) {
        invalidateRead()
        beginInspection()
        resetLogs()
        setApproved(false)
        setPreview(null)
        setBuildCheck(null)
        setGithubReview(null)
      }
      verifiedCatalog.current = catalog
      setProjects(catalog)
      setCatalogState("ready")
      setError(null)
      return catalog
    } catch (cause) {
      // Ignore late failures after a more recent refresh (or unmount).
      if (request !== catalogRequest.current) return verifiedCatalog.current
      verifiedCatalog.current = []
      setAccessMode("protected"); setOwnerAuthorized(false)
      invalidateRead()
      beginInspection()
      resetLogs()
      resetDiagnostics()
      setProjects([]); setSelectedId(""); setApproved(false)
      setPlan(null); setExecutionEnabled(false)
      if (cause instanceof Error && cause.message === disabledMessage) {
        setCatalogState("disabled")
        setError(null)
        return [] as Project[]
      }
      setCatalogState("error")
      throw cause
    }
  }, [getJson, beginInspection, resetLogs, invalidateRead, resetDiagnostics, setPlan, setExecutionEnabled])
  React.useEffect(() => {
    let live = true
    void Promise.resolve().then(refresh).catch(cause => {
      if (live) setError(cause instanceof Error ? cause.message : "Could not load Node projects.")
    })
    return () => { live = false }
  }, [refresh])
  // A valid refreshed catalog may no longer contain the selected project.
  // Invalidate all project-scoped replies before an old runtime can reappear.
  React.useEffect(() => {
    if (catalogState !== "ready" || !selectedId ||
        projects.some(project => project.id === selectedId)) return
    let active = true
    void Promise.resolve().then(() => {
      if (!active) return
      invalidateRead()
      beginInspection()
      resetLogs()
      setSelectedId("")
      setApproved(false)
      setPreview(null)
      setBuildCheck(null)
      setGithubReview(null)
      setEditorDirty(false)
    })
    return () => { active = false }
  }, [catalogState, projects, selectedId, invalidateRead, beginInspection, resetLogs])

  const action = (fn: () => Promise<void>) => {
    if (actionInFlight.current) return
    actionInFlight.current = true
    setBusy(true); setError(null); setMessage(null)
    void fn().catch(cause => setError(cause instanceof Error ? cause.message : "Operation rejected"))
      .finally(() => {
        actionInFlight.current = false
        setBusy(false)
      })
  }
  React.useEffect(() => {
    if (requestedProject === null) {
      appliedDeepLink.current = null
      return
    }
    if ((routeProject !== undefined && busy) || catalogState !== "ready" ||
        !/^node-[a-f0-9]{32}$/.test(requestedProject) ||
        !projects.some(project => project.id === requestedProject) ||
        appliedDeepLink.current === requestedProject) return
    appliedDeepLink.current = requestedProject
    invalidateRead()
    beginInspection()
    resetLogs()
    setSelectedId(requestedProject); setApproved(false)
    setPreview(null)
    setManifest(examplePackage); setLockfile(exampleLock); setSource(exampleSource); setSourceOrigin("example")
    setExtraFiles({}); setAssetFiles({}); setBuildCheck(null); setEditorDirty(false)
    setGithubReview(null); setDependencyReview(null); setGithubRepository("")
    void Promise.all([loadReleases(requestedProject), loadRuntime(requestedProject)])
      .catch(() => setError("Owning Node project unavailable. Refresh before any action."))
  }, [requestedProject, routeProject, busy, catalogState, projects, loadReleases, loadRuntime, beginInspection, resetLogs, invalidateRead])

  const runRuntimeAction = async (
    id: string,
    operation: "deploy" | "start" | "stop" | "restart" | "rollback",
    body: unknown,
    successMessage: string,
  ) => {
    const expectedState = operation === "stop" ? "stopped" : "running"
    const expectedRelease = operation === "deploy"
      ? (body as { release: string }).release
      : operation === "rollback" ? runtime?.previousGoodRelease : runtime?.activeRelease
    setApproved(false)
    setExecutionEnabled(false)
    // Existing readiness belongs to the previous runtime; the mutation may stop or replace it.
    setHealth(null)
    setRuntime(null)
    setPlan(null)
    let result: Record<string, unknown>
    try {
      result = await getJson(api + "/" + id + "/" + operation, "POST", body)
    } catch {
      throw new Error("Node action result unconfirmed. Refresh runtime status before retrying.")
    }
    const acknowledged = result.runtime as Record<string, unknown> | undefined
    if (!acknowledged || typeof acknowledged !== "object" ||
        Array.isArray(acknowledged) || acknowledged.state !== expectedState ||
        (expectedRelease && acknowledged.activeRelease !== expectedRelease)) {
      throw new Error("Node action response unverified. Refresh runtime status before retrying.")
    }
    try {
      const observed = await loadRuntime(id)
      if (!observed) return
      if (observed.state !== expectedState ||
          observed.desired !== expectedState ||
          (expectedRelease && observed.activeRelease !== expectedRelease)) {
        setExecutionEnabled(false)
        setRuntime(null)
        setPlan(null)
        setError("Node action acknowledged, but runtime state differs. Review plan before retrying.")
        return
      }
      if (expectedState === "running") {
        const report = await getJson(api + "/" + id + "/health")
        const health = report.health as Record<string, unknown> | undefined
        if (!health || health.state !== "running" ||
            health.release !== expectedRelease || health.ready !== true) {
          setExecutionEnabled(false)
          setRuntime(null)
          setPlan(null)
          setError("Node process acknowledged, but HTTP readiness was not verified. Review plan before retrying.")
          return
        }
        setHealth({ state: "running", release: expectedRelease ?? null, ready: true })
      }
      setMessage(successMessage)
    } catch {
      setExecutionEnabled(false)
      setRuntime(null)
      setPlan(null)
      setError("Node action acknowledged, but runtime refresh failed. Review plan before retrying.")
    }
  }
  const selectProject = (project: Pick<Project, "id" | "name">) => action(async () => {
            setSearchParams(current => {
              const next = new URLSearchParams(current)
              next.delete("project")
              return next
            }, { replace: true })
            invalidateRead()
            beginInspection()
            resetLogs()
            setSelectedId(project.id); setApproved(false)
            setPreview(null)
            setManifest(examplePackage); setLockfile(exampleLock); setSource(exampleSource); setSourceOrigin("example")
            setExtraFiles({}); setAssetFiles({})
            setBuildCheck(null); setEditorDirty(false); setGithubReview(null)
            setDependencyReview(null)
            setGithubRepository("")
            await Promise.all([loadReleases(project.id), loadRuntime(project.id)])
  })
  return {
    tokenRef, token, setToken, setOwnerAuthorized, accessMode, ownerAuthorized, 
    ownerConfigured, setOwnerConfigured, getJson, projects, setProjects, verifiedCatalog, 
    catalogState, setCatalogState, selectedId, setSelectedId, name, setName, 
    createPhase, setCreatePhase, creatingRef, manifest, setManifest, lockfile, 
    setLockfile, source, setSource, sourceOrigin, setSourceOrigin, extraFiles, 
    setExtraFiles, assetFiles, setAssetFiles, githubRepository, setGithubRepository, githubReview, 
    setGithubReview, editorDirty, setEditorDirty, approved, setApproved, preview, 
    setPreview, health, setHealth, dependencyReview, setDependencyReview, dependencyInstallEnabled, 
    setDependencyInstallEnabled, dependencyApproved, setDependencyApproved, buildReview, setBuildReview, buildEnabled, 
    setBuildEnabled, buildApproved, setBuildApproved, rollbackPreflight, setRollbackPreflight, buildCheck, 
    setBuildCheck, busy, actionInFlight, error, setError, message, 
    setMessage, nodeTools, registries, toolchainStatus, registryStatus, toolchainError, 
    registryError, checkTools, inspectRegistries, invalidateRead, readScoped, logLines, 
    logsLoading, logsError, logsChecked, resetLogs, loadLogs, resetRuntimeReviews, 
    releases, releasesLoading, releasesChecked, releasesError, runtime, setRuntime, 
    plan, setPlan, executionEnabled, setExecutionEnabled, loadReleases, loadRuntime, 
    beginInspection, revokeOwnerAccess, selected, canPublish, refresh, action, 
    runRuntimeAction, setSearchParams, lanView, selectProject,
  }
}
export type NodeProjectController = ReturnType<typeof useNodeProjectController>
export type SelectedNodeController = NodeProjectController & { selected: Project }
