import * as React from "react"
import { BaseLayout } from "@/components/layouts/base-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { readLocalNodeFiles } from "@/lib/node-source-import"

type Project = {
  id: string
  name: string
  kind: "node"
  state: "created" | "source-staged"
  runtime: "not-provisioned"
  activeRelease: null
  candidateRelease: string | null
  previousCandidate: string | null
  deploymentCount: number
  createdAt: string
}
type RuntimeState = {
  state: "not-provisioned" | "running" | "stopped" | "unknown"
  port: number | null
  desired: "running" | "stopped"
  activeRelease: string | null
  lastGoodRelease: string | null
  previousGoodRelease: string | null
  history: { at: string; action: string; release: string }[]
  healthDecision?: { action: string; reason: string; nextEligibleAtMs: number | null }
}
type RuntimePlan = {
  release: string | null
  port: number | null
  missingTools: string[]
  nodeVersion: string | null
  npmVersion: string | null
  conflicts: string[]
  dependencyIssues?: string[]
  dependencyCount: number | null
  allowed: boolean
  reason: string
}
type NodeHealth = {
  state: "not-provisioned" | "stopped" | "running" | "unknown"
  release: string | null
  ready: boolean | null
}
type DependencyReview = {
  release: string
  status: "not-required" | "review-required" | "prepared" | "blocked"
  dependencyCount: number
  installRequired: boolean
  buildRequired: boolean
  installCommand: string[] | null
  buildCommand: string[] | null
  blockers: string[]
  executed: false
}
type Candidate = {
  id: string
  active: false
  candidate: boolean
  previousCandidate: boolean
  dependencyPlan: { packageName: string; packageVersion: string; dependencyCount: number; status: "review-required" }
}
const api = "/api/v1/node-projects"
const disabledMessage = "Node Hosting is not enabled on this panel."
const intent = "owned-node-project"
const examplePackage = JSON.stringify({
  name: "my-node-site", version: "1.0.0", type: "module",
  scripts: { start: "node server.mjs" },
}, null, 2)
const exampleLock = JSON.stringify({
  name: "my-node-site", version: "1.0.0", lockfileVersion: 3,
  packages: { "": { name: "my-node-site", version: "1.0.0" } },
}, null, 2)
const exampleSource = [
  "import http from 'node:http'",
  "const port = Number(process.env.PORT)",
  "if (!Number.isInteger(port)) throw new Error('PORT must be assigned by PocketHost')",
  "http.createServer((request, response) => {",
  "  if (request.url === '/__pockethost/ready') {",
  "    response.setHeader('X-PocketHost-Ready', process.env.POCKETHOST_READINESS_NONCE ?? '')",
  "    response.end('ready')",
  "    return",
  "  }",
  "  response.setHeader('Content-Type', 'text/plain')",
  "  response.end('Hello from PocketHost Node!')",
  "}).listen(port, '127.0.0.1')",
].join("\n")

function validProject(value: unknown): value is Project {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const item = value as Partial<Project>
  return typeof item.id === "string" && /^node-[a-f0-9]{32}$/.test(item.id) &&
    typeof item.name === "string" && item.kind === "node" &&
    ["created", "source-staged"].includes(item.state ?? "") &&
    item.runtime === "not-provisioned" && item.activeRelease === null &&
    (item.candidateRelease === null || (typeof item.candidateRelease === "string" && /^r-[a-f0-9]{32}$/.test(item.candidateRelease))) &&
    (item.previousCandidate === null || (typeof item.previousCandidate === "string" && /^r-[a-f0-9]{32}$/.test(item.previousCandidate)))
}
async function getJson(url: string, method?: "POST", body?: unknown): Promise<Record<string, unknown>> {
  const response = await fetch(url, { credentials: "same-origin", cache: "no-store",
    ...(method ? {
      method, headers: { "X-PocketHost-Intent": intent, ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    } : {}) })
  if (!response.ok) throw new Error(response.status === 404 && url === api ? disabledMessage :
    response.status === 404 ? "Node project resource not found." :
    response.status === 403 ? "Node Hosting access denied." :
    response.status === 400 ? "Invalid project input, manifest, lockfile or source." :
    response.status === 409 && (url.endsWith("/stage") || url.endsWith("/restore-candidate"))
      ? "Node source save refused. Refresh project and review the current candidate."
      : method ? "Operation refused by the private host." : "Could not load Node projects. Try Refresh.")
  const value: unknown = await response.json()
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid host response")
  return value as Record<string, unknown>
}
export default function ProjectsPage() {
  const [projects, setProjects] = React.useState<Project[]>([])
  const [nodeTools, setNodeTools] = React.useState<{
    nodeVersion: string | null
    npmVersion: string | null
  } | null>(null)
  const [catalogState, setCatalogState] = React.useState<"loading" | "ready" | "disabled" | "error">("loading")
  const [selectedId, setSelectedId] = React.useState("")
  const [name, setName] = React.useState("")
  const [manifest, setManifest] = React.useState(examplePackage)
  const [lockfile, setLockfile] = React.useState(exampleLock)
  const [source, setSource] = React.useState(exampleSource)
  const [githubRepository, setGithubRepository] = React.useState("")
  const [githubReview, setGithubReview] = React.useState<{
    repository: string; commit: string; changed: string[]
    dependencies: number; buildRequired: boolean
  } | null>(null)
  const [editorDirty, setEditorDirty] = React.useState(false)
  const [releases, setReleases] = React.useState<Candidate[]>([])
  const [runtime, setRuntime] = React.useState<RuntimeState | null>(null)
  const [plan, setPlan] = React.useState<RuntimePlan | null>(null)
  const [executionEnabled, setExecutionEnabled] = React.useState(false)
  const [approved, setApproved] = React.useState(false)
  const [logLines, setLogLines] = React.useState<string[]>([])
  const [preview, setPreview] = React.useState<{ release: string; body: string } | null>(null)
  const [health, setHealth] = React.useState<NodeHealth | null>(null)
  const [dependencyReview, setDependencyReview] = React.useState<DependencyReview | null>(null)
  const [dependencyInstallEnabled, setDependencyInstallEnabled] = React.useState(false)
  const [dependencyApproved, setDependencyApproved] = React.useState(false)
  const [buildCheck, setBuildCheck] = React.useState<{
    release: string; status: "syntax-valid" | "syntax-invalid"; executed: false
  } | null>(null)
  const [backupApproved, setBackupApproved] = React.useState(false)
  const [backupsEnabled, setBackupsEnabled] = React.useState(false)
  const [backupSnapshots, setBackupSnapshots] = React.useState<{
    id: string; time: string
  }[]>([])
  const [selectedSnapshot, setSelectedSnapshot] = React.useState("")
  const [backupStatus, setBackupStatus] = React.useState<{
    initialized: boolean; repositoryPresent: boolean; keyPresent: boolean
  } | null>(null)
  const [registries, setRegistries] = React.useState<{
    modules: number; services: number; projects: number
  } | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [message, setMessage] = React.useState<string | null>(null)
  const selected = projects.find((project) => project.id === selectedId)
  const refresh = React.useCallback(async () => {
    try {
      const data = await getJson(api)
      if (!Array.isArray(data.projects) || !data.projects.every(validProject))
        throw new Error("Invalid Node project registry response")
      setProjects(data.projects)
      setCatalogState("ready")
      setError(null)
    } catch (cause) {
      if (cause instanceof Error && cause.message === disabledMessage) {
        setProjects([])
        setSelectedId("")
        setCatalogState("disabled")
        setError(null)
        return
      }
      setCatalogState("error")
      throw cause
    }
  }, [])
  const loadReleases = React.useCallback(async (id: string) => {
    const data = await getJson(api + "/" + id + "/releases")
    if (!Array.isArray(data.releases)) throw new Error("Invalid release inventory")
    setReleases(data.releases as Candidate[])
  }, [])
  const loadRuntime = React.useCallback(async (id: string): Promise<RuntimeState> => {
    const [status, preview] = await Promise.all([
      getJson(api + "/" + id + "/runtime"), getJson(api + "/" + id + "/plan"),
    ])
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
    setHealth(null)
    setDependencyReview(null)
    setDependencyApproved(false)
    setDependencyInstallEnabled(false)
    setPlan(preview.plan as RuntimePlan)
    setExecutionEnabled(status.executionEnabled === true && preview.executionEnabled === true)
    return observed
  }, [])
  React.useEffect(() => {
    let live = true
    void Promise.resolve().then(refresh).catch(cause => {
      if (live) setError(cause instanceof Error ? cause.message : "Could not load Node projects.")
    })
    return () => { live = false }
  }, [refresh])
  const action = (fn: () => Promise<void>) => {
    setBusy(true); setError(null); setMessage(null)
    void fn().catch(cause => setError(cause instanceof Error ? cause.message : "Operation rejected"))
      .finally(() => setBusy(false))
  }
  const runRuntimeAction = async (
    id: string,
    operation: "deploy" | "start" | "stop" | "restart" | "rollback",
    body: unknown,
    successMessage: string,
  ) => {
    // Once submitted, a lost response must never leave stale controls enabled
    // or imply it is safe to retry a potentially completed host operation.
    const expectedState = operation === "stop" ? "stopped" : "running"
    const expectedRelease = operation === "deploy"
      ? (body as { release: string }).release
      : operation === "rollback" ? runtime?.previousGoodRelease : runtime?.activeRelease
    setApproved(false)
    setExecutionEnabled(false)
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
  return <BaseLayout title="Projects" description="PocketHost-owned Node.js projects and immutable source candidates.">
    <div className="space-y-5 px-4 pb-8 lg:px-6">
      <Card>
        <CardHeader><CardTitle>Create Node.js project</CardTitle>
          <CardDescription>Manage projects created in PocketHost.</CardDescription></CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <label className="grid min-w-52 gap-1 text-sm">Project name
            <Input aria-label="Project name" value={name} maxLength={60} onChange={event => setName(event.target.value)} />
          </label>
          <Button disabled={busy || catalogState !== "ready" || name.trim().length < 2} onClick={() => action(async () => {
            const data = await getJson(api + "/", "POST", { name: name.trim() })
            if (!validProject(data.project)) throw new Error("Invalid create response")
            setSelectedId(data.project.id); setName(""); setApproved(false)
            setRuntime(null); setPlan(null); setLogLines([]); setPreview(null)
            await refresh(); setReleases([]); await loadRuntime(data.project.id)
            setMessage("Private Node project created.")
          })}>Create project</Button>
          <Button variant="outline" disabled={busy} onClick={() => action(refresh)}>Refresh</Button>
          <Button variant="outline" disabled={busy || catalogState !== "ready"}
            onClick={() => action(async () => {
              const result = await getJson(api + "/toolchain")
              const tools = result.toolchain as Record<string, unknown> | undefined
              const version = (value: unknown) => value === null ||
                (typeof value === "string" && /^v?\d+\.\d+\.\d+$/.test(value))
              if (!tools || !version(tools.nodeVersion) || !version(tools.npmVersion))
                throw new Error("Invalid Node toolchain report")
              setNodeTools(tools as { nodeVersion: string | null; npmVersion: string | null })
            })}>Check Node tools</Button>
          <Button variant="outline" disabled={busy || catalogState !== "ready"} onClick={() => action(async () => {
            const response = await getJson(api + "/registry")
            const value = response.registries as Record<string, unknown> | undefined
            if (!value || !Array.isArray(value.modules) || value.modules.length > 32 ||
              !Array.isArray(value.services) || value.services.length > 64 ||
              !Array.isArray(value.projects) || value.projects.length > 64) {
              throw new Error("Invalid Hosting registry projection")
            }
            setRegistries({
              modules: value.modules.length,
              services: value.services.length,
              projects: value.projects.length,
            })
            setMessage("Read-only module, service and project declarations verified.")
          })}>Inspect hosting registries</Button>
          <Button variant="outline" disabled={busy || catalogState !== "ready"} onClick={() => action(async () => {
            const response = await getJson(api + "/backup")
            const value = response.backup as Record<string, unknown> | undefined
            if (!value || typeof value.initialized !== "boolean" ||
              typeof value.repositoryPresent !== "boolean" ||
              typeof value.keyPresent !== "boolean") {
              throw new Error("Invalid Node Restic state")
            }
            setBackupsEnabled(response.backupsEnabled === true)
            setBackupStatus({
              initialized: value.initialized,
              repositoryPresent: value.repositoryPresent,
              keyPresent: value.keyPresent,
            })
            setMessage("Owned Node Restic repository inspected without running backup.")
          })}>Inspect Node backups</Button>
        </CardContent>
      </Card>
      {catalogState === "disabled" && <p role="status" className="text-muted-foreground text-sm">{disabledMessage}</p>}
      {nodeTools && <p role="status" className="text-muted-foreground text-sm">
        Installed tools: Node {nodeTools.nodeVersion ?? "not detected"} · npm {nodeTools.npmVersion ?? "not detected"}
      </p>}
      {error && <p role="alert" className="text-destructive text-sm">{error}</p>}
      {message && <p role="status" className="text-sm">{message}</p>}
      {backupStatus && <Card>
        <CardHeader>
          <CardTitle>Scoped Node project backups</CardTitle>
          <CardDescription>Restic stores only PocketHost-created Node projects in a separate private repository. Restore never replaces live services.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm" aria-label="Node backup state">
            Scoped Node Restic: {backupStatus.initialized ? "initialized" : "not initialized"}.
            Mutations: {backupsEnabled ? "enabled for explicit approval" : "disabled"}.
          </p>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" aria-label="Approve Node Restic operation"
              checked={backupApproved} onChange={event => setBackupApproved(event.target.checked)} />
            I authorize a backup or staging-only restore of PocketHost-owned Node project data.
          </label>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" disabled={busy || !backupStatus.initialized}
              onClick={() => action(async () => {
                const result = await getJson(api + "/backup/snapshots")
                if (!Array.isArray(result.snapshots) || result.snapshots.length > 40 ||
                  !result.snapshots.every((snapshot) => {
                    if (!snapshot || typeof snapshot !== "object") return false
                    const row = snapshot as Record<string, unknown>
                    return typeof row.id === "string" && /^[a-f0-9]{64}$/.test(row.id) &&
                      typeof row.time === "string" && row.time.length <= 60
                  })) throw new Error("Invalid Node Restic snapshot inventory")
                setBackupSnapshots(result.snapshots as { id: string; time: string }[])
                setSelectedSnapshot("")
                setMessage("Owned Node backup snapshots refreshed.")
              })}>List Node snapshots</Button>
            <Button disabled={busy || !backupApproved || !backupsEnabled}
              onClick={() => action(async () => {
                await getJson(api + "/backup/create", "POST", { approved: true })
                const report = await getJson(api + "/backup")
                const backup = report.backup as { initialized?: unknown } | undefined
                if (!backup || backup.initialized !== true)
                  throw new Error("Backup completion not verified")
                setBackupStatus(backup as {
                  initialized: boolean; repositoryPresent: boolean; keyPresent: boolean
                })
                setBackupApproved(false)
                setMessage("Scoped encrypted Node backup completed; verify snapshots before restore.")
              })}>Create Node backup</Button>
          </div>
          <label className="grid gap-1 text-sm">Staging restore snapshot
            <select aria-label="Staging restore snapshot" className="w-full rounded-md border bg-background p-2"
              value={selectedSnapshot} onChange={event => setSelectedSnapshot(event.target.value)}>
              <option value="">Select a verified snapshot</option>
              {backupSnapshots.map(snapshot => <option key={snapshot.id} value={snapshot.id}>
                {snapshot.time} · {snapshot.id.slice(0, 12)}
              </option>)}
            </select>
          </label>
          <Button variant="outline" disabled={busy || !backupApproved || !backupsEnabled ||
              !selectedSnapshot}
            onClick={() => action(async () => {
              const response = await getJson(api + "/backup/restore", "POST", {
                approved: true, snapshot: selectedSnapshot,
              })
              if (response.restoredToStaging !== true ||
                  typeof response.verifiedProjects !== "number" ||
                  !Number.isSafeInteger(response.verifiedProjects) ||
                  response.verifiedProjects < 1 || response.verifiedProjects > 8)
                throw new Error("Unverified staging-only restore")
              setBackupApproved(false)
              setMessage("Verified " + response.verifiedProjects +
                " Node projects in private restore staging; no live source was replaced.")
            })}>Restore Node snapshot to staging</Button>
          {!backupsEnabled && <p className="text-xs text-muted-foreground">
            Backup mutations require an independent Node backup DEV feature flag.
          </p>}
        </CardContent>
      </Card>}
      {registries && <p className="text-muted-foreground text-sm" aria-label="Hosting registries">
        Modules: {registries.modules} · Services: {registries.services} · Projects: {registries.projects}.
        Declarations do not grant process ownership or lifecycle permission.
      </p>}
      {catalogState === "ready" && <Card><CardHeader><CardTitle>Owned projects</CardTitle>
        <CardDescription>Only user-created PocketHost Node projects appear here.</CardDescription></CardHeader>
        <CardContent>
          {projects.length === 0 ? <p className="text-muted-foreground text-sm">No Node projects yet.</p> :
          <div className="flex flex-wrap gap-2">{projects.map(project =>
            <Button key={project.id} variant={selectedId === project.id ? "default" : "outline"}
              disabled={busy} onClick={() => action(async () => {
                setSelectedId(project.id); setApproved(false)
                setRuntime(null); setPlan(null); setLogLines([]); setPreview(null)
                setManifest(examplePackage); setLockfile(exampleLock); setSource(exampleSource)
                setBuildCheck(null); setEditorDirty(false); setGithubReview(null)
                setDependencyReview(null)
                setGithubRepository("")
                await Promise.all([loadReleases(project.id), loadRuntime(project.id)])
              })}>{project.name}</Button>)}</div>}
        </CardContent>
      </Card>}
      {selected && catalogState === "ready" && <Card>
        <CardHeader><CardTitle>{selected.name}</CardTitle>
          <CardDescription>Source: {selected.state} · Runtime: {runtime?.state ?? "unverified"} · Active release: {runtime?.activeRelease ?? "none"}</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground text-sm">Release candidates are private until explicitly deployed. The initial Node runtime supports dependency-free, no-build services on loopback through Termux runit; /__pockethost/ready must echo the private X-PocketHost-Ready nonce. No public routes or automatic startup.</p>
          <div className="flex flex-wrap items-end gap-2">
            <label className="grid min-w-56 flex-1 gap-1 text-sm">Public GitHub repository
              <Input aria-label="Public GitHub repository" placeholder="owner/repository"
                value={githubRepository} maxLength={150}
                onChange={event => {
                  setGithubRepository(event.target.value)
                  setGithubReview(null)
                }} />
            </label>
            <Button variant="outline" disabled={busy || !githubRepository.trim()}
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
                })
                setManifest(JSON.stringify(contents.packageJson, null, 2))
                setLockfile(JSON.stringify(contents.packageLock, null, 2))
                setSource(contents.serverSource)
                setApproved(false); setBuildCheck(null); setPlan(null); setPreview(null)
                setDependencyReview(null)
                setExecutionEnabled(false); setEditorDirty(true)
                setMessage("GitHub commit " + data.commit.slice(0, 12) +
                  " contains changes. Review and stage to preserve the previous release.")
              })}>{selected.candidateRelease ? "Check GitHub updates" : "Load GitHub source"}</Button>
          </div>
          {githubReview && <p className="text-muted-foreground text-xs"
            aria-label="GitHub source changes">
            {githubReview.repository} @ {githubReview.commit.slice(0, 12)} · Changed: {githubReview.changed.join(", ")} · Dependencies: {githubReview.dependencies} · Build: {githubReview.buildRequired ? "required" : "none"}
            {(githubReview.dependencies > 0 || githubReview.buildRequired) &&
              " · Staging only; package installation/build requires separate approval."}
          </p>}
          <label className="grid gap-1 text-sm">Load local Node files
            <input type="file" aria-label="Load local Node files" multiple accept=".json,.mjs"
              disabled={busy} className="w-full rounded-md border bg-background p-2 text-sm"
              onChange={event => {
                const picked = Array.from(event.currentTarget.files ?? [])
                event.currentTarget.value = ""
                if (!picked.length) return
                action(async () => {
                  const files = await readLocalNodeFiles(picked)
                  setManifest(files.manifest)
                  setLockfile(files.lockfile)
                  setSource(files.source)
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
          <label className="grid gap-1 text-sm">package.json
            <textarea aria-label="package.json" className="w-full rounded-md border bg-background p-3 font-mono text-xs" rows={8}
              value={manifest} onChange={event => { setManifest(event.target.value); setEditorDirty(true); setApproved(false); setGithubReview(null); setDependencyReview(null) }} /></label>
          <label className="grid gap-1 text-sm">package-lock.json
            <textarea aria-label="package-lock.json" className="w-full rounded-md border bg-background p-3 font-mono text-xs" rows={8}
              value={lockfile} onChange={event => { setLockfile(event.target.value); setEditorDirty(true); setApproved(false); setGithubReview(null); setDependencyReview(null) }} /></label>
          <label className="grid gap-1 text-sm">server.mjs
            <textarea aria-label="server.mjs" className="w-full rounded-md border bg-background p-3 font-mono text-xs" rows={8}
              value={source} onChange={event => { setSource(event.target.value); setEditorDirty(true); setApproved(false); setGithubReview(null); setDependencyReview(null) }} /></label>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" disabled={busy || !selected.candidateRelease}
              onClick={() => action(async () => {
                const response = await getJson(api + "/" + selected.id + "/source")
                const value = response.source as Record<string, unknown> | undefined
                if (!value || value.release !== selected.candidateRelease ||
                  typeof value.manifest !== "string" || value.manifest.length > 140000 ||
                  typeof value.lockfile !== "string" || value.lockfile.length > 140000 ||
                  typeof value.serverSource !== "string" || value.serverSource.length > 65536)
                  throw new Error("Invalid verified candidate source")
                setManifest(value.manifest); setLockfile(value.lockfile)
                setSource(value.serverSource); setApproved(false)
                setBuildCheck(null); setPreview(null); setEditorDirty(false); setGithubReview(null)
                setDependencyReview(null)
                setMessage("Verified staged source loaded into editor; no process changed.")
              })}>Load staged source</Button>
            <Button disabled={busy || (!!selected.candidateRelease && !editorDirty)}
              onClick={() => action(async () => {
              const data = await getJson(api + "/" + selected.id + "/stage", "POST", {
                packageJson: JSON.parse(manifest) as unknown,
                packageLock: JSON.parse(lockfile) as unknown,
                serverSource: source,
                expectedCandidate: selected.candidateRelease,
                expectedRevision: selected.deploymentCount,
              })
              if (!validProject(data.project)) throw new Error("Invalid stage response")
              await refresh()
              await Promise.all([loadReleases(selected.id), loadRuntime(selected.id)])
              setApproved(false); setBuildCheck(null); setEditorDirty(false); setGithubReview(null)
              setMessage(data.unchanged === true
                ? "Source matches the current verified candidate. No new release created."
                : "Source candidate staged. Review the execution plan before deploying.")
            })}>Validate and stage source</Button>
            <Button variant="outline" disabled={busy || !selected.previousCandidate}
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
          <Card>
            <CardHeader><CardTitle>Node deployment</CardTitle>
              <CardDescription>Review the execution plan and authorize a one-shot local runit operation.</CardDescription></CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm">Plan: {plan?.reason ?? "not checked"} · Dependencies: {plan?.dependencyCount ?? "unknown"} · Port: {runtime?.port ?? "not allocated"} · Node: {plan?.nodeVersion ?? "unknown"} · npm: {plan?.npmVersion ?? "unknown"}</p>
              {plan && (plan.missingTools.length > 0 || plan.conflicts.length > 0 ||
                  (plan.dependencyIssues?.length ?? 0) > 0) &&
                <p role="alert" className="text-sm text-destructive">{[
                  ...plan.missingTools, ...plan.conflicts, ...(plan.dependencyIssues ?? []),
                ].join(", ")}</p>}
              {dependencyReview && <p className="text-muted-foreground text-xs"
                aria-label="Node dependency setup">
                Setup: {dependencyReview.status} · Dependencies: {dependencyReview.dependencyCount} ·
                Install: {dependencyReview.installRequired ? dependencyReview.installCommand?.join(" ") : "not required"} ·
                Build: {dependencyReview.buildRequired ? dependencyReview.buildCommand?.join(" ") : "not required"} ·
                Blockers: {dependencyReview.blockers.length ? dependencyReview.blockers.join(", ") : "none"} ·
                {dependencyReview.status === "prepared"
                  ? " Installed package bytes verified; no npm command executed during this review."
                  : " Not executed; installation/build requires separate approval."}
              </p>}
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" aria-label="Approve local Node execution" checked={approved}
                  onChange={event => setApproved(event.target.checked)} />
                I authorize this PocketHost-owned Node service to run on this Termux host.
              </label>
              <div className="flex flex-wrap gap-2">
                <Button disabled={busy} variant="outline" onClick={() => action(async () => {
                  await loadRuntime(selected.id); setMessage("Runtime status and plan refreshed.")
                })}>Review plan</Button>
                <Button variant="outline" disabled={busy || editorDirty || !selected.candidateRelease}
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
                          review.installCommand.join(" ") !==
                            "npm ci --ignore-scripts --no-bin-links --no-audit --no-fund --omit=dev")) ||
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
                <Button variant="outline" disabled={busy || editorDirty || !dependencyApproved ||
                  !dependencyInstallEnabled || !selected.candidateRelease ||
                  dependencyReview?.release !== selected.candidateRelease ||
                  dependencyReview.status !== "review-required" || !dependencyReview.installRequired ||
                  dependencyReview.buildRequired || dependencyReview.blockers.length > 0}
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
                    setMessage("Owned Node packages installed and SHA-256 integrity verified. Review deploy plan.")
                  })}>Install approved dependencies</Button>
                <Button disabled={busy || editorDirty || !plan?.allowed || !selected.candidateRelease}
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
                <Button disabled={busy || editorDirty || !approved || !executionEnabled ||
                  !plan?.allowed || !selected.candidateRelease ||
                  plan.release !== selected.candidateRelease ||
                  runtime?.activeRelease === selected.candidateRelease}
                  onClick={() => action(async () => {
                    await runRuntimeAction(selected.id, "deploy",
                      { approved: true, release: selected.candidateRelease },
                      "Owned Node release started and readiness verified by host.")
                  })}>{runtime?.activeRelease ? "Publish update" : "Deploy selected release"}</Button>
                <Button variant="outline" disabled={busy || !approved || !executionEnabled ||
                  runtime?.state !== "stopped" || !runtime.activeRelease ||
                  runtime.activeRelease !== runtime.lastGoodRelease}
                  onClick={() => action(async () => {
                    await runRuntimeAction(selected.id, "start", { approved: true },
                      "Previously verified Node release started and readiness confirmed.")
                  })}>Start stopped service</Button>
                <Button variant="outline" disabled={busy || !approved || !executionEnabled ||
                  !runtime?.previousGoodRelease || runtime.state === "unknown"}
                  onClick={() => action(async () => {
                    await runRuntimeAction(selected.id, "rollback", { approved: true },
                      "Previous verified Node release restored by host.")
                  })}>Rollback active release</Button>
                <Button variant="outline" disabled={busy || !approved || !executionEnabled || runtime?.state !== "running"}
                  onClick={() => action(async () => {
                    await runRuntimeAction(selected.id, "stop", { approved: true },
                      "Owned Node service stopped.")
                  })}>Stop owned service</Button>
                <Button variant="outline" disabled={busy || !approved || !executionEnabled ||
                  runtime?.state !== "running" || !runtime.activeRelease ||
                  runtime.activeRelease !== runtime.lastGoodRelease}
                  onClick={() => action(async () => {
                    await runRuntimeAction(selected.id, "restart", { approved: true },
                      "Owned Node service restarted and readiness verified.")
                  })}>Restart service</Button>
                <Button variant="outline" disabled={busy} onClick={() => action(async () => {
                  const response = await getJson(api + "/" + selected.id + "/health")
                  const value = response.health as Record<string, unknown> | undefined
                  if (!value || !["not-provisioned", "stopped", "running", "unknown"].includes(String(value.state)) ||
                    (value.ready !== null && typeof value.ready !== "boolean") ||
                    (value.release !== null && (typeof value.release !== "string" ||
                      !/^r-[a-f0-9]{32}$/.test(value.release))))
                    throw new Error("Invalid owned Node health response")
                  setHealth(value as NodeHealth)
                  setMessage("Current Node readiness checked against verified local ownership.")
                })}>Check live readiness</Button>
                <Button variant="outline" disabled={busy || runtime?.state !== "running"}
                  onClick={() => action(async () => {
                    const response = await getJson(api + "/" + selected.id + "/preview")
                    const value = response.preview as Record<string, unknown> | undefined
                    if (!value || typeof value.release !== "string" ||
                      !/^r-[a-f0-9]{32}$/.test(value.release) ||
                      typeof value.body !== "string" || value.body.length > 8192)
                      throw new Error("Invalid private Node preview response")
                    setPreview({ release: value.release, body: value.body })
                    setMessage("Private loopback response inspected as plain text, not published.")
                  })}>Preview local response</Button>
                <Button variant="outline" disabled={busy} onClick={() => action(async () => {
                  const response = await getJson(api + "/" + selected.id + "/logs")
                  const logs = response.logs as { lines?: unknown } | undefined
                  if (!Array.isArray(logs?.lines) || !logs.lines.every(x => typeof x === "string"))
                    throw new Error("Invalid bounded service logs")
                  setLogLines(logs.lines); setMessage("Bounded runit logs loaded.")
                })}>View logs</Button>
              </div>
              {buildCheck && <p className="text-muted-foreground text-xs" role="status">
                Candidate syntax: {buildCheck.status} · No project code executed.
              </p>}
              {!executionEnabled && <p className="text-xs text-muted-foreground">
                Execution is disabled until the separate Node runtime DEV feature flag is explicitly enabled.
              </p>}
              {health && <p className="text-sm" aria-label="Node live health">
                Live health: {health.state} · HTTP readiness: {health.ready === null ? "not probed" : health.ready ? "ready" : "not ready"}.
              </p>}
              <p className="text-sm">Last good: {runtime?.lastGoodRelease ?? "none"} · Previous good: {runtime?.previousGoodRelease ?? "none"} · Desired: {runtime?.desired ?? "unknown"}</p>
              <p className="text-muted-foreground text-xs">Health policy (read-only): {runtime?.healthDecision?.reason ?? "not checked"}.
                No automatic restart is authorized.
              </p>
              {runtime?.history?.length ? <div className="space-y-1 text-xs">
                {runtime.history.slice(-8).reverse().map((event, i) =>
                  <p key={event.at + i}>{event.at} · {event.action} · {event.release}</p>)}
              </div> : null}
              {preview && <pre aria-label="Local Node response" className="max-h-48 overflow-auto whitespace-pre-wrap rounded-md border p-3 text-xs">
                {preview.body}
              </pre>}
              {logLines.length > 0 && <pre aria-label="Node runit logs" className="max-h-52 overflow-auto whitespace-pre-wrap rounded-md border p-3 text-xs">
                {logLines.join("\n")}
              </pre>}
            </CardContent>
          </Card>
          <p className="text-sm">Current candidate: {selected.candidateRelease ?? "none"} · Previous: {selected.previousCandidate ?? "none"}</p>
          <div aria-label="Source candidates" className="space-y-2 text-sm">
            {releases.map(release => <div key={release.id} className="rounded-md border p-3">
              {release.id} {release.candidate ? "(selected candidate)" : release.previousCandidate ? "(rollback source)" : "(archived)"}
              <p className="text-muted-foreground">Manifest {release.dependencyPlan.packageName}@{release.dependencyPlan.packageVersion} · {release.dependencyPlan.dependencyCount} dependencies · review required</p>
            </div>)}
          </div>
        </CardContent>
      </Card>}
    </div>
  </BaseLayout>
}
