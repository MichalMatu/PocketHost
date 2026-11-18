import * as React from "react"
import { Button } from "@/components/ui/button"

const api = "/api/v1/node-projects"
type Snapshot = { id: string; time: string }
type BackupStatus = { initialized: boolean; repositoryPresent: boolean; keyPresent: boolean }
type Props = {
  catalogReady: boolean
  ownerAuthorized: boolean
  busy: boolean
  getJson: (url: string, method?: "POST", body?: unknown) => Promise<Record<string, unknown>>
  action: (fn: () => Promise<void>) => void
  onMessage: (message: string) => void
}

function readSnapshots(value: unknown): Snapshot[] {
  if (!Array.isArray(value) || value.length > 40 || !value.every(item =>
    item && typeof item === "object" && !Array.isArray(item) &&
    typeof item.id === "string" && /^[a-f0-9]{64}$/.test(item.id) &&
    typeof item.time === "string" && item.time.length <= 60))
    throw new Error("Invalid Node Restic snapshot inventory")
  return value as Snapshot[]
}

export function NodeBackupPanel({
  catalogReady, ownerAuthorized, busy, getJson, action, onMessage,
}: Props) {
  const [backupStatus, setBackupStatus] = React.useState<BackupStatus | null>(null)
  const [backupsEnabled, setBackupsEnabled] = React.useState(false)
  const [backupApproved, setBackupApproved] = React.useState(false)
  const [backupSnapshots, setBackupSnapshots] = React.useState<Snapshot[]>([])
  const [selectedSnapshot, setSelectedSnapshot] = React.useState("")
  const ownerSessionVersion = React.useRef(0)

  React.useEffect(() => {
    // Invalidate responses started before owner access changed.
    ownerSessionVersion.current += 1
    if (!ownerAuthorized || !catalogReady) {
      setBackupApproved(false)
      setBackupStatus(null)
      setBackupsEnabled(false)
      setBackupSnapshots([])
      setSelectedSnapshot("")
    }
  }, [ownerAuthorized, catalogReady])

  const repositoryReady = backupStatus?.initialized === true &&
    backupStatus.repositoryPresent && backupStatus.keyPresent
  const canMutate = catalogReady && ownerAuthorized && repositoryReady && backupsEnabled

  const guardedGetJson: Props["getJson"] = async (url, method, body) => {
    const version = ownerSessionVersion.current
    const result = await getJson(url, method, body)
    if (version !== ownerSessionVersion.current) {
      throw new Error("Owner session changed. Inspect backups again.")
    }
    return result
  }

  const inspect = async () => {
    // Failed refresh must never retain a previous "ready" or mutation flag.
    setBackupStatus(null)
    setBackupsEnabled(false)
    setBackupApproved(false)
    setBackupSnapshots([])
    setSelectedSnapshot("")
    const report = await guardedGetJson(api + "/backup")
    const value = report.backup as Record<string, unknown> | undefined
    if (!value || typeof value.initialized !== "boolean" ||
        typeof value.repositoryPresent !== "boolean" ||
        typeof value.keyPresent !== "boolean" ||
        typeof report.backupsEnabled !== "boolean")
      throw new Error("Invalid Node Restic state")
    setBackupStatus({ initialized: value.initialized,
      repositoryPresent: value.repositoryPresent, keyPresent: value.keyPresent })
    setBackupsEnabled(report.backupsEnabled)
    setBackupApproved(false)
    setBackupSnapshots([])
    setSelectedSnapshot("")
    onMessage("Owned Node Restic repository inspected without running backup.")
  }

  return <details data-testid="node-backup-panel" className="rounded-xl border bg-card text-card-foreground">
    <summary className="cursor-pointer px-4 py-3 text-sm font-semibold">
      Scoped Node project backups
      <span className="ml-2 text-xs font-normal text-muted-foreground">Encrypted Restic · advanced</span>
    </summary>
    <div className="space-y-3 border-t px-4 py-4">
      <p className="text-xs text-muted-foreground">
        Backup of PocketHost-owned Node projects. Restore only creates isolated staging.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" disabled={busy || !catalogReady}
          onClick={() => action(inspect)}>Inspect Node backups</Button>
        {backupStatus && <p role="status" aria-label="Node backup state" className="text-sm">
          Restic: {backupStatus.initialized && backupStatus.repositoryPresent && backupStatus.keyPresent
            ? "ready" : "not ready"}. Mutations: {backupsEnabled ? "owner-gated" : "disabled"}.
        </p>}
      </div>
      {backupStatus && <>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" aria-label="Approve Node Restic operation"
            disabled={busy || !canMutate}
            checked={backupApproved} onChange={event => setBackupApproved(event.target.checked)} />
          I authorize one backup or staging-only restore of my PocketHost Node project data.
        </label>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled={busy || !catalogReady || !ownerAuthorized || !repositoryReady}
            onClick={() => action(async () => {
              setBackupSnapshots([])
              setSelectedSnapshot("")
              setBackupApproved(false)
              const response = await guardedGetJson(api + "/backup/snapshots")
              setBackupSnapshots(readSnapshots(response.snapshots))
              onMessage("Owned Node snapshots refreshed.")
            })}>List Node snapshots</Button>
          <Button disabled={busy || !canMutate || !backupApproved}
            onClick={() => action(async () => {
              setBackupApproved(false)
              setBackupSnapshots([])
              setSelectedSnapshot("")
              const result = await guardedGetJson(api + "/backup/create", "POST", { approved: true })
              if (result.backupCreated !== true || typeof result.snapshot !== "string" ||
                  !/^[a-f0-9]{64}$/.test(result.snapshot))
                throw new Error("Backup result unconfirmed. Inspect snapshots before retrying.")
              const inventory = await guardedGetJson(api + "/backup/snapshots")
              const snapshots = readSnapshots(inventory.snapshots)
              if (!snapshots.some(item => item.id === result.snapshot))
                throw new Error("Snapshot not found. Inspect before retrying.")
              setBackupSnapshots(snapshots)
              setSelectedSnapshot(result.snapshot)
              onMessage("Verified encrypted Node backup " + result.snapshot.slice(0, 12) + ".")
            })}>Create Node backup</Button>
        </div>
        <label className="grid gap-1 text-sm">Staging restore snapshot
          <select aria-label="Staging restore snapshot" className="w-full rounded-md border bg-background p-2"
            disabled={busy || !catalogReady || !ownerAuthorized || !repositoryReady} value={selectedSnapshot}
            onChange={event => setSelectedSnapshot(event.target.value)}>
            <option value="">Select a verified snapshot</option>
            {backupSnapshots.map(item => <option key={item.id} value={item.id}>
              {item.time} · {item.id.slice(0, 12)}
            </option>)}
          </select>
        </label>
        <Button variant="outline" disabled={busy || !canMutate || !backupApproved ||
            !backupSnapshots.some(item => item.id === selectedSnapshot)}
          onClick={() => action(async () => {
            const snapshot = selectedSnapshot
            setBackupApproved(false)
            setSelectedSnapshot("")
            const result = await guardedGetJson(api + "/backup/restore", "POST", { approved: true, snapshot })
            if (result.restoredToStaging !== true ||
                typeof result.verifiedProjects !== "number" ||
                !Number.isSafeInteger(result.verifiedProjects) ||
                result.verifiedProjects < 1 || result.verifiedProjects > 8)
              throw new Error("Staging restore unconfirmed. Inspect before retrying.")
            onMessage("Verified " + result.verifiedProjects +
              " projects in private restore staging; no live data replaced.")
          })}>Restore Node snapshot to staging</Button>
        {!backupsEnabled && <p className="text-xs text-muted-foreground">
          Node backup mutations require a separate enabled DEV feature flag.
        </p>}
        <p className="text-xs text-muted-foreground">
          Backup remains on this A8, not off-device disaster recovery. Use the owner token only on trusted LAN.
        </p>
      </>}
    </div>
  </details>
}
