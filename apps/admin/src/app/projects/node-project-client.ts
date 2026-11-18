/** Browser-only Node project contracts, source validation and owner-gated API transport. */
export function validatedExtras(input: unknown): Record<string, string> {
  if (input === undefined) return {}
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new Error("Invalid imported frontend file list")
  const result: Record<string, string> = {}
  const names = Object.keys(input).sort()
  if (names.length > 32) throw new Error("Frontend source file budget exceeded")
  let bytes = 0
  for (const name of names) {
    const content = (input as Record<string, unknown>)[name]
    if (name.length > 160 || !(
      /^(?:src|public)\/(?:[A-Za-z0-9_-]+\/){0,6}[A-Za-z0-9_-][A-Za-z0-9._-]{0,79}\.(?:js|jsx|ts|tsx|css|html|json|svg|txt|md)$/.test(name) ||
      /^(?:index\.html|vite\.config\.(?:js|mjs|ts)|tsconfig(?:\.[a-z0-9_-]+)?\.json|postcss\.config\.(?:js|cjs)|tailwind\.config\.(?:js|ts))$/.test(name)
    ) || typeof content !== "string" || !content.trim() || content.includes("\0") ||
       new Blob([content]).size > 32 * 1024)
      throw new Error("Invalid imported frontend source file")
    bytes += new Blob([name, content]).size
    if (bytes > 96 * 1024) throw new Error("Frontend source exceeds 96 KB")
    result[name] = content
  }
  return result
}

export function validatedAssets(input: unknown): Record<string, string> {
  if (input === undefined) return {}
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new Error("Invalid frontend binary assets")
  const names = Object.keys(input).sort()
  if (names.length > 12) throw new Error("Frontend binary asset limit exceeded")
  const out: Record<string, string> = {}
  let total = 0
  for (const name of names) {
    const value = (input as Record<string, unknown>)[name]
    if (name.length > 160 ||
      !/^(?:public|src\/assets)\/(?:[A-Za-z0-9_-]+\/){0,5}[A-Za-z0-9_-][A-Za-z0-9._-]{0,79}\.(?:png|jpg|jpeg|webp|gif|ico|woff2)$/.test(name) ||
      typeof value !== "string" || value.length < 16 ||
      value.length > Math.ceil(128 * 1024 / 3) * 4 + 4 ||
      !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value))
      throw new Error("Invalid frontend binary asset path or encoding")
    const bytes = Math.floor(value.length * 3 / 4) -
      (value.endsWith("==") ? 2 : value.endsWith("=") ? 1 : 0)
    if (bytes < 12 || bytes > 128 * 1024) throw new Error("Invalid binary asset size")
    total += bytes
    if (total > 512 * 1024) throw new Error("Frontend binary assets exceed 512 KB")
    out[name] = value
  }
  return out
}

export type Project = {
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
export type RuntimeState = {
  state: "not-provisioned" | "running" | "stopped" | "unknown"
  port: number | null
  desired: "running" | "stopped"
  activeRelease: string | null
  lastGoodRelease: string | null
  previousGoodRelease: string | null
  history: { at: string; action: string; release: string }[]
  healthDecision?: { action: string; reason: string; nextEligibleAtMs: number | null }
}
export type RuntimePlan = {
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
export type NodeHealth = {
  state: "not-provisioned" | "stopped" | "running" | "unknown"
  release: string | null
  ready: boolean | null
}
export type DependencyReview = {
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
export type BuildReview = {
  release: string
  status: "not-required" | "requires-dependencies" | "ready-to-build" | "verified" | "blocked"
  buildRequired: boolean
  script: string | null
  dependencyCount: number
  dependenciesPrepared: boolean
  artifactVerified: boolean
  artifact?: { entries: number; bytes: number; files: string[]; truncated: boolean } | null
  blockers: string[]
}
export type RollbackPreflight = {
  release: string | null
  allowed: boolean
  reason: string
}
export type Candidate = {
  id: string
  active: false
  candidate: boolean
  previousCandidate: boolean
  dependencyPlan: { packageName: string; packageVersion: string; dependencyCount: number; status: "review-required" }
}
export const api = "/api/v1/node-projects"
export const disabledMessage = "Node Hosting is not enabled on this panel."
export const intent = "owned-node-project"
export const examplePackage = JSON.stringify({
  name: "my-node-site", version: "1.0.0", type: "module",
  scripts: { start: "node server.mjs" },
}, null, 2)
export const exampleLock = JSON.stringify({
  name: "my-node-site", version: "1.0.0", lockfileVersion: 3,
  packages: { "": { name: "my-node-site", version: "1.0.0" } },
}, null, 2)
export const exampleSource = [
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

export function validProject(value: unknown): value is Project {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const item = value as Partial<Project>
  return typeof item.id === "string" && /^node-[a-f0-9]{32}$/.test(item.id) &&
    typeof item.name === "string" && item.kind === "node" &&
    ["created", "source-staged"].includes(item.state ?? "") &&
    item.runtime === "not-provisioned" && item.activeRelease === null &&
    (item.candidateRelease === null || (typeof item.candidateRelease === "string" && /^r-[a-f0-9]{32}$/.test(item.candidateRelease))) &&
    (item.previousCandidate === null || (typeof item.previousCandidate === "string" && /^r-[a-f0-9]{32}$/.test(item.previousCandidate)))
}
export async function requestJson(url: string, method?: "POST", body?: unknown, ownerToken = ""): Promise<Record<string, unknown>> {
  const ownerHeader: Record<string, string> = ownerToken ? { "X-PocketHost-Node-Owner": ownerToken } : {}
  const response = await fetch(url, { credentials: "same-origin", cache: "no-store",
    headers: ownerHeader,
    ...(method ? {
      method, headers: { ...ownerHeader, "X-PocketHost-Intent": intent,
        ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    } : {}) })
  if (!response.ok) throw new Error(response.status === 404 && url === api ? disabledMessage :
    response.status === 404 ? "Node project resource not found." :
    response.status === 403 ? "Owner authentication required or Node access denied." :
    response.status === 400 ? "Invalid project input, manifest, lockfile or source." :
    response.status === 409 && (url.endsWith("/stage") || url.endsWith("/restore-candidate"))
      ? "Node source save refused. Refresh project and review the current candidate."
      : method ? "Operation refused by the private host." : "Could not load Node projects. Try Refresh.")
  const value: unknown = await response.json()
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid host response")
  return value as Record<string, unknown>
}
