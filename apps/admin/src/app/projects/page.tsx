import * as React from "react"
import { useSearchParams } from "react-router-dom"
import { BaseLayout } from "@/components/layouts/base-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { readLocalNodeFiles, readLocalNodeFolder } from "@/lib/node-source-import"
import { NodeBackupPanel } from "./node-backup-panel"
import { NodeDataPanel } from "./node-data-panel"
import { NodeProjectPicker } from "./node-project-picker"
import { NodeRuntimeDetails } from "./node-runtime-details"
import { NodeReleaseInventory } from "./node-release-inventory"
import { useNodeProjectInspection } from "./use-node-project-inspection"
import { useNodeProjectLogs } from "./use-node-project-logs"
import { NodeProjectLogFeedback } from "./node-project-log-feedback"
import { useNodeHostDiagnostics } from "./use-node-host-diagnostics"
import { useNodeProjectScopedRead } from "./use-node-project-scoped-read"
import { shortRelease } from "./node-project-display"
import { NodeRuntimeHistory } from "./node-runtime-history"
import {
  api, disabledMessage, examplePackage, exampleLock, exampleSource,
  validatedExtras, validatedAssets, parseProjectCatalog, parseNodeHealth, requestJson, NodeProjectValidationError,
  type Project, type NodeHealth,
  type DependencyReview, type BuildReview, type RollbackPreflight,
} from "./node-project-client"

export default function ProjectsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const lanView = typeof window !== "undefined" && !["localhost", "127.0.0.1"].includes(window.location.hostname)
  const tokenRef = React.useRef("")
  const [token, setToken] = React.useState("")
  const [ownerAuthorized, setOwnerAuthorized] = React.useState(false)
  const [ownerConfigured, setOwnerConfigured] = React.useState<boolean | null>(null)
  const getJson = React.useCallback((url: string, method?: "POST", body?: unknown) =>
    requestJson(url, method, body, tokenRef.current), [])
  const requestedProject = searchParams.get("project")
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
  selectedIdRef.current = selectedId
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
  }, [getJson, beginInspection, resetLogs, invalidateRead, resetDiagnostics])
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
    invalidateRead()
    beginInspection()
    resetLogs()
    setSelectedId("")
    setApproved(false)
    setPreview(null)
    setBuildCheck(null)
    setGithubReview(null)
    setEditorDirty(false)
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
    if (catalogState !== "ready" ||
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
  }, [requestedProject, catalogState, projects, loadReleases, loadRuntime, beginInspection, resetLogs, invalidateRead])

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
  return <BaseLayout title="Projects" description="Node.js projects.">
    <div className="space-y-5 px-4 pb-8 lg:px-6">
      <div className="flex min-h-10 items-center justify-end">
        <Button variant="outline" disabled={busy} onClick={() => action(async () => {
          await refresh()
          if (createPhase === "unknown") {
            setCreatePhase("idle")
            setMessage("Catalog refreshed. Check existing projects before creating another.")
          }
        })}>Refresh</Button>
      </div>
      {catalogState === "ready" &&
        <NodeProjectPicker projects={projects} selectedId={selectedId} busy={busy}
          onSelect={(project) => action(async () => {
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
          })} />}
      <Card id="node-owner-access">
        <CardContent className="space-y-2 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">Node.js owner access</h2>
            <p role="status" className="text-xs text-muted-foreground">
              Owner: {ownerAuthorized ? "authenticated" : ownerConfigured === false ? "host token not configured" : "locked"}.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex min-w-52 flex-1 items-center gap-2 text-sm">
              <span className="shrink-0">Owner token</span>
              <Input aria-label="Node owner token" type="password" autoComplete="off" value={token}
                onChange={event => {
                  tokenRef.current = event.target.value
                  setToken(event.target.value)
                  revokeOwnerAccess()
                }} />
            </label>
            <Button disabled={busy || token.length < 32} onClick={() => action(async () => {
              const attemptedToken = tokenRef.current
              const response = await requestJson(api + "/owner-session", undefined, undefined, attemptedToken)
              // Lock or token edits can happen while a network reply is pending.
              if (tokenRef.current !== attemptedToken)
                throw new Error("Owner token changed while verifying. Unlock again.")
              if (typeof response.configured !== "boolean" || typeof response.authorized !== "boolean")
                throw new Error("Invalid owner session response")
              setOwnerConfigured(response.configured)
              setOwnerAuthorized(response.authorized)
              if (!response.authorized)
                throw new Error(response.configured ? "Invalid Node owner token." : "Node owner token is not configured on the host.")
              setMessage("Owner authenticated for Node management.")
            })}>Unlock management</Button>
            <Button variant="outline" disabled={!token} onClick={() => {
              tokenRef.current = ""
              setToken("")
              revokeOwnerAccess()
              setMessage("Owner access locked.")
            }}>Lock</Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Token stays in this tab. {lanView ? "LAN HTTP is unencrypted — trusted network only." : "Only use trusted Node code."}
          </p>
        </CardContent>
      </Card>
      {catalogState === "disabled" && <p role="status" className="text-muted-foreground text-sm">{disabledMessage}</p>}
      {toolchainStatus === "loading" && <p role="status" className="text-muted-foreground text-sm">
        Checking Node tools…
      </p>}
      {toolchainStatus === "error" && <p role="alert" className="text-destructive text-sm">
        {toolchainError}
      </p>}
      {nodeTools && <p role="status" className="text-muted-foreground text-sm">
        Installed tools: Node {nodeTools.nodeVersion ?? "not detected"} · npm {nodeTools.npmVersion ?? "not detected"}
      </p>}
      {error && <p role="alert" className="text-destructive text-sm">{error}</p>}
      {message && <p role="status" className="text-sm">{message}</p>}
      {registryStatus === "loading" && <p role="status" className="text-muted-foreground text-sm">
        Inspecting hosting registries…
      </p>}
      {registryStatus === "error" && <p role="alert" className="text-destructive text-sm">
        {registryError}
      </p>}
      {registries && <p className="text-muted-foreground text-sm" aria-label="Hosting registries">
        Modules: {registries.modules} · Services: {registries.services} · Projects: {registries.projects}.
        Declarations do not grant process ownership or lifecycle permission.
      </p>}
      {!selected && catalogState === "ready" && projects.length > 0 &&
        <p role="status" className="text-sm text-muted-foreground">
          Select a project above to inspect its runtime, source files and releases.
        </p>}
      {selected && catalogState === "ready" && <Card>
        <CardHeader><CardTitle>{selected.name}</CardTitle>
          <CardDescription aria-label="Node runtime summary">
            {runtime?.state ?? "unverified"} · Live: <span title={runtime?.activeRelease ?? undefined}>{shortRelease(runtime?.activeRelease)}</span> ·
            Prepared: <span title={selected.candidateRelease ?? undefined}>{shortRelease(selected.candidateRelease)}</span> ·
            HTTP readiness: {!health ? "not checked" : health.ready === null ? "not probed" : health.ready ? "ready" : "not ready"}
          </CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <nav aria-label="Node project sections" className="flex flex-wrap gap-4 text-sm">
            <a className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted" href="#node-runtime">Runtime</a>
            <a className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted" href="#node-source">Source</a>
            <a className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted" href="#node-candidates">Releases</a>
          </nav>
          <Card id="node-runtime">
            <CardContent className="space-y-3 pt-4">
              {!ownerAuthorized && <p role="status" className="text-xs text-muted-foreground">
                Read-only · <a href="#node-owner-access" className="underline underline-offset-4">Unlock owner access</a>
              </p>}
              <NodeRuntimeDetails runtime={runtime} plan={plan}
                buildReview={buildReview} dependencyReview={dependencyReview} />
              {plan && (plan.missingTools.length > 0 || plan.conflicts.length > 0 ||
                  (plan.dependencyIssues?.length ?? 0) > 0) &&
                <p role="alert" className="text-sm text-destructive">{[
                  ...plan.missingTools, ...plan.conflicts, ...(plan.dependencyIssues ?? []),
                ].join(", ")}</p>}
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" aria-label="Approve local Node execution" checked={approved}
                  onChange={event => setApproved(event.target.checked)} />
                Approve running this trusted Node application.
              </label>
              <div className="flex flex-wrap gap-2">
                <Button disabled={busy} variant="outline" onClick={() => action(async () => {
                  await loadRuntime(selected.id); setMessage("Runtime status and plan refreshed.")
                })}>Review plan</Button>
                <Button disabled={!canPublish} variant={canPublish ? "default" : "outline"}
                  className={!canPublish ? "cursor-not-allowed opacity-35" : undefined}
                  title={!canPublish ? "Unlock owner access, review the plan, approve execution and select an eligible staged release." : "Publish the reviewed release"}
                  onClick={() => action(async () => {
                    await runRuntimeAction(selected.id, "deploy",
                      { approved: true, release: selected.candidateRelease },
                      "Owned Node release started and readiness verified by host.")
                  })}>{runtime?.activeRelease ? "Publish update" : "Deploy selected release"}</Button>
                <Button variant="outline" disabled={busy} onClick={() => action(async () => {
                  // A failed or pending GET must not keep the previous probe marked ready.
                  setHealth(null)
                  const response = await readScoped(selected.id, "health")
                  if (!response) return
                  const observed = parseNodeHealth(response.health)
                  // A host may have switched releases since the last runtime read.
                  // Even a non-ready response for another release invalidates
                  // the old runtime review and its one-shot approvals.
                  if ((runtime && observed.release !== runtime.activeRelease) ||
                      (observed.ready === true && runtime?.state !== "running")) {
                    invalidateRead()
                    beginInspection()
                    resetLogs()
                    setApproved(false)
                    setPreview(null)
                    throw new Error("Node runtime changed since review. Inspect runtime again before acting.")
                  }
                  setHealth(observed)
                  setMessage("Current Node readiness checked against verified local ownership.")
                })}>Check live readiness</Button>
                <Button variant="outline" disabled={busy || !ownerAuthorized ||
                  runtime?.state !== "running" || !runtime?.activeRelease}
                  onClick={() => action(async () => {
                    // Do not retain a previous page body while a new inspection is pending or fails.
                    setPreview(null)
                    const expectedRelease = runtime?.activeRelease
                    if (!expectedRelease) throw new Error("Review current Node runtime before preview.")
                    const response = await readScoped(selected.id, "preview")
                    if (!response) return
                    const value = response.preview as Record<string, unknown> | undefined
                    if (!value || typeof value.release !== "string" ||
                      !/^r-[a-f0-9]{32}$/.test(value.release) ||
                      value.release !== expectedRelease ||
                      typeof value.body !== "string" || value.body.length > 8192)
                      throw new Error("Invalid private Node preview response")
                    setPreview({ release: value.release, body: value.body })
                    setMessage("Private loopback response inspected as plain text, not published.")
                  })}>Preview local response</Button>
                <Button variant="outline" disabled={busy} onClick={() => action(async () => {
                  const current = await loadLogs(selected.id)
                  if (current) setMessage("Bounded runit logs loaded.")
                })}>View logs</Button>
              </div>

              <details data-testid="node-advanced-setup" className="rounded-lg border p-3">
                <summary className="cursor-pointer text-sm font-medium">Dependencies & build
                  <span className="ml-2 text-xs font-normal text-muted-foreground">Advanced · separate approval</span>
                </summary>
                <div className="mt-3 flex flex-wrap gap-2">
                <Button variant="outline" disabled={busy || !ownerAuthorized || editorDirty || !selected.candidateRelease}
                  onClick={() => action(async () => {
                    setDependencyReview(null)
                    setDependencyApproved(false)
                    setDependencyInstallEnabled(false)
                    const result = await getJson(api + "/" + selected.id + "/dependency-review")
                    const review = result.review as Partial<DependencyReview> | undefined
                    if (!review || review.release !== selected.candidateRelease ||
                        !["not-required", "review-required", "prepared", "blocked"].includes(review.status ?? "") ||
                        typeof review.dependencyCount !== "number" ||
                        !Number.isSafeInteger(review.dependencyCount) ||
                        review.dependencyCount < 0 || review.dependencyCount > 500 ||
                        typeof review.installRequired !== "boolean" ||
                        typeof review.buildRequired !== "boolean" ||
                        !Array.isArray(review.blockers) ||
                        !review.blockers.every(item => typeof item === "string") ||
                        review.executed !== false ||
                        (review.installCommand !== null &&
                         (!Array.isArray(review.installCommand) ||
                          ![
                            "npm ci --ignore-scripts --no-bin-links --no-audit --no-fund --omit=dev",
                            "npm ci --ignore-scripts --no-bin-links --no-audit --no-fund --include=dev",
                          ].includes(review.installCommand.join(" ")))) ||
                        (review.buildCommand !== null &&
                         (!Array.isArray(review.buildCommand) ||
                          review.buildCommand.join(" ") !== "npm run build")) ||
                        (review.installRequired !== (review.installCommand !== null)) ||
                        (review.buildRequired !== (review.buildCommand !== null)))
                      throw new Error("Invalid Node dependency review")
                    setDependencyReview(review as DependencyReview)
                    setDependencyInstallEnabled(result.dependencyInstallEnabled === true)
                    setMessage(review.status === "prepared"
                      ? "Installed Node packages verified against the pinned release."
                      : "Dependency setup reviewed without running npm or build.")
                  })}>Review dependency setup</Button>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" aria-label="Approve Node dependency install"
                    checked={dependencyApproved} onChange={event => setDependencyApproved(event.target.checked)}
                    disabled={busy || !dependencyInstallEnabled || dependencyReview?.status !== "review-required"} />
                  I authorize one isolated npm ci for this PocketHost release (network downloads permitted).
                </label>
                <Button variant="outline" disabled={busy || !ownerAuthorized || editorDirty || !dependencyApproved ||
                  !dependencyInstallEnabled || !selected.candidateRelease ||
                  dependencyReview?.release !== selected.candidateRelease ||
                  dependencyReview.status !== "review-required" || !dependencyReview.installRequired ||
                  dependencyReview.blockers.length > 0}
                  onClick={() => action(async () => {
                    const release = selected.candidateRelease!
                    const expectedCount = dependencyReview!.dependencyCount
                    setDependencyApproved(false)
                    setDependencyReview(null)
                    setDependencyInstallEnabled(false)
                    let result: Record<string, unknown>
                    try {
                      result = await getJson(api + "/" + selected.id + "/install-dependencies",
                        "POST", { approved: true, release })
                    } catch {
                      throw new Error("Package installation result unconfirmed. Review setup before retrying.")
                    }
                    const packages = result.dependencies as Record<string, unknown> | undefined
                    if (!packages || packages.release !== release || packages.prepared !== true ||
                        packages.verified !== true || packages.dependencyCount !== expectedCount)
                      throw new Error("Package installation response unverified. Review before retry.")
                    await loadRuntime(selected.id)
                    const checked = await getJson(api + "/" + selected.id + "/dependency-review")
                    const verified = checked.review as Partial<DependencyReview> | undefined
                    if (!verified || verified.release !== release || verified.status !== "prepared")
                      throw new Error("Package installation acknowledged but integrity unconfirmed.")
                    setDependencyReview(verified as DependencyReview)
                    setDependencyInstallEnabled(checked.dependencyInstallEnabled === true)
                    setMessage(verified.buildRequired
                      ? "Node build dependencies verified. Build execution is still disabled."
                      : "Owned Node packages installed and SHA-256 integrity verified. Review deploy plan.")
                  })}>Install approved dependencies</Button>
                <Button variant="outline" disabled={busy || !ownerAuthorized || editorDirty || !selected.candidateRelease}
                  onClick={() => action(async () => {
                    setBuildReview(null)
                    setBuildApproved(false)
                    setBuildEnabled(false)
                    const result = await getJson(api + "/" + selected.id + "/build-review")
                    const review = result.review as Partial<BuildReview> | undefined
                    if (!review || review.release !== selected.candidateRelease ||
                        !["not-required", "requires-dependencies", "ready-to-build", "verified", "blocked"]
                          .includes(review.status ?? "") ||
                        typeof review.buildRequired !== "boolean" ||
                        typeof review.dependenciesPrepared !== "boolean" ||
                        typeof review.artifactVerified !== "boolean" ||
                        typeof review.dependencyCount !== "number" ||
                        !Number.isSafeInteger(review.dependencyCount) ||
                        review.dependencyCount < 0 || review.dependencyCount > 500 ||
                        !Array.isArray(review.blockers) || review.blockers.length > 32 ||
                        !review.blockers.every(value => typeof value === "string" && value.length <= 160) ||
                        (review.script !== null &&
                         (typeof review.script !== "string" || review.script.length > 256)) ||
                        review.buildRequired !== (review.script !== null) ||
                        (review.artifact !== null && review.artifact !== undefined && (
                          !review.artifactVerified ||
                          typeof review.artifact !== "object" ||
                          !Number.isSafeInteger(review.artifact.entries) ||
                          review.artifact.entries < 1 || review.artifact.entries > 512 ||
                          !Number.isSafeInteger(review.artifact.bytes) ||
                          review.artifact.bytes < 0 || review.artifact.bytes > 16 * 1024 * 1024 ||
                          !Array.isArray(review.artifact.files) ||
                          review.artifact.files.length > 24 ||
                          !review.artifact.files.every(value =>
                            typeof value === "string" && value.length <= 256 &&
                            !value.startsWith("/") && !value.includes("..") && !value.includes("\\")) ||
                          typeof review.artifact.truncated !== "boolean"
                        )))
                      throw new Error("Invalid Node build review")
                    setBuildReview(review as BuildReview)
                    setBuildEnabled(result.buildEnabled === true)
                    setMessage(review.status === "verified"
                      ? "Build artifact verified. Review the deployment plan."
                      : "Build reviewed without running project code.")
                  })}>Review Node build</Button>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" aria-label="Approve Node build execution"
                    checked={buildApproved} onChange={value => setBuildApproved(value.target.checked)}
                    disabled={busy || !buildEnabled || buildReview?.status !== "ready-to-build"} />
                  I explicitly approve running the displayed build script from this trusted project.
                  It runs as the Termux user; the private folder is not an OS sandbox.
                </label>
                <Button variant="outline" disabled={busy || !ownerAuthorized || editorDirty || !buildApproved ||
                  !buildEnabled || !selected.candidateRelease ||
                  buildReview?.release !== selected.candidateRelease ||
                  buildReview.status !== "ready-to-build" ||
                  !buildReview.dependenciesPrepared || !buildReview.buildRequired ||
                  buildReview.blockers.length > 0}
                  onClick={() => action(async () => {
                    const release = selected.candidateRelease!
                    setBuildApproved(false)
                    setBuildReview(null)
                    setBuildEnabled(false)
                    setApproved(false)
                    setPlan(null)
                    let result: Record<string, unknown>
                    try {
                      result = await getJson(api + "/" + selected.id + "/build",
                        "POST", { approved: true, release })
                    } catch {
                      throw new Error("Node build result unconfirmed. Review the artifact before retrying.")
                    }
                    const built = result.build as Record<string, unknown> | undefined
                    if (!built || built.release !== release || built.prepared !== true ||
                        built.verified !== true || typeof built.entries !== "number" ||
                        !Number.isSafeInteger(built.entries) || built.entries < 1 ||
                        built.entries > 512 || typeof built.bytes !== "number" ||
                        !Number.isSafeInteger(built.bytes) || built.bytes < 0 ||
                        built.bytes > 16 * 1024 * 1024)
                      throw new Error("Unverified Node build result. Review before retrying.")
                    await loadRuntime(selected.id)
                    const checked = await getJson(api + "/" + selected.id + "/build-review")
                    const review = checked.review as Partial<BuildReview> | undefined
                    if (!review || review.release !== release || review.status !== "verified" ||
                        review.artifactVerified !== true)
                      throw new Error("Node build acknowledged but artifact integrity unconfirmed.")
                    setBuildReview(review as BuildReview)
                    setBuildEnabled(checked.buildEnabled === true)
                    setMessage("Node build published privately and artifact integrity verified. Review deploy plan.")
                  })}>Execute approved Node build</Button>
                <Button disabled={busy || !ownerAuthorized || editorDirty || !plan?.allowed || !selected.candidateRelease}
                  variant="outline" onClick={() => action(async () => {
                    const result = await getJson(api + "/" + selected.id + "/check-build",
                      "POST", { release: selected.candidateRelease })
                    const report = result.buildCheck as Record<string, unknown> | undefined
                    if (!report || report.release !== selected.candidateRelease ||
                      !["syntax-valid", "syntax-invalid"].includes(String(report.status)) ||
                      report.executed !== false) throw new Error("Invalid source check result")
                    setBuildCheck(report as {
                      release: string; status: "syntax-valid" | "syntax-invalid"; executed: false
                    })
                    setMessage("Node syntax check completed without executing project source.")
                  })}>Check Node build syntax</Button>
                </div>
              </details>
              <details data-testid="node-recovery" className="rounded-lg border p-3">
                <summary className="cursor-pointer text-sm font-medium">Maintenance & rollback
                </summary>
                <div className="mt-3 flex flex-wrap gap-2">
                <Button variant="outline" disabled={busy || !ownerAuthorized || !approved || !executionEnabled ||
                  runtime?.state !== "stopped" || !runtime.activeRelease ||
                  runtime.activeRelease !== runtime.lastGoodRelease}
                  onClick={() => action(async () => {
                    await runRuntimeAction(selected.id, "start", { approved: true },
                      "Previously verified Node release started and readiness confirmed.")
                  })}>Start stopped service</Button>
                <Button variant="outline" disabled={busy || !ownerAuthorized || !runtime?.previousGoodRelease}
                  onClick={() => action(async () => {
                    setRollbackPreflight(null)
                    const target = runtime?.previousGoodRelease
                    if (!target) throw new Error("No previous Node release to review")
                    const data = await getJson(api + "/" + selected.id + "/rollback-preview")
                    const reviewed = data.rollbackPreview as Partial<RollbackPreflight> | undefined
                    if (!reviewed ||
                        reviewed.release !== target ||
                        typeof reviewed.allowed !== "boolean" ||
                        ![
                          "previous-release-verified", "release-already-active",
                          "owned-process-identity-unknown",
                          "rollback-dependencies-or-build-unverified",
                          "rollback-toolchain-blocked", "rollback-source-syntax-invalid",
                          "rollback-release-not-verifiable",
                        ].includes(reviewed.reason ?? "") ||
                        reviewed.allowed !== (reviewed.reason === "previous-release-verified"))
                      throw new Error("Invalid Node rollback review")
                    setRollbackPreflight(reviewed as RollbackPreflight)
                    setMessage(reviewed.allowed
                      ? "Previous Node release verified for explicit rollback."
                      : "Rollback target is not safely recoverable.")
                  })}>Review rollback target</Button>
                <Button variant="outline" disabled={busy || !ownerAuthorized || !approved || !executionEnabled ||
                  !runtime?.previousGoodRelease || runtime.state === "unknown" ||
                  (rollbackPreflight !== null &&
                    (!rollbackPreflight.allowed ||
                      rollbackPreflight.release !== runtime.previousGoodRelease))}
                  onClick={() => action(async () => {
                    await runRuntimeAction(selected.id, "rollback", { approved: true },
                      "Previous verified Node release restored by host.")
                  })}>Rollback active release</Button>
                <Button variant="outline" disabled={busy || !ownerAuthorized || !approved || !executionEnabled || runtime?.state !== "running"}
                  onClick={() => action(async () => {
                    await runRuntimeAction(selected.id, "stop", { approved: true },
                      "Owned Node service stopped.")
                  })}>Stop owned service</Button>
                <Button variant="outline" disabled={busy || !ownerAuthorized || !approved || !executionEnabled ||
                  runtime?.state !== "running" || !runtime.activeRelease ||
                  runtime.activeRelease !== runtime.lastGoodRelease}
                  onClick={() => action(async () => {
                    await runRuntimeAction(selected.id, "restart", { approved: true },
                      "Owned Node service restarted and readiness verified.")
                  })}>Restart service</Button>
                </div>
              </details>
{rollbackPreflight && <p className="text-muted-foreground text-xs"
                aria-label="Node rollback preflight">
                Rollback to {rollbackPreflight.release ?? "none"}:
                {rollbackPreflight.allowed ? " verified" : " blocked"} · {rollbackPreflight.reason}.
              </p>}
              {buildCheck && <p className="text-muted-foreground text-xs" role="status">
                Candidate syntax: {buildCheck.status} · No project code executed.
              </p>}
              {!executionEnabled && ownerAuthorized && <p className="text-xs text-muted-foreground">
                Execution unavailable; review runtime permissions.
              </p>}
              <NodeRuntimeHistory history={runtime?.history ?? []} />
              {preview && <pre aria-label="Local Node response" className="max-h-48 overflow-auto whitespace-pre-wrap rounded-md border p-3 text-xs">
                {preview.body}
              </pre>}
              <NodeProjectLogFeedback
                lines={logLines} loading={logsLoading} error={logsError} checked={logsChecked}
              />
            </CardContent>
          </Card>
          <details id="node-source" data-testid="node-source-panel" aria-label="Node source editor"
            className="rounded-lg border">
            <summary className="cursor-pointer px-4 py-3 font-semibold">
              Source files <span className="ml-2 text-xs font-normal text-muted-foreground">
                {sourceOrigin === "example" ? "Example — not deployed" :
                  sourceOrigin === "staged" ? "Staged candidate — not necessarily live" :
                  sourceOrigin === "github" ? "GitHub — not staged" :
                  sourceOrigin === "local" ? "Local — not staged" : "Draft — not staged"}
              </span>
            </summary>
            <div className="space-y-3 border-t p-4">
          <details data-testid="node-source-safety" className="rounded-md border px-3 py-2 text-xs">
            <summary className="cursor-pointer font-medium">Deployment requirements</summary>
            <p className="mt-2 text-muted-foreground">
              The reviewed server.mjs runs as the Termux user on loopback only after explicit approval.
              Dependency installation and builds require separate review and SHA-256 verification.
              Generated dist files are not served unless server.mjs serves them.
              /__pockethost/ready must return the private X-PocketHost-Ready nonce.
              No public routes or automatic startup.
            </p>
          </details>
          <div className="flex flex-wrap items-end gap-2">
            <label className="grid min-w-56 flex-1 gap-1 text-sm">Public GitHub repository
              <Input aria-label="Public GitHub repository" placeholder="owner/repository"
                value={githubRepository} maxLength={150}
                onChange={event => {
                  setGithubRepository(event.target.value)
                  setGithubReview(null)
                }} />
            </label>
            <Button variant="outline" disabled={busy || !ownerAuthorized || !githubRepository.trim()}
              onClick={() => action(async () => {
                const result = await getJson(api + "/github/preview", "POST",
                  { repository: githubRepository.trim() })
                const data = result.preview as Record<string, unknown> | undefined
                const contents = data?.source as Record<string, unknown> | undefined
                const sourcePlan = data?.plan as Record<string, unknown> | undefined
                const commands = sourcePlan?.commands as Record<string, unknown> | undefined
                if (!data || !sourcePlan || !commands ||
                    typeof sourcePlan.dependencyCount !== "number" ||
                    !Number.isSafeInteger(sourcePlan.dependencyCount) ||
                    (sourcePlan.dependencyCount as number) < 0 ||
                    (sourcePlan.dependencyCount as number) > 500 ||
                    (commands.build !== null &&
                     (!Array.isArray(commands.build) ||
                      commands.build.length !== 3 ||
                      commands.build.join(" ") !== "npm run build")) ||
                    data.repository !== githubRepository.trim() ||
                    typeof data.commit !== "string" || !/^[a-f0-9]{40}$/.test(data.commit) ||
                    !contents || typeof contents.packageJson !== "object" ||
                    !contents.packageJson || Array.isArray(contents.packageJson) ||
                    typeof contents.packageLock !== "object" ||
                    !contents.packageLock || Array.isArray(contents.packageLock) ||
                    typeof contents.serverSource !== "string" ||
                    !contents.serverSource.trim() || contents.serverSource.length > 65536)
                  throw new Error("Invalid GitHub Node source preview")
                const fetchedExtras = validatedExtras(contents.extraFiles)
                const fetchedAssets = validatedAssets(contents.assetFiles)
                const changed = ["package.json", "package-lock.json", "server.mjs"]
                if (selected.candidateRelease) {
                  // Compare only with attested on-host source, never the editor buffer.
                  const current = await getJson(api + "/" + selected.id + "/source")
                  const staged = current.source as Record<string, unknown> | undefined
                  if (!staged || staged.release !== selected.candidateRelease ||
                      typeof staged.manifest !== "string" ||
                      typeof staged.lockfile !== "string" ||
                      typeof staged.serverSource !== "string" ||
                      staged.manifest.length > 140000 || staged.lockfile.length > 140000 ||
                      staged.serverSource.length > 65536)
                    throw new Error("Could not verify current staged Node source")
                  try {
                    if (JSON.stringify(JSON.parse(staged.manifest)) ===
                        JSON.stringify(contents.packageJson)) changed.splice(changed.indexOf("package.json"), 1)
                    if (JSON.stringify(JSON.parse(staged.lockfile)) ===
                        JSON.stringify(contents.packageLock)) changed.splice(changed.indexOf("package-lock.json"), 1)
                    if (staged.serverSource === contents.serverSource)
                      changed.splice(changed.indexOf("server.mjs"), 1)
                  } catch {
                    throw new Error("Could not verify current staged Node source")
                  }
                  const oldExtras = validatedExtras(staged.extraFiles)
                  if (JSON.stringify(oldExtras) !== JSON.stringify(fetchedExtras))
                    changed.push("frontend files")
                  const oldAssets = validatedAssets(staged.assetFiles)
                  if (JSON.stringify(oldAssets) !== JSON.stringify(fetchedAssets))
                    changed.push("binary assets")
                  if (!changed.length) {
                    setGithubReview(null)
                    setMessage("GitHub commit " + data.commit.slice(0, 12) +
                      " matches the current staged source. No update needed.")
                    return
                  }
                }
                setGithubReview({
                  repository: data.repository as string,
                  commit: data.commit,
                  changed,
                  dependencies: sourcePlan.dependencyCount as number,
                  buildRequired: commands.build !== null,
                  extraCount: Object.keys(fetchedExtras).length,
                  assetCount: Object.keys(fetchedAssets).length,
                })
                setExtraFiles(fetchedExtras)
                setAssetFiles(fetchedAssets)
                setManifest(JSON.stringify(contents.packageJson, null, 2))
                setLockfile(JSON.stringify(contents.packageLock, null, 2))
                setSource(contents.serverSource)
                setSourceOrigin("github")
                setApproved(false); setBuildCheck(null); setPlan(null); setPreview(null)
                setDependencyReview(null)
                setExecutionEnabled(false); setEditorDirty(true)
                setMessage("GitHub commit " + data.commit.slice(0, 12) +
                  " contains changes. Review and stage to preserve the previous release.")
              })}>{selected.candidateRelease ? "Check GitHub updates" : "Load GitHub source"}</Button>
          </div>
          {githubReview && <p className="text-muted-foreground text-xs"
            aria-label="GitHub source changes">
            {githubReview.repository} @ {githubReview.commit.slice(0, 12)} · Changed: {githubReview.changed.join(", ")} · Dependencies: {githubReview.dependencies} · Build: {githubReview.buildRequired ? "required" : "none"} · Frontend files: {githubReview.extraCount} · Binary assets: {githubReview.assetCount}
            {(githubReview.dependencies > 0 || githubReview.buildRequired) &&
              " · Staging only; package installation/build requires separate approval."}
          </p>}
          <label className="grid gap-1 text-sm">Load local Node files
            <input type="file" aria-label="Load local Node files" multiple accept=".json,.mjs"
              disabled={busy} className="w-full rounded-md border bg-background p-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-2 file:text-sm file:font-medium"
              onChange={event => {
                const picked = Array.from(event.currentTarget.files ?? [])
                event.currentTarget.value = ""
                if (!picked.length) return
                action(async () => {
                  const files = await readLocalNodeFiles(picked)
                  setManifest(files.manifest)
                  setLockfile(files.lockfile)
                  setSource(files.source)
                  setSourceOrigin("local")
                  setExtraFiles({})
                  setAssetFiles({})
                  setApproved(false)
                  setBuildCheck(null)
                  setPlan(null)
                  setPreview(null)
                  setExecutionEnabled(false)
                  setEditorDirty(true)
                  setGithubReview(null)
                  setDependencyReview(null)
                  setMessage("Three Node files loaded into the editor. Validate and stage to save a candidate.")
                })
              }} />
          </label>
          <label className="grid gap-1 text-sm">Load Node project folder
            <input type="file" aria-label="Load Node project folder" multiple
              ref={element => { if (element) element.setAttribute("webkitdirectory", "") }}
              disabled={busy} className="w-full rounded-md border bg-background p-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-2 file:text-sm file:font-medium"
              onChange={event => {
                const chosen = Array.from(event.currentTarget.files ?? [])
                event.currentTarget.value = ""
                if (!chosen.length) return
                action(async () => {
                  const local = await readLocalNodeFolder(chosen)
                  setManifest(local.manifest)
                  setLockfile(local.lockfile)
                  setSource(local.source)
                  setSourceOrigin("local")
                  setExtraFiles(local.extraFiles)
                  setAssetFiles(local.assetFiles)
                  setApproved(false); setBuildApproved(false); setBuildCheck(null)
                  setPlan(null); setPreview(null); setBuildReview(null)
                  setExecutionEnabled(false); setEditorDirty(true)
                  setGithubReview(null); setDependencyReview(null)
                  setMessage("Local project folder reviewed. Validate and stage to save its files; no code executed.")
                })
              }} />
          </label>
          <details data-testid="node-source-editors" className="rounded-lg border p-3">
            <summary className="cursor-pointer text-sm font-medium">
              Edit package.json, package-lock.json & server.mjs
            </summary>
            <div className="mt-3 space-y-3">
          <label className="grid gap-1 text-sm">package.json
            <textarea aria-label="package.json" className="w-full rounded-md border bg-background p-3 font-mono text-xs" rows={8}
              value={manifest} onChange={event => { setManifest(event.target.value); setEditorDirty(true); setSourceOrigin("edited"); setApproved(false); setGithubReview(null); setDependencyReview(null) }} /></label>
          <label className="grid gap-1 text-sm">package-lock.json
            <textarea aria-label="package-lock.json" className="w-full rounded-md border bg-background p-3 font-mono text-xs" rows={8}
              value={lockfile} onChange={event => { setLockfile(event.target.value); setEditorDirty(true); setSourceOrigin("edited"); setApproved(false); setGithubReview(null); setDependencyReview(null) }} /></label>
          <label className="grid gap-1 text-sm">server.mjs
            <textarea aria-label="server.mjs" className="w-full rounded-md border bg-background p-3 font-mono text-xs" rows={8}
              value={source} onChange={event => { setSource(event.target.value); setEditorDirty(true); setSourceOrigin("edited"); setApproved(false); setGithubReview(null); setDependencyReview(null) }} /></label>
            </div>
          </details>
          <p className="text-muted-foreground text-xs" aria-label="Imported frontend files">
            Extra source files: {Object.keys(extraFiles).length ?
              Object.keys(extraFiles).sort().join(", ") : "none"}
          </p>
          <p className="text-muted-foreground text-xs" aria-label="Imported binary assets">
            Binary assets: {Object.keys(assetFiles).length ?
              Object.keys(assetFiles).sort().join(", ") : "none"}
          </p>
          {(Object.keys(extraFiles).length > 0 || Object.keys(assetFiles).length > 0) &&
            <Button variant="outline"
            disabled={busy} onClick={() => {
              setExtraFiles({})
              setAssetFiles({})
              setEditorDirty(true)
              setApproved(false)
              setGithubReview(null)
              setDependencyReview(null)
              setBuildReview(null)
              setPlan(null)
            }}>Clear imported frontend files</Button>}
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" disabled={busy || !ownerAuthorized || !selected.candidateRelease}
              onClick={() => action(async () => {
                const response = await getJson(api + "/" + selected.id + "/source")
                const value = response.source as Record<string, unknown> | undefined
                if (!value || value.release !== selected.candidateRelease ||
                  typeof value.manifest !== "string" || value.manifest.length > 140000 ||
                  typeof value.lockfile !== "string" || value.lockfile.length > 140000 ||
                  typeof value.serverSource !== "string" || value.serverSource.length > 65536)
                  throw new Error("Invalid verified candidate source")
                const verifiedExtras = validatedExtras(value.extraFiles)
                const verifiedAssets = validatedAssets(value.assetFiles)
                setManifest(value.manifest); setLockfile(value.lockfile)
                setSource(value.serverSource); setSourceOrigin("staged"); setExtraFiles(verifiedExtras)
                setAssetFiles(verifiedAssets); setApproved(false)
                setBuildCheck(null); setPreview(null); setEditorDirty(false); setGithubReview(null)
                setDependencyReview(null)
                setMessage("Verified staged source loaded into editor; no process changed.")
              })}>Load staged source</Button>
            <Button disabled={busy || !ownerAuthorized || (!!selected.candidateRelease && !editorDirty)}
              onClick={() => action(async () => {
              const data = await getJson(api + "/" + selected.id + "/stage", "POST", {
                packageJson: JSON.parse(manifest) as unknown,
                packageLock: JSON.parse(lockfile) as unknown,
                serverSource: source,
                ...(Object.keys(extraFiles).length ? { extraFiles } : {}),
                ...(Object.keys(assetFiles).length ? { assetFiles } : {}),
                expectedCandidate: selected.candidateRelease,
                expectedRevision: selected.deploymentCount,
              })
              if (!validProject(data.project)) throw new Error("Invalid stage response")
              await refresh()
              await Promise.all([loadReleases(selected.id), loadRuntime(selected.id)])
              setApproved(false); setBuildCheck(null); setEditorDirty(false); setGithubReview(null)
              setSourceOrigin("staged")
              setMessage(data.unchanged === true
                ? "Source matches the current verified candidate. No new release created."
                : "Source candidate staged. Review the execution plan before deploying.")
            })}>Validate and stage source</Button>
            <Button variant="outline" disabled={busy || !ownerAuthorized || !selected.previousCandidate}
              onClick={() => action(async () => {
                const data = await getJson(api + "/" + selected.id + "/restore-candidate", "POST", {
                  expectedCandidate: selected.candidateRelease,
                  expectedRevision: selected.deploymentCount,
                })
                if (!validProject(data.project)) throw new Error("Invalid restore response")
                await refresh()
                await Promise.all([loadReleases(selected.id), loadRuntime(selected.id)])
                setApproved(false); setGithubReview(null)
                setMessage("Previous source candidate restored. No live process was changed.")
              })}>Restore previous candidate</Button>
          </div>
            </div>
          </details>
          <NodeReleaseInventory releases={releases} loading={releasesLoading}
            error={releasesError} checked={releasesChecked} busy={busy}
            activeRelease={runtime?.activeRelease} running={runtime?.state === "running"}
            onRefresh={() => action(() => loadReleases(selected.id))} />
        </CardContent>
      </Card>}
      <div className="space-y-3">
      <details data-testid="node-create-panel" className="rounded-xl border bg-card text-card-foreground">
        <summary className="cursor-pointer px-4 py-3 text-sm font-semibold">
          Create Node.js project <span className="ml-2 text-xs font-normal text-muted-foreground">New application</span>
        </summary>
        <div className="space-y-3 border-t px-4 py-4">
          <div className="flex flex-wrap items-end gap-3">
          <label className="grid min-w-52 gap-1 text-sm">Project name
            <Input aria-label="Project name" value={name} maxLength={60} onChange={event => setName(event.target.value)} />
          </label>
          <Button disabled={busy || createPhase === "unknown" || createPhase === "pending" ||
            !ownerAuthorized || catalogState !== "ready" || name.trim().length < 2}
            onClick={() => {
              if (creatingRef.current || actionInFlight.current || createPhase === "unknown") return
              creatingRef.current = true
              action(async () => {
                setCreatePhase("pending")
                const submittedName = name.trim()
                try {
                  const data = await getJson(api + "/", "POST", { name: submittedName })
                  const createdProject = data.project
                  if (!validProject(createdProject) || createdProject.name !== submittedName)
                    throw new Error("Unverified create acknowledgement")
                  const catalog = await refresh()
                  if (!catalog.some(project => project.id === createdProject.id && project.name === submittedName))
                    throw new Error("Created project not found in verified catalog")
                  invalidateRead()
                  beginInspection()
                  resetLogs()
                  setSelectedId(createdProject.id); setName(""); setApproved(false)
                  setPreview(null)
                  setCreatePhase("confirmed")
                  setMessage("Private Node project created.")
                  void loadRuntime(createdProject.id).catch(() => {
                    setError("Project confirmed in catalog, but runtime readback failed. Refresh runtime status.")
                  })
                } catch (cause) {
                  if (cause instanceof NodeProjectValidationError) {
                    setCreatePhase("rejected")
                    throw cause
                  }
                  // Missing or invalid acknowledgement does not prove that the POST failed.
                  setCreatePhase("unknown")
                  throw new Error("Project creation unconfirmed. Refresh the catalog before another create.")
                } finally {
                  creatingRef.current = false
                }
              })
            }}>Create project</Button>
          <Button variant="outline" disabled={busy || catalogState !== "ready"}
            onClick={() => action(async () => {
              if (await checkTools()) setMessage("Node toolchain version read confirmed.")
            })}>Check Node tools</Button>
          <Button variant="outline" disabled={busy || catalogState !== "ready"} onClick={() => action(async () => {
            if (await inspectRegistries())
              setMessage("Read-only module, service and project declarations verified.")
          })}>Inspect hosting registries</Button>
          </div>
          {createPhase === "pending" && <p role="status" className="text-sm text-muted-foreground">
            Creating project… Do not submit again while the host processes this request.
          </p>}
          {createPhase === "confirmed" && <p role="status" className="text-sm text-muted-foreground">
            Project identity verified in the refreshed catalog.
          </p>}
          {createPhase === "rejected" && <p role="status" className="text-sm text-destructive">
            Project name was rejected. Correct the name before trying again.
          </p>}
          {createPhase === "unknown" && <p role="alert" className="text-sm text-destructive">
            The host may have created this project. Use Refresh above to inspect the catalog; do not resubmit yet.
          </p>}
        </div>
      </details>
      <NodeDataPanel projectId={selected?.id ?? null} ownerAuthorized={ownerAuthorized}
        busy={busy} action={action} getJson={getJson} />
      <NodeBackupPanel catalogReady={catalogState === "ready"} ownerAuthorized={ownerAuthorized}
        busy={busy} action={action} getJson={getJson} onMessage={setMessage} />
      </div>
    </div>
  </BaseLayout>
}
