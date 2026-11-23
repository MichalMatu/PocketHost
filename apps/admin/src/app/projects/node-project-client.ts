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
/** Validate the owned runit runtime report before the UI renders history or release controls. */
export function parseRuntimeState(value: unknown): RuntimeState {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Invalid Node runtime report")
  const runtime = value as Record<string, unknown>
  const release = (input: unknown) =>
    input === null || (typeof input === "string" && /^r-[a-f0-9]{32}$/.test(input))
  const history = runtime.history === undefined ? [] : runtime.history
  if (typeof runtime.state !== "string" ||
      !["not-provisioned", "stopped", "running", "unknown"].includes(runtime.state) ||
      typeof runtime.desired !== "string" ||
      !["stopped", "running"].includes(runtime.desired) ||
      !release(runtime.activeRelease) ||
      (runtime.lastGoodRelease !== undefined && !release(runtime.lastGoodRelease)) ||
      (runtime.previousGoodRelease !== undefined && !release(runtime.previousGoodRelease)) ||
      (runtime.port !== null && runtime.port !== undefined &&
       (!Number.isSafeInteger(runtime.port) || (runtime.port as number) < 1024 ||
        (runtime.port as number) > 65535)) ||
      !Array.isArray(history) || history.length > 24 ||
      !history.every(entry => entry && typeof entry === "object" && !Array.isArray(entry) &&
        typeof entry.at === "string" && Number.isFinite(Date.parse(entry.at)) &&
        ["start", "update", "stop", "failed", "rollback"].includes(entry.action) &&
        typeof entry.release === "string" && /^r-[a-f0-9]{32}$/.test(entry.release)))
    throw new Error("Invalid Node runtime state")
  const decision = runtime.healthDecision
  if (decision !== undefined &&
      (!decision || typeof decision !== "object" || Array.isArray(decision) ||
       typeof (decision as Record<string, unknown>).action !== "string" ||
       typeof (decision as Record<string, unknown>).reason !== "string" ||
       ((decision as Record<string, unknown>).nextEligibleAtMs !== null &&
        (!Number.isSafeInteger((decision as Record<string, unknown>).nextEligibleAtMs) ||
         ((decision as Record<string, unknown>).nextEligibleAtMs as number) < 0))))
    throw new Error("Invalid Node runtime state")
  return {
    state: runtime.state as RuntimeState["state"],
    desired: runtime.desired as RuntimeState["desired"],
    port: (runtime.port as number | null | undefined) ?? null,
    activeRelease: runtime.activeRelease as string | null,
    lastGoodRelease: (runtime.lastGoodRelease as string | null | undefined) ?? null,
    previousGoodRelease: (runtime.previousGoodRelease as string | null | undefined) ?? null,
    history: history as RuntimeState["history"],
    ...(decision !== undefined ? { healthDecision: decision as RuntimeState["healthDecision"] } : {}),
  }
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
/** Accept literal host health fields only, never stringified status objects. */
export function parseNodeHealth(value: unknown): NodeHealth {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Invalid owned Node health response")
  const report = value as Record<string, unknown>
  if (typeof report.state !== "string" ||
      !["not-provisioned", "stopped", "running", "unknown"].includes(report.state) ||
      (report.ready !== null && typeof report.ready !== "boolean") ||
      (report.release !== null && (typeof report.release !== "string" ||
        !/^r-[a-f0-9]{32}$/.test(report.release))) ||
      // Only a running release can be HTTP-ready. A contradictory response
      // must not make a stopped or unknown process look healthy.
      (report.ready === true && (report.state !== "running" || report.release === null)))
    throw new Error("Invalid owned Node health response")
  return { state: report.state as NodeHealth["state"],
    release: report.release as string | null, ready: report.ready as boolean | null }
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
  sourceIntegrity: "verified" | "legacy-needs-restaging"
  dependencyPlan: { packageName: string; packageVersion: string; dependencyCount: number; status: "review-required" }
}

/** Fail closed on malformed, duplicated or contradictory host release inventories. */
export function parseCandidates(value: unknown): Candidate[] {
  if (!Array.isArray(value) || value.length > 12)
    throw new Error("Invalid Node release inventory")
  const ids = new Set<string>()
  let current = 0
  let previous = 0
  for (const entry of value) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry))
      throw new Error("Invalid Node release inventory")
    const release = entry as Record<string, unknown>
    const detail = release.dependencyPlan
    if (!detail || typeof detail !== "object" || Array.isArray(detail))
      throw new Error("Invalid Node dependency plan")
    const plan = detail as Record<string, unknown>
    if (typeof release.id !== "string" || !/^r-[a-f0-9]{32}$/.test(release.id) ||
        ids.has(release.id) || release.active !== false ||
        typeof release.candidate !== "boolean" ||
        typeof release.previousCandidate !== "boolean" ||
        (release.candidate === true && release.previousCandidate === true) ||
        typeof release.sourceIntegrity !== "string" ||
        !["verified", "legacy-needs-restaging"].includes(release.sourceIntegrity) ||
        plan.status !== "review-required" ||
        typeof plan.packageName !== "string" || !plan.packageName ||
        plan.packageName.length > 256 ||
        typeof plan.packageVersion !== "string" || !plan.packageVersion ||
        plan.packageVersion.length > 256 ||
        !Number.isSafeInteger(plan.dependencyCount) ||
        (plan.dependencyCount as number) < 0 || (plan.dependencyCount as number) > 500)
      throw new Error("Invalid Node release inventory")
    ids.add(release.id)
    if (release.candidate) current++
    if (release.previousCandidate) previous++
    if (current > 1 || previous > 1)
      throw new Error("Conflicting Node release inventory")
  }
  return value as Candidate[]
}
export const api = "/api/v1/node-projects"
export class NodeProjectValidationError extends Error {}
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
    (item.previousCandidate === null || (typeof item.previousCandidate === "string" && /^r-[a-f0-9]{32}$/.test(item.previousCandidate))) &&
    // The UI submits this value as expectedRevision on source writes.
    Number.isSafeInteger(item.deploymentCount) && (item.deploymentCount as number) >= 0
}
/** A Node source POST is confirmed only when the catalog agrees on its exact revision. */
export function nodeSourceWriteMatchesReadback(
  expectedId: string, receipt: unknown, catalog: readonly Project[],
): boolean {
  if (!validProject(receipt) || receipt.id !== expectedId) return false
  const observed = catalog.find(project => project.id === expectedId)
  return Boolean(observed &&
    observed.id === receipt.id && observed.name === receipt.name &&
    observed.kind === receipt.kind && observed.state === receipt.state &&
    observed.runtime === receipt.runtime && observed.activeRelease === receipt.activeRelease &&
    observed.candidateRelease === receipt.candidateRelease &&
    observed.previousCandidate === receipt.previousCandidate &&
    observed.deploymentCount === receipt.deploymentCount &&
    observed.createdAt === receipt.createdAt)
}

/** Reject ambiguous or oversized catalogs before enabling project selection. */
export function parseProjectCatalog(value: unknown): Project[] {
  if (!Array.isArray(value) || value.length > 8)
    throw new Error("Invalid Node project registry response")
  const ids = new Set<string>()
  const catalog: Project[] = []
  for (const project of value) {
    if (!validProject(project) || ids.has(project.id))
      throw new Error("Invalid Node project registry response")
    ids.add(project.id)
    catalog.push(project)
  }
  return catalog
}

export async function requestJson(url: string, method?: "POST", body?: unknown, ownerToken = ""): Promise<Record<string, unknown>> {
  const ownerHeader: Record<string, string> = ownerToken ? { "X-PocketHost-Node-Owner": ownerToken } : {}
  const response = await fetch(url, { credentials: "same-origin", cache: "no-store",
    headers: ownerHeader,
    // GETs must settle; never abort a potentially state-changing POST on a UI timer.
    ...(method ? {} : { signal: AbortSignal.timeout(10_000) }),
    ...(method ? {
      method, headers: { ...ownerHeader, "X-PocketHost-Intent": intent,
        ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    } : {}) })
  if (!response.ok && method === "POST" && url === api + "/" && response.status === 400)
    throw new NodeProjectValidationError("Project name rejected by the host. Review the name and try again.")
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
