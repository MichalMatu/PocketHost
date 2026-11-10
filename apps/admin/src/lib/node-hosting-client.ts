/** Read-only, bounded Node Hosting DEV API client shared by project history and logs. */
const API = "/api/v1/node-projects"
const ID = /^node-[a-f0-9]{32}$/
const RELEASE = /^r-[a-f0-9]{32}$/

export interface NodeProjectEntry {
  id: string
  name: string
}
export interface NodeHistoryEntry {
  at: string
  action: "start" | "update" | "stop" | "failed" | "rollback"
  release: string
}
export interface NodeRuntimeEntry extends NodeProjectEntry {
  state: "not-provisioned" | "stopped" | "running" | "unknown"
  activeRelease: string | null
  lastGoodRelease: string | null
  previousGoodRelease: string | null
  history: NodeHistoryEntry[]
}
export interface NodeCatalog {
  enabled: boolean
  projects: NodeProjectEntry[]
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Invalid Node Hosting response")
  return value as Record<string, unknown>
}
function release(value: unknown): value is string | null {
  return value === null || (typeof value === "string" && RELEASE.test(value))
}
async function get(path: string, signal?: AbortSignal): Promise<unknown> {
  const response = await fetch(API + path, {
    credentials: "same-origin",
    cache: "no-store",
    signal,
  })
  if (!response.ok) throw new Error("Owned Node Hosting API unavailable")
  return response.json() as Promise<unknown>
}
export async function readNodeCatalog(signal?: AbortSignal): Promise<NodeCatalog> {
  const response = await fetch(API, {
    credentials: "same-origin",
    cache: "no-store",
    signal,
  })
  if (response.status === 404) return { enabled: false, projects: [] }
  if (!response.ok) throw new Error("Owned Node project catalog unavailable")
  const value = object(await response.json() as unknown)
  if (!Array.isArray(value.projects) || value.projects.length > 8)
    throw new Error("Untrusted Node project inventory")
  const projects = value.projects.map((item: unknown) => {
    const project = object(item)
    if (typeof project.id !== "string" || !ID.test(project.id) ||
      typeof project.name !== "string" || project.name.length < 2 ||
      project.name.length > 60 || project.kind !== "node")
      throw new Error("Invalid owned Node identity")
    return { id: project.id, name: project.name }
  })
  if (new Set(projects.map((p) => p.id)).size !== projects.length)
    throw new Error("Duplicate Node project identity")
  return { enabled: true, projects }
}
export async function readNodeRuntime(id: string, signal?: AbortSignal): Promise<NodeRuntimeEntry> {
  if (!ID.test(id)) throw new Error("Invalid Node project ID")
  const raw = object(await get("/" + id + "/runtime", signal))
  const data = object(raw.runtime)
  if (!["not-provisioned", "stopped", "running", "unknown"].includes(String(data.state)) ||
    !release(data.activeRelease) || !release(data.lastGoodRelease) ||
    !release(data.previousGoodRelease) ||
    !Array.isArray(data.history) || data.history.length > 24) {
    throw new Error("Invalid Node runtime report")
  }
  const history = data.history.map((item: unknown) => {
    const entry = object(item)
    if (typeof entry.at !== "string" || entry.at.length > 60 ||
      !Number.isFinite(Date.parse(entry.at)) ||
      !["start", "update", "stop", "failed", "rollback"].includes(String(entry.action)) ||
      typeof entry.release !== "string" || !RELEASE.test(entry.release)) {
      throw new Error("Invalid Node deployment journal")
    }
    return entry as unknown as NodeHistoryEntry
  })
  return {
    id,
    name: id,
    state: data.state as NodeRuntimeEntry["state"],
    activeRelease: data.activeRelease,
    lastGoodRelease: data.lastGoodRelease,
    previousGoodRelease: data.previousGoodRelease,
    history,
  }
}
export async function readNodeRuntimeCatalog(signal?: AbortSignal): Promise<{
  enabled: boolean
  projects: NodeRuntimeEntry[]
}> {
  const catalog = await readNodeCatalog(signal)
  if (!catalog.enabled) return { enabled: false, projects: [] }
  const projects = await Promise.all(catalog.projects.map(async (project) => {
    const runtime = await readNodeRuntime(project.id, signal)
    return { ...runtime, name: project.name }
  }))
  return { enabled: true, projects }
}
export async function readNodeLogs(id: string, signal?: AbortSignal): Promise<string[]> {
  if (!ID.test(id)) throw new Error("Invalid Node project ID")
  const data = object(await get("/" + id + "/logs", signal))
  const lines = object(data.logs).lines
  if (!Array.isArray(lines) || lines.length > 100 ||
    !lines.every((line) => typeof line === "string" && line.length <= 240))
    throw new Error("Invalid owned Node runtime logs")
  return lines as string[]
}
