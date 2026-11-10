import * as React from "react"
import { BaseLayout } from "@/components/layouts/base-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

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
  history: { at: string; action: string; release: string }[]
}
type RuntimePlan = {
  release: string | null
  port: number | null
  missingTools: string[]
  conflicts: string[]
  dependencyCount: number | null
  allowed: boolean
  reason: string
}
type Candidate = {
  id: string
  active: false
  candidate: boolean
  previousCandidate: boolean
  dependencyPlan: { packageName: string; packageVersion: string; dependencyCount: number; status: "review-required" }
}
const api = "/api/v1/node-projects"
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
  if (!response.ok) throw new Error(response.status === 404 ? "Node Hosting is disabled on this DEV panel." :
    response.status === 400 ? "Invalid project input, manifest, lockfile or source." : "Operation refused by the private host.")
  const value: unknown = await response.json()
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid host response")
  return value as Record<string, unknown>
}
export default function ProjectsPage() {
  const [projects, setProjects] = React.useState<Project[]>([])
  const [selectedId, setSelectedId] = React.useState("")
  const [name, setName] = React.useState("")
  const [manifest, setManifest] = React.useState(examplePackage)
  const [lockfile, setLockfile] = React.useState(exampleLock)
  const [source, setSource] = React.useState(exampleSource)
  const [releases, setReleases] = React.useState<Candidate[]>([])
  const [runtime, setRuntime] = React.useState<RuntimeState | null>(null)
  const [plan, setPlan] = React.useState<RuntimePlan | null>(null)
  const [executionEnabled, setExecutionEnabled] = React.useState(false)
  const [approved, setApproved] = React.useState(false)
  const [logLines, setLogLines] = React.useState<string[]>([])
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [message, setMessage] = React.useState<string | null>(null)
  const selected = projects.find((project) => project.id === selectedId)
  const refresh = React.useCallback(async () => {
    const data = await getJson(api)
    if (!Array.isArray(data.projects) || !data.projects.every(validProject)) throw new Error("Invalid Node project registry response")
    setProjects(data.projects)
  }, [])
  const loadReleases = React.useCallback(async (id: string) => {
    const data = await getJson(api + "/" + id + "/releases")
    if (!Array.isArray(data.releases)) throw new Error("Invalid release inventory")
    setReleases(data.releases as Candidate[])
  }, [])
  const loadRuntime = React.useCallback(async (id: string) => {
    const [status, preview] = await Promise.all([
      getJson(api + "/" + id + "/runtime"), getJson(api + "/" + id + "/plan"),
    ])
    if (!status.runtime || !preview.plan) throw new Error("Invalid Node runtime report")
    setRuntime(status.runtime as RuntimeState)
    setPlan(preview.plan as RuntimePlan)
    setExecutionEnabled(status.executionEnabled === true && preview.executionEnabled === true)
  }, [])
  React.useEffect(() => {
    let live = true
    void Promise.resolve().then(() => getJson(api)).then(data => {
      if (!live) return
      if (!Array.isArray(data.projects) || !data.projects.every(validProject)) throw new Error("Invalid project registry")
      setProjects(data.projects)
    }).catch(cause => { if (live) setError(cause instanceof Error ? cause.message : "Project catalog unavailable") })
    return () => { live = false }
  }, [])
  const action = (fn: () => Promise<void>) => {
    setBusy(true); setError(null); setMessage(null)
    void fn().catch(cause => setError(cause instanceof Error ? cause.message : "Operation rejected"))
      .finally(() => setBusy(false))
  }
  return <BaseLayout title="Projects" description="PocketHost-owned Node.js projects and immutable source candidates.">
    <div className="space-y-5 px-4 pb-8 lg:px-6">
      <Card>
        <CardHeader><CardTitle>Create Node.js project</CardTitle>
          <CardDescription>Creates only private PocketHost metadata. It cannot adopt existing services.</CardDescription></CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <label className="grid min-w-52 gap-1 text-sm">Project name
            <Input aria-label="Project name" value={name} maxLength={60} onChange={event => setName(event.target.value)} />
          </label>
          <Button disabled={busy || name.trim().length < 2} onClick={() => action(async () => {
            const data = await getJson(api + "/", "POST", { name: name.trim() })
            if (!validProject(data.project)) throw new Error("Invalid create response")
            setSelectedId(data.project.id); setName(""); setApproved(false)
            setRuntime(null); setPlan(null); setLogLines([])
            await refresh(); setReleases([]); await loadRuntime(data.project.id)
            setMessage("Private Node project created.")
          })}>Create project</Button>
          <Button variant="outline" disabled={busy} onClick={() => action(refresh)}>Refresh</Button>
        </CardContent>
      </Card>
      {error && <p role="alert" className="text-destructive text-sm">{error}</p>}
      {message && <p role="status" className="text-sm">{message}</p>}
      <Card><CardHeader><CardTitle>Owned projects</CardTitle>
        <CardDescription>Only user-created PocketHost Node projects appear here.</CardDescription></CardHeader>
        <CardContent>
          {projects.length === 0 ? <p className="text-muted-foreground text-sm">No Node projects yet.</p> :
          <div className="flex flex-wrap gap-2">{projects.map(project =>
            <Button key={project.id} variant={selectedId === project.id ? "default" : "outline"}
              disabled={busy} onClick={() => action(async () => {
                setSelectedId(project.id); setApproved(false)
                setRuntime(null); setPlan(null); setLogLines([])
                await Promise.all([loadReleases(project.id), loadRuntime(project.id)])
              })}>{project.name}</Button>)}</div>}
        </CardContent>
      </Card>
      {selected && <Card>
        <CardHeader><CardTitle>{selected.name}</CardTitle>
          <CardDescription>Source: {selected.state} · Runtime: {runtime?.state ?? "unverified"} · Active release: {runtime?.activeRelease ?? "none"}</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground text-sm">Release candidates are private until explicitly deployed. The initial Node runtime supports dependency-free, no-build services on loopback through Termux runit; no public routes or automatic startup.</p>
          <label className="grid gap-1 text-sm">package.json
            <textarea aria-label="package.json" className="w-full rounded-md border bg-background p-3 font-mono text-xs" rows={8}
              value={manifest} onChange={event => setManifest(event.target.value)} /></label>
          <label className="grid gap-1 text-sm">package-lock.json
            <textarea aria-label="package-lock.json" className="w-full rounded-md border bg-background p-3 font-mono text-xs" rows={8}
              value={lockfile} onChange={event => setLockfile(event.target.value)} /></label>
          <label className="grid gap-1 text-sm">server.mjs
            <textarea aria-label="server.mjs" className="w-full rounded-md border bg-background p-3 font-mono text-xs" rows={8}
              value={source} onChange={event => setSource(event.target.value)} /></label>
          <div className="flex flex-wrap gap-2">
            <Button disabled={busy} onClick={() => action(async () => {
              const data = await getJson(api + "/" + selected.id + "/stage", "POST", {
                packageJson: JSON.parse(manifest) as unknown,
                packageLock: JSON.parse(lockfile) as unknown,
                serverSource: source,
              })
              if (!validProject(data.project)) throw new Error("Invalid stage response")
              await refresh()
              await Promise.all([loadReleases(selected.id), loadRuntime(selected.id)])
              setApproved(false)
              setMessage("Source candidate staged. Review the execution plan before deploying.")
            })}>Validate and stage source</Button>
            <Button variant="outline" disabled={busy || !selected.previousCandidate}
              onClick={() => action(async () => {
                const data = await getJson(api + "/" + selected.id + "/restore-candidate", "POST")
                if (!validProject(data.project)) throw new Error("Invalid restore response")
                await refresh()
                await Promise.all([loadReleases(selected.id), loadRuntime(selected.id)])
                setApproved(false)
                setMessage("Previous source candidate restored. No live process was changed.")
              })}>Restore previous candidate</Button>
          </div>
          <Card>
            <CardHeader><CardTitle>Node deployment</CardTitle>
              <CardDescription>Review the execution plan and authorize a one-shot local runit operation.</CardDescription></CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm">Plan: {plan?.reason ?? "not checked"} · Dependencies: {plan?.dependencyCount ?? "unknown"} · Port: {runtime?.port ?? "not allocated"}</p>
              {plan && (plan.missingTools.length > 0 || plan.conflicts.length > 0) &&
                <p role="alert" className="text-sm text-destructive">{[...plan.missingTools, ...plan.conflicts].join(", ")}</p>}
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" aria-label="Approve local Node execution" checked={approved}
                  onChange={event => setApproved(event.target.checked)} />
                I authorize this project's staged Node source to run on this Termux host.
              </label>
              <div className="flex flex-wrap gap-2">
                <Button disabled={busy} variant="outline" onClick={() => action(async () => {
                  await loadRuntime(selected.id); setMessage("Runtime status and plan refreshed.")
                })}>Review plan</Button>
                <Button disabled={busy || !approved || !executionEnabled || !plan?.allowed || !selected.candidateRelease}
                  onClick={() => action(async () => {
                    await getJson(api + "/" + selected.id + "/deploy", "POST",
                      { approved: true, release: selected.candidateRelease })
                    await loadRuntime(selected.id); setApproved(false)
                    setMessage("Owned Node release started and readiness verified by host.")
                  })}>Deploy selected release</Button>
                <Button variant="outline" disabled={busy || !approved || !executionEnabled || runtime?.state !== "running"}
                  onClick={() => action(async () => {
                    await getJson(api + "/" + selected.id + "/stop", "POST", { approved: true })
                    await loadRuntime(selected.id); setApproved(false)
                    setMessage("Owned Node service stopped.")
                  })}>Stop owned service</Button>
                <Button variant="outline" disabled={busy} onClick={() => action(async () => {
                  const response = await getJson(api + "/" + selected.id + "/logs")
                  const logs = response.logs as { lines?: unknown } | undefined
                  if (!Array.isArray(logs?.lines) || !logs.lines.every(x => typeof x === "string"))
                    throw new Error("Invalid bounded service logs")
                  setLogLines(logs.lines); setMessage("Bounded runit logs loaded.")
                })}>View logs</Button>
              </div>
              {!executionEnabled && <p className="text-xs text-muted-foreground">
                Execution is disabled until the separate Node runtime DEV feature flag is explicitly enabled.
              </p>}
              <p className="text-sm">Last good: {runtime?.lastGoodRelease ?? "none"} · Desired: {runtime?.desired ?? "unknown"}</p>
              {runtime?.history?.length ? <div className="space-y-1 text-xs">
                {runtime.history.slice(-8).reverse().map((event, i) =>
                  <p key={event.at + i}>{event.at} · {event.action} · {event.release}</p>)}
              </div> : null}
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
