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

function readSignal(signal?: AbortSignal): AbortSignal {
  const timeout = AbortSignal.timeout(10_000)
  return signal ? AbortSignal.any([signal, timeout]) : timeout
}

export async function readProjectLogCatalog(signal?: AbortSignal): Promise<ProjectLogCatalog> {
  const requestSignal = readSignal(signal)
  const [staticResult, nodeResult] = await Promise.allSettled([
    fetch(STATIC_API, { credentials: "same-origin", cache: "no-store", signal: requestSignal })
      .then(async response => {
        if (response.status === 404) return null
        if (!response.ok) throw new Error("Static site inventory unavailable")
        return parseFleetSites(await response.json())
      }),
    readNodeCatalog(requestSignal),
  ])
  if (signal?.aborted) throw new Error("Request cancelled")

  const staticStatus: LogSourceStatus = staticResult.status === "rejected" ? "error" :
    staticResult.value === null ? "disabled" : "ready"
  const nodeStatus: LogSourceStatus = nodeResult.status === "rejected" ? "error" :
    !nodeResult.value.enabled ? "disabled" : "ready"
  const staticTargets: ProjectLogTarget[] = staticResult.status === "fulfilled" &&
    staticResult.value !== null
    ? staticResult.value.map(site => ({
        key: "static:" + site.id, id: site.id, name: site.name, kind: "static" as const,
      }))
    : []
  const nodeTargets: ProjectLogTarget[] = nodeResult.status === "fulfilled"
    ? nodeResult.value.projects.map(project => ({
        key: "node:" + project.id, id: project.id, name: project.name, kind: "node" as const,
      }))
    : []
  return { targets: [...staticTargets, ...nodeTargets], staticStatus, nodeStatus }
}

/* Defense in depth: hide entire sensitive lines, including JSON and header formats
 * whose values are not covered by the older host-side key=value sanitizer.
 * Unknown secrets cannot be identified reliably: avoid logging secrets at source. */
export function redactProjectLog(line: string): string {
  const clean = line.replace(/[\x00-\x1f\x7f]/g, "")
  if (/(?:^|[^a-z0-9])(?:password|passwd|secret|token|authorization|api[_-]?key|access[_-]?key|cookie|set-cookie|private[_ -]?key|bearer)(?=$|[^a-z0-9])|[a-z](?:Secret|Token|Password|Passwd|ApiKey|AccessKey)(?=$|[^A-Za-z0-9])/i.test(clean) ||
      /-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(clean) ||
      /\beyJ[A-Za-z0-9_-]{12,}\.eyJ[A-Za-z0-9_-]{12,}\./.test(clean)) {
    return "[sensitive log line hidden]"
  }
  return clean.slice(0, 240)
}

export async function readProjectLogLines(target: ProjectLogTarget, signal?: AbortSignal): Promise<string[]> {
  const requestSignal = readSignal(signal)
  let lines: string[]
  if (target.kind === "node") {
    if (target.key !== "node:" + target.id)
      throw new Error("Invalid owned Node project identity")
    lines = await readNodeLogs(target.id, requestSignal)
  } else {
    if (!STATIC_ID.test(target.id) || target.key !== "static:" + target.id)
      throw new Error("Invalid owned static project identity")
    const response = await fetch(STATIC_API + "/" + target.id + "/logs", {
      credentials: "same-origin", cache: "no-store", signal: requestSignal,
    })
    if (!response.ok) throw new Error("Static site logs unavailable")
    lines = parseFleetLogs(await response.json())
  }
  return lines.slice(-50).map(redactProjectLog)
}
