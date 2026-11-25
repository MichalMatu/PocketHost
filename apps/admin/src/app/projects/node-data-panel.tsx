import * as React from "react"
import { Button } from "@/components/ui/button"
import { NodeSqlitePanel } from "./node-sqlite-panel"

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
  requirements: {
    dataOwned: boolean
    runtimeStopped: boolean
    databaseConsistent: false
    snapshotApproved: false
  }
}
type SnapshotIndexEntry = {
  snapshot: string
  createdAt: string
  schema: 1 | 2
  files: number
  bytes: number
  directories: number | null
  integrity: "not-checked"
}
type Readout = { data: DataScope; recovery: RecoveryReview }
type IntegrityState = "checking" | "verified" | "unavailable"
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
  if (Object.keys(result).sort().join(",") !== "requirements,runtimeState,snapshotEnabled,status" ||
      !["data-not-configured", "ownership-unverified", "project-not-stopped",
        "manual-review-required"].includes(String(result.status)) ||
      !["not-provisioned", "stopped", "running", "unknown"].includes(String(result.runtimeState)) ||
      result.snapshotEnabled !== false)
    throw new Error("Invalid Node recovery prerequisites")
  const requirements = result.requirements
  if (!requirements || typeof requirements !== "object" || Array.isArray(requirements))
    throw new Error("Invalid Node recovery checklist")
  const checks = requirements as Record<string, unknown>
  if (Object.keys(checks).sort().join(",") !==
      "dataOwned,databaseConsistent,runtimeStopped,snapshotApproved" ||
      typeof checks.dataOwned !== "boolean" ||
      typeof checks.runtimeStopped !== "boolean" ||
      checks.databaseConsistent !== false ||
      checks.snapshotApproved !== false)
    throw new Error("Invalid Node recovery checklist")
  if ((result.status === "data-not-configured" && checks.dataOwned !== false) ||
      (result.status !== "data-not-configured" && checks.dataOwned !== true) ||
      (result.status === "manual-review-required" && checks.runtimeStopped !== true) ||
      (["project-not-stopped", "ownership-unverified"].includes(String(result.status)) &&
       checks.runtimeStopped !== false) ||
      (checks.runtimeStopped && result.runtimeState !== "stopped"))
    throw new Error("Inconsistent Node recovery checklist")
  return result as RecoveryReview
}

function parseSnapshotIndex(input: unknown): SnapshotIndexEntry[] {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new Error("Invalid Node snapshot index")
  const index = input as Record<string, unknown>
  if (Object.keys(index).sort().join(",") !==
      "snapshotCreationEnabled,snapshots,verification" ||
      index.snapshotCreationEnabled !== false ||
      index.verification !== "metadata-only" ||
      !Array.isArray(index.snapshots) || index.snapshots.length > 64)
    throw new Error("Invalid Node snapshot index")
  const found = new Set<string>()
  return index.snapshots.map((entry: unknown) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry))
      throw new Error("Invalid Node snapshot metadata")
    const value = entry as Record<string, unknown>
    if (Object.keys(value).sort().join(",") !==
        "bytes,createdAt,directories,files,integrity,schema,snapshot" ||
        typeof value.snapshot !== "string" || !/^snapshot-[a-f0-9]{32}$/.test(value.snapshot) ||
        found.has(value.snapshot) ||
        typeof value.createdAt !== "string" || !Number.isFinite(Date.parse(value.createdAt)) ||
        (value.schema !== 1 && value.schema !== 2) ||
        !Number.isSafeInteger(value.files) || (value.files as number) < 0 ||
        (value.files as number) > 200 ||
        !Number.isSafeInteger(value.bytes) || (value.bytes as number) < 0 ||
        (value.bytes as number) > 32 * 1024 * 1024 ||
        (value.schema === 1 ? value.directories !== null :
          !Number.isSafeInteger(value.directories) || (value.directories as number) < 0 ||
          (value.directories as number) > 200) ||
        value.integrity !== "not-checked")
      throw new Error("Invalid Node snapshot metadata")
    found.add(value.snapshot)
    return value as SnapshotIndexEntry
  })
}

function parseVerification(input: unknown, expected: SnapshotIndexEntry): void {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new Error("Invalid Node snapshot verification")
  const response = input as Record<string, unknown>
  if (Object.keys(response).join(",") !== "verification")
    throw new Error("Invalid Node snapshot verification")
  const value = response.verification
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Invalid Node snapshot verification")
  const check = value as Record<string, unknown>
  if (Object.keys(check).sort().join(",") !==
      "bytes,directories,files,integrity,snapshot" ||
      check.snapshot !== expected.snapshot || check.integrity !== "verified" ||
      !Number.isSafeInteger(check.files) || (check.files as number) < 0 ||
      (check.files as number) > 200 ||
      !Number.isSafeInteger(check.bytes) || (check.bytes as number) < 0 ||
      (check.bytes as number) > 32 * 1024 * 1024 ||
      (check.directories !== null &&
        (!Number.isSafeInteger(check.directories) || (check.directories as number) < 0 ||
         (check.directories as number) > 200)) ||
      check.files !== expected.files ||
      check.bytes !== expected.bytes ||
      check.directories !== expected.directories)
    throw new Error("Invalid Node snapshot verification")
}

/** Read-only UI: mutable-data snapshot and staging are not enabled as API actions. */
export function NodeDataPanel(props: Props) {
  // Preserve the component's standalone ownership contract even when its
  // parent does not key the element on project/owner-session changes.
  return <NodeDataContent key={(props.projectId ?? "none") + ":" + String(props.ownerAuthorized)} {...props} />
}

function NodeDataContent({ projectId, ownerAuthorized, busy, getJson, action }: Props) {
  const [report, setReport] = React.useState<Readout | null>(null)
  const [snapshots, setSnapshots] = React.useState<SnapshotIndexEntry[] | null>(null)
  const [scopeUnavailable, setScopeUnavailable] = React.useState(false)
  const [indexUnavailable, setIndexUnavailable] = React.useState(false)
  const [integrity, setIntegrity] = React.useState<Record<string, IntegrityState>>({})
  const requestVersion = React.useRef(0)
  // Parent keys this panel by selected project and owner session; unmount
  // invalidates pending reads without synchronously resetting effect state.
  React.useEffect(() => () => { requestVersion.current += 1 }, [])

  if (!projectId) return null

  const inspect = async () => {
    const requestedId = projectId
    // A new inspection supersedes earlier inspections and byte-verification
    // replies, even when the selected project and owner session are unchanged.
    const version = ++requestVersion.current
    setReport(null)
    setSnapshots(null)
    setScopeUnavailable(false)
    setIndexUnavailable(false)
    setIntegrity({})
    // The damaged live data folder must not hide independently stored backups.
    const [scopeResult, indexResult] = await Promise.allSettled([
      getJson(api + "/" + requestedId + "/data-scope").then((response) => ({
        data: parseScope(response.data, requestedId),
        recovery: parseRecovery(response.recovery),
      })),
      getJson(api + "/" + requestedId + "/data-snapshots").then(parseSnapshotIndex),
    ])
    if (version !== requestVersion.current) return
    if (scopeResult.status === "fulfilled") setReport(scopeResult.value)
    else setScopeUnavailable(true)
    if (indexResult.status === "fulfilled") setSnapshots(indexResult.value)
    else setIndexUnavailable(true)
  }

  const verify = async (snapshot: SnapshotIndexEntry) => {
    const selectedId = projectId
    const version = requestVersion.current
    setIntegrity((previous) => ({ ...previous, [snapshot.snapshot]: "checking" }))
    try {
      const response = await getJson(api + "/" + selectedId + "/data-snapshots/" +
        snapshot.snapshot + "/verify")
      if (version !== requestVersion.current) return
      parseVerification(response, snapshot)
      setIntegrity((previous) => ({ ...previous, [snapshot.snapshot]: "verified" }))
    } catch (error) {
      if (version !== requestVersion.current) return
      setIntegrity((previous) => ({ ...previous, [snapshot.snapshot]: "unavailable" }))
      throw error
    }
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
      {(report || snapshots || scopeUnavailable || indexUnavailable) &&
        <div role="status" aria-label="Node application data status" className="space-y-1 text-sm">
        {scopeUnavailable && <p className="text-xs text-muted-foreground">
          Current application data could not be inspected. Detached snapshots can still be checked separately.
        </p>}
        {report && <>
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
        <div className="space-y-1 rounded-md border p-3 text-xs" aria-label="Recovery prerequisites">
          <p className="font-medium">Recovery checklist (read-only)</p>
          <p>Private data directory: {report.recovery.requirements.dataOwned ? "verified" : "missing"}</p>
          <p>Owned runtime stopped: {report.recovery.requirements.runtimeStopped ? "observed" : "not verified"}</p>
          <p>Database consistency: manual verification required</p>
          <p>Snapshot authorization: separate explicit approval required</p>
        </div>
        <p className="text-xs text-muted-foreground">
          {report.recovery.status === "data-not-configured"
            ? "Recovery blocked: persistent application data is not configured."
            : report.recovery.status === "ownership-unverified"
              ? "Recovery blocked: owned runtime stop has not been verified."
              : report.recovery.status === "project-not-stopped"
                ? "Recovery blocked: stop the owned project and verify its stopped state."
                : "Stopped state observed. Offline database consistency still requires separate review."}
        </p>
        </>}
        {indexUnavailable && <p className="text-xs text-muted-foreground">
          Detached snapshots could not be listed. No recovery copy has been confirmed.
        </p>}
        {snapshots && <div className="space-y-2 rounded-md border p-3 text-xs" aria-label="Detached local snapshots">
          <p className="font-medium">Detached local snapshots ({snapshots.length})</p>
          {snapshots.length === 0 ? <p>No snapshots recorded for this project.</p> :
            snapshots.map((snapshot) => <div key={snapshot.snapshot} className="space-y-1 border-t pt-2">
              <code className="break-all">{snapshot.snapshot}</code>
              <p>{snapshot.createdAt} · {snapshot.files} files · {snapshot.bytes.toLocaleString()} bytes
                {snapshot.directories === null ? " · directories not recorded" :
                  " · " + snapshot.directories + " directories"}</p>
              <Button variant="outline" size="sm"
                disabled={!ownerAuthorized || busy || integrity[snapshot.snapshot] === "checking"}
                onClick={() => action(() => verify(snapshot))}>Verify stored bytes</Button>
              {integrity[snapshot.snapshot] === "checking" &&
                <p>Checking stored bytes and directory layout…</p>}
              {integrity[snapshot.snapshot] === "verified" &&
                <p>Archive matches its manifest. Database consistency not proven.</p>}
              {integrity[snapshot.snapshot] === "unavailable" &&
                <p>Integrity could not be confirmed. Do not use for recovery.</p>}
            </div>)}
          <p className="text-muted-foreground">
            Metadata is not proof of a valid backup. Verification is read-only and
            checks stored files against the manifest, not database consistency.
          </p>
        </div>}
        <p className="text-xs text-muted-foreground">Snapshot creation and restore remain disabled.</p>
      </div>}
      <NodeSqlitePanel projectId={projectId} ownerAuthorized={ownerAuthorized} busy={busy} getJson={getJson} />
      <p className="text-xs text-muted-foreground">
        No application-data snapshot or restore action is available here. Local staging code is not yet
        qualified for database-consistent recovery; this inspection does not create a backup.
      </p>
    </div>
  </details>
}
