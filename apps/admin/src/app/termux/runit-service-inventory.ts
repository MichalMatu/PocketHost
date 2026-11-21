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

/**
 * A read receipt is not service-management authority. Reject malformed or
 * incomplete ownership state before enabling any browser lifecycle controls.
 */
export function validateRunitInventory(
  data: { services: RunitEntry[]; archived?: ArchivedEntry[] },
): asserts data is { services: RunitEntry[]; archived: ArchivedEntry[] } {
    if (!Array.isArray(data.services) || data.services.length > 100 ||
        !data.services.every(item => /^[a-z][a-z0-9-]{1,63}$/.test(item.name) &&
          typeof item.registered === "boolean" && typeof item.protected === "boolean" &&
          ["standalone", "delegated", "read-only"].includes(item.control) &&
          ((item.control === "read-only" && item.protected && !item.registered) ||
            (item.control === "standalone" && !item.protected && item.registered && !!item.template) ||
            (item.control === "delegated" && !item.protected && item.registered && !item.template)) &&
          ["running", "stopped", "unknown"].includes(item.state) &&
          (item.identity === undefined ||
            ["verified", "unregistered", "legacy", "changed", "archive-conflict", "reserved"].includes(item.identity)) &&
          (item.identityReason === undefined ||
            ["run-sha-attested", "no-enrollment", "legacy-without-sha",
             "service-target-changed", "service-not-published", "worker-provenance-changed", "run-script-changed", "archive-live-conflict",
             "reserved-system-service"].includes(item.identityReason)) &&
          (item.template === undefined ||
            item.template === "heartbeat-worker-v1" || item.template === "python-heartbeat-v1" ||
            item.template === "python-source-v1" || item.template === "node-source-v1") &&
          (item.project === undefined ||
            (item.control === "delegated" && !item.template &&
              typeof item.project === "object" && item.project !== null &&
              /^node-[a-f0-9]{32}$/.test(item.project.id) &&
              typeof item.project.name === "string" &&
              item.project.name.length > 0 && item.project.name.length <= 60))))
      throw new Error("Invalid runit inventory")
    if (!Array.isArray(data.archived) || data.archived.length > 4 ||
        !data.archived.every(item => /^[a-z][a-z0-9-]{1,63}$/.test(item.name) &&
          ["heartbeat-worker-v1", "python-heartbeat-v1", "python-source-v1", "node-source-v1"].includes(item.template) &&
          ["restorable", "changed", "conflict"].includes(item.identity)))
      throw new Error("Invalid archived worker inventory")
}
