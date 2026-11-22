import * as React from "react"
import { Button } from "@/components/ui/button"

const api = "/api/v1/node-projects"

type CategoryUsage = {
  fileCount: number
  totalBytes: number
  directoryCount: number
}
type DataScope = {
  projectId: string
  state: "not-configured" | "owned-private"
  fileCount: number
  totalBytes: number
  categories: Record<"uploads" | "db" | "state", CategoryUsage>
  backupReady: false
  consistency: "offline-required"
}
type RecoveryReview = {
  status: "data-not-configured" | "ownership-unverified" | "project-not-stopped" | "manual-review-required"
  runtimeState: "not-provisioned" | "stopped" | "running" | "unknown"
  snapshotEnabled: false
}
type Readout = { data: DataScope; recovery: RecoveryReview }
type Props = {
  projectId: string | null
  ownerAuthorized: boolean
  busy: boolean
  getJson: (url: string, method?: "POST", body?: unknown) => Promise<Record<string, unknown>>
  action: (fn: () => Promise<void>) => void
}

function parseScope(input: unknown, projectId: string): DataScope {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new Error("Invalid Node data scope report")
  const value = input as Record<string, unknown>
  if (Object.keys(value).sort().join(",") !==
      "backupReady,categories,consistency,fileCount,projectId,state,totalBytes" ||
      value.projectId !== projectId ||
      !["not-configured", "owned-private"].includes(String(value.state)) ||
      !Number.isSafeInteger(value.fileCount) || (value.fileCount as number) < 0 ||
      (value.fileCount as number) > 200 ||
      !Number.isSafeInteger(value.totalBytes) || (value.totalBytes as number) < 0 ||
      (value.totalBytes as number) > 32 * 1024 * 1024 ||
      value.backupReady !== false || value.consistency !== "offline-required" ||
      (value.state === "not-configured" && (value.fileCount !== 0 || value.totalBytes !== 0)))
    throw new Error("Invalid Node data scope report")
  const categories = value.categories
  if (!categories || typeof categories !== "object" || Array.isArray(categories))
    throw new Error("Invalid Node data categories")
  const values = categories as Record<string, unknown>
  if (Object.keys(values).sort().join(",") !== "db,state,uploads")
    throw new Error("Invalid Node data categories")
  let countedFiles = 0
  let countedBytes = 0
  let countedDirectories = 0
  for (const key of ["uploads", "db", "state"] as const) {
    const entry = values[key]
    if (!entry || typeof entry !== "object" || Array.isArray(entry))
      throw new Error("Invalid Node data category")
    const item = entry as Record<string, unknown>
    if (Object.keys(item).sort().join(",") !== "directoryCount,fileCount,totalBytes" ||
        !Number.isSafeInteger(item.fileCount) || (item.fileCount as number) < 0 ||
        !Number.isSafeInteger(item.totalBytes) || (item.totalBytes as number) < 0 ||
        !Number.isSafeInteger(item.directoryCount) || (item.directoryCount as number) < 0)
      throw new Error("Invalid Node data category")
    countedFiles += item.fileCount as number
    countedBytes += item.totalBytes as number
    countedDirectories += item.directoryCount as number
  }
  if (countedFiles !== value.fileCount || countedBytes !== value.totalBytes ||
      countedDirectories > 200 ||
      (value.state === "not-configured" && countedDirectories !== 0))
    throw new Error("Inconsistent Node data category totals")
  return value as DataScope
}

function parseRecovery(value: unknown): RecoveryReview {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Invalid Node recovery prerequisites")
  const result = value as Record<string, unknown>
  if (Object.keys(result).sort().join(",") !== "runtimeState,snapshotEnabled,status" ||
      !["data-not-configured", "ownership-unverified", "project-not-stopped",
        "manual-review-required"].includes(String(result.status)) ||
      !["not-provisioned", "stopped", "running", "unknown"].includes(String(result.runtimeState)) ||
      result.snapshotEnabled !== false)
    throw new Error("Invalid Node recovery prerequisites")
  return result as RecoveryReview
}

/** Read-only UI: mutable-data snapshot and staging are not enabled as API actions. */
export function NodeDataPanel({ projectId, ownerAuthorized, busy, getJson, action }: Props) {
  const [report, setReport] = React.useState<Readout | null>(null)
  const requestVersion = React.useRef(0)
  React.useEffect(() => {
    requestVersion.current += 1
    setReport(null)
  }, [projectId, ownerAuthorized])

  if (!projectId) return null

  const inspect = async () => {
    const requestedId = projectId
    const version = requestVersion.current
    setReport(null)
    const response = await getJson(api + "/" + requestedId + "/data-scope")
    if (version !== requestVersion.current)
      throw new Error("Node project or owner session changed. Inspect again.")
    setReport({ data: parseScope(response.data, requestedId),
      recovery: parseRecovery(response.recovery) })
  }

  return <details data-testid="node-data-panel" className="rounded-xl border bg-card text-card-foreground">
    <summary className="cursor-pointer px-4 py-3 text-sm font-semibold">
      Application data
      <span className="ml-2 text-xs font-normal text-muted-foreground">Uploads · database · state</span>
    </summary>
    <div className="space-y-3 border-t px-4 py-4">
      <p className="text-sm text-muted-foreground">
        Inspect persistent application files independently of source releases and encrypted source Restic backups.
      </p>
      <Button variant="outline" disabled={!ownerAuthorized || busy}
        onClick={() => action(inspect)}>Inspect data storage</Button>
      {!ownerAuthorized && <p className="text-xs text-muted-foreground">
        Unlock the Node owner session to inspect private application data.
      </p>}
      {report && <div role="status" aria-label="Node application data status" className="space-y-1 text-sm">
        <p>Storage: {report.data.state === "not-configured" ? "not configured" : "owned private directory verified"}.</p>
        <p>Files: {report.data.fileCount} · Size: {report.data.totalBytes.toLocaleString()} bytes.</p>
        <div className="grid gap-2 sm:grid-cols-3" aria-label="Application data by category">
          {(["uploads", "db", "state"] as const).map((kind) => {
            const usage = report.data.categories[kind]
            return <div key={kind} className="rounded-md border p-3">
              <p className="font-medium">{kind === "db" ? "Database" : kind === "state" ? "State" : "Uploads"}</p>
              <p>{usage.fileCount} files · {usage.totalBytes.toLocaleString()} bytes</p>
              <p className="text-xs text-muted-foreground">
                {usage.directoryCount === 0 ? "Directory not configured" : usage.directoryCount + " directories"}
              </p>
            </div>
          })}
        </div>
        <p>Runtime observation: {report.recovery.runtimeState}.</p>
        <p className="text-xs text-muted-foreground">
          {report.recovery.status === "data-not-configured"
            ? "Recovery blocked: persistent application data is not configured."
            : report.recovery.status === "ownership-unverified"
              ? "Recovery blocked: owned runtime stop has not been verified."
              : report.recovery.status === "project-not-stopped"
                ? "Recovery blocked: stop the owned project and verify its stopped state."
                : "Stopped state observed. Offline database consistency still requires separate review."}
        </p>
        <p className="text-xs text-muted-foreground">Snapshot creation and restore remain disabled.</p>
      </div>}
      <p className="text-xs text-muted-foreground">
        No application-data snapshot or restore action is available here. Local staging code is not yet
        qualified for database-consistent recovery; this inspection does not create a backup.
      </p>
    </div>
  </details>
}
