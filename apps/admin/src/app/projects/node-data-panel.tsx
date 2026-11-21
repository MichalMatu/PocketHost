import * as React from "react"
import { Button } from "@/components/ui/button"

const api = "/api/v1/node-projects"

type DataScope = {
  projectId: string
  state: "not-configured" | "owned-private"
  fileCount: number
  totalBytes: number
  backupReady: false
  consistency: "offline-required"
}
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
      "backupReady,consistency,fileCount,projectId,state,totalBytes" ||
      value.projectId !== projectId ||
      !["not-configured", "owned-private"].includes(String(value.state)) ||
      !Number.isSafeInteger(value.fileCount) || (value.fileCount as number) < 0 ||
      (value.fileCount as number) > 200 ||
      !Number.isSafeInteger(value.totalBytes) || (value.totalBytes as number) < 0 ||
      (value.totalBytes as number) > 32 * 1024 * 1024 ||
      value.backupReady !== false || value.consistency !== "offline-required" ||
      (value.state === "not-configured" && (value.fileCount !== 0 || value.totalBytes !== 0)))
    throw new Error("Invalid Node data scope report")
  return value as DataScope
}

/** Read-only UI: mutable-data snapshot and staging are not enabled as API actions. */
export function NodeDataPanel({ projectId, ownerAuthorized, busy, getJson, action }: Props) {
  const [report, setReport] = React.useState<DataScope | null>(null)
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
    setReport(parseScope(response.data, requestedId))
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
        <p>Storage: {report.state === "not-configured" ? "not configured" : "owned private directory verified"}.</p>
        <p>Files: {report.fileCount} · Size: {report.totalBytes.toLocaleString()} bytes.</p>
        <p className="text-xs text-muted-foreground">
          Recovery: not enabled. A stopped, verified project and separate operation approval are required.
        </p>
      </div>}
      <p className="text-xs text-muted-foreground">
        No application-data snapshot or restore action is available here. Local staging code is not yet
        qualified for database-consistent recovery; this inspection does not create a backup.
      </p>
    </div>
  </details>
}
