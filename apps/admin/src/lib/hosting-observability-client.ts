import { parseFleetLogs, parseFleetSites } from "@/lib/site-fleet-schema"
import { readNodeCatalog, readNodeLogs } from "@/lib/node-hosting-client"

export type ProjectLogTarget = {
  key: string
  id: string
  name: string
  kind: "static" | "node"
}
export type LogSourceStatus = "ready" | "disabled" | "error"
export type ProjectLogCatalog = {
  targets: ProjectLogTarget[]
  staticStatus: LogSourceStatus
  nodeStatus: LogSourceStatus
}

const STATIC_API = "/api/v1/sites"
const STATIC_ID = /^site-[a-f0-9]{32}$/

export async function readProjectLogCatalog(signal?: AbortSignal): Promise<ProjectLogCatalog> {
  const [staticResult, nodeResult] = await Promise.allSettled([
    fetch(STATIC_API, { credentials: "same-origin", cache: "no-store", signal })
      .then(async response => {
        if (response.status === 404) return null
        if (!response.ok) throw new Error("Static site inventory unavailable")
        return parseFleetSites(await response.json())
      }),
    readNodeCatalog(signal),
  ])
  if (signal?.aborted) throw new Error("Request cancelled")

  const staticStatus: LogSourceStatus = staticResult.status === "rejected" ? "error" :
    staticResult.value === null ? "disabled" : "ready"
  const nodeStatus: LogSourceStatus = nodeResult.status === "rejected" ? "error" :
    !nodeResult.value.enabled ? "disabled" : "ready"
  const staticTargets: ProjectLogTarget[] = staticResult.status === "fulfilled" &&
    staticResult.value !== null
    ? staticResult.value.map(site => ({
        key: "static:" + site.id, id: site.id, name: site.name, kind: "static",
      }))
    : []
  const nodeTargets: ProjectLogTarget[] = nodeResult.status === "fulfilled"
    ? nodeResult.value.projects.map(project => ({
        key: "node:" + project.id, id: project.id, name: project.name, kind: "node",
      }))
    : []
  return { targets: [...staticTargets, ...nodeTargets], staticStatus, nodeStatus }
}

/* Defense-in-depth for displayed output; host-side ownership and redaction remain mandatory. */
export function redactProjectLog(line: string): string {
  return line
    .replace(/\b(authorization)\s*[:=]\s*(?:bearer\s+)?\S+/gi, "$1=[redacted]")
    .replace(/\b(password|secret|token|api[_-]?key|access[_-]?key)\s*[:=]\s*(?:"[^"]*"|'[^']*'|\S+)/gi, "$1=[redacted]")
    .replace(/\b(bearer)\s+[a-z0-9._~+/-]+/gi, "$1 [redacted]")
    .replace(/[\x00-\x1f\x7f]/g, "")
    .slice(0, 240)
}

export async function readProjectLogLines(target: ProjectLogTarget, signal?: AbortSignal): Promise<string[]> {
  let lines: string[]
  if (target.kind === "node") {
    lines = await readNodeLogs(target.id, signal)
  } else {
    if (!STATIC_ID.test(target.id) || target.key !== "static:" + target.id)
      throw new Error("Invalid owned static project identity")
    const response = await fetch(STATIC_API + "/" + target.id + "/logs", {
      credentials: "same-origin", cache: "no-store", signal,
    })
    if (!response.ok) throw new Error("Static site logs unavailable")
    lines = parseFleetLogs(await response.json())
  }
  return lines.slice(-50).map(redactProjectLog)
}
