/** Static Runit display and ownership rules; no network or lifecycle actions. */
export type WorkerTemplate = "heartbeat-worker-v1" | "python-heartbeat-v1" | "python-source-v1" | "node-source-v1"
export type PythonSourceReview = {
  name: string
  template: "python-source-v1"
  sourceSha256: string
  sourceBytes: number
  observed: "running" | "stopped" | "unknown"
  autostart: boolean | null
  canStartFromLan: false
  ownerApproval: "not-configured"
  checkedAt: string
}
export type PythonSourceHistory = {
  name: string
  currentSha256: string
  revisions: {
    id: string; sourceSha256: string; bytes: number; savedAt: string
  }[]
  execution: "blocked"
}
export type ArchivedEntry = {
  name: string
  template: WorkerTemplate
  identity: "restorable" | "changed" | "conflict"
}
export type NodeSourceReview = Omit<PythonSourceReview, "template"> & { template: "node-source-v1" }
export type NodeSourceHistory = PythonSourceHistory
export type RunitEntry = {
  name: string
  registered: boolean
  protected: boolean
  identity?: "verified" | "unregistered" | "legacy" | "changed" | "archive-conflict" | "reserved"
  identityReason?: "run-sha-attested" | "no-enrollment" | "legacy-without-sha" |
    "service-target-changed" | "service-not-published" | "worker-provenance-changed" | "run-script-changed" | "archive-live-conflict" |
    "reserved-system-service"
  template?: WorkerTemplate
  control: "standalone" | "delegated" | "read-only"
  state: "running" | "stopped" | "unknown"
  enabled?: boolean | null
  project?: { id: string; name: string }
}

// UI guard only: the panel and its watcher must not be stopped from this page.
export const isPanelService = (service: RunitEntry) =>
  service.name === "pockethost-panel" || service.name === "pockethost-panel-watch"

// A successful write receipt is not proof of enrollment. Trust only a fresh,
// server-attested inventory entry with the intended template and safe state.
export const confirmedStoppedWorker = (items: RunitEntry[], name: string, template: WorkerTemplate) =>
  items.some(item => item.name === name && item.registered === true &&
    item.protected === false && item.identity === "verified" &&
    item.identityReason === "run-sha-attested" && item.control === "standalone" &&
    item.template === template && item.state === "stopped" && item.enabled === false)

