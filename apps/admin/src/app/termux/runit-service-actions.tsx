import * as React from "react"
import { Link } from "react-router-dom"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Feedback } from "./admin-actions-feedback"
import { action, inspect } from "./admin-actions-api"
import { createRunitSourceActions } from "./runit-source-actions"
import { createRunitLifecycleActions } from "./runit-lifecycle-actions"
import { RunitServiceRow } from "./runit-service-row"
import { RunitWorkerCreator } from "./runit-worker-creator"
import { RunitSourceReview } from "./runit-source-review"
import { RunitLogsPanel } from "./runit-logs-panel"

import {
  isPanelService, validateRunitInventory,
  type WorkerTemplate, type PythonSourceReview, type PythonSourceHistory, type ArchivedEntry, type NodeSourceReview, type NodeSourceHistory, type RunitEntry,
} from "./runit-service-inventory"

export function RunitServiceActions({
  refreshToken = 0, mode = "lifecycle",
}: { refreshToken?: number; mode?: "lifecycle" | "autostart" }) {
  const [services, setServices] = React.useState<RunitEntry[] | null>(null)
  const [archived, setArchived] = React.useState<ArchivedEntry[]>([])
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [done, setDone] = React.useState<string | null>(null)
  const [serviceLogs, setServiceLogs] = React.useState<{ name: string; lines: string[] } | null>(null)
  const [logQuery, setLogQuery] = React.useState("")
  const [logLevel, setLogLevel] = React.useState<"all" | "errors" | "warnings">("all")
  const [sourceReview, setSourceReview] = React.useState<PythonSourceReview | null>(null)
  const [sourceHistory, setSourceHistory] = React.useState<PythonSourceHistory | null>(null)
  const [nodeSourceReview, setNodeSourceReview] = React.useState<NodeSourceReview | null>(null)
  const [nodeSourceHistory, setNodeSourceHistory] = React.useState<NodeSourceHistory | null>(null)
  const [nodeReplacement, setNodeReplacement] = React.useState("")
  const [creatorOpen, setCreatorOpen] = React.useState(false)
  const [workerName, setWorkerName] = React.useState("")
  const [workerTemplate, setWorkerTemplate] = React.useState<WorkerTemplate>("heartbeat-worker-v1")
  const [pythonSource, setPythonSource] = React.useState("")
  const [pythonReplacement, setPythonReplacement] = React.useState("")
  const refresh = React.useCallback(async () => {
    // A failed/invalid read must revoke stale browser controls immediately.
    setServices(null)
    setArchived([])
    setServiceLogs(null)
    setSourceReview(null)
    setSourceHistory(null)
    setNodeSourceReview(null)
    setNodeSourceHistory(null)
    setDone(null)
    setError(null)
    const data = await inspect<{ services: RunitEntry[]; archived?: ArchivedEntry[] }>("services")
    validateRunitInventory(data)
    setArchived(data.archived)
    setServices(data.services)
    setSourceReview(null)
    setSourceHistory(null)
    setNodeSourceReview(null)
    setNodeSourceHistory(null)
    setPythonReplacement("")
    setError(null)
    return { services: data.services, archived: data.archived }
  }, [])
  React.useEffect(() => {
    let active = true
    void Promise.resolve().then(refresh).catch(() => { if (active) setError("Runit unavailable") })
    return () => { active = false }
  }, [refresh, refreshToken])
  const {
    reviewPythonSource, reviewNodeSource, loadPythonSourceHistory,
    restorePythonRevision, replacePythonSource, loadNodeSourceHistory,
    restoreNodeRevision, replaceNodeSource,
  } = createRunitSourceActions({
    busy, setBusy, setError, setDone, refresh,
    sourceReview, setSourceReview, sourceHistory, setSourceHistory,
    nodeSourceReview, setNodeSourceReview, nodeSourceHistory, setNodeSourceHistory,
    pythonReplacement, nodeReplacement,
  })
  const readServiceLogs = async (name: string) => {
    if (busy) return
    setBusy(true); setError(null); setServiceLogs(null)
    try {
      const result = await action<{ lines: string[] }>({ action: "service-logs", path: name })
      if (!Array.isArray(result.lines) || result.lines.length > 100 ||
          !result.lines.every(line => typeof line === "string" && line.length <= 240))
        throw new Error("Invalid runit logs")
      setLogQuery(""); setLogLevel("all")
      setServiceLogs({ name, lines: result.lines })
    } catch { setError("Attested service log unavailable. Verify archive identity before retrying.") }
    finally { setBusy(false) }
  }
  const { perform, archiveWorker, restoreWorker, retireWorker, createWorker } =
    createRunitLifecycleActions({
      mode, busy, setBusy, setError, setDone, refresh, services, archived,
      setServiceLogs, workerName, workerTemplate, pythonSource,
      setCreatorOpen, setWorkerName, setPythonSource,
    })
  const autostartWorkers = services?.filter(item =>
    item.control === "standalone" && item.registered && !item.protected &&
    !isPanelService(item)) ?? []
  const autostartReview = {
    enabled: autostartWorkers.filter(item => item.enabled === true).length,
    disabled: autostartWorkers.filter(item => item.enabled === false).length,
    unknown: autostartWorkers.filter(item => item.enabled == null ||
      item.state === "unknown").length,
    mismatch: autostartWorkers.filter(item =>
      item.enabled !== null && item.enabled !== undefined &&
      ((item.enabled && item.state === "stopped") ||
       (!item.enabled && item.state === "running"))).length,
    staged: autostartWorkers.filter(item => item.template === "python-source-v1" ||
      item.template === "node-source-v1").length,
  }
  const counts = services ? {
    owned: services.filter(isPanelService).length,
    managed: services.filter(item => item.control === "standalone").length,
    delegated: services.filter(item => item.control === "delegated").length,
    protected: services.filter(item => item.identity === "reserved" && !isPanelService(item)).length,
    unverified: services.filter(item => !item.registered && !isPanelService(item) && item.identity !== "reserved").length,
    changed: services.filter(item => item.identity === "changed" || item.identity === "archive-conflict").length,
    conflicts: services.filter(item => item.identity === "archive-conflict").length +
      archived.filter(item => item.identity === "conflict").length,
  } : null
  const serviceRow = (service: RunitEntry) =>
    <RunitServiceRow key={service.name} service={service} mode={mode} busy={busy}
      perform={perform} readServiceLogs={readServiceLogs}
      reviewPythonSource={reviewPythonSource} reviewNodeSource={reviewNodeSource}
      archiveWorker={archiveWorker} />
  return <div className="space-y-3 rounded-md border p-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className="text-sm font-medium">{mode === "autostart" ? "Autostart registry" : "Runit services"}</h3>
      <Button variant="outline" disabled={busy} onClick={() => void refresh().catch(() => setError("Runit services unavailable"))}>Refresh services</Button>
    </div>
    <p className="text-muted-foreground text-xs">
      {mode === "autostart"
        ? "Runit state is read live and compared with its saved policy. Only attested standalone workers have controls. Enabling may start a fixed worker immediately; custom source execution and Android boot changes are blocked. No automatic reconciliation."
        : "Standalone workers are managed here. Other attested services remain visible but their lifecycle stays with the creating project or provisioner. Unregistered and protected services are read-only; process liveness is not readiness."}
    </p>
    {mode === "autostart" && services && <section className="space-y-2 rounded-md border p-3"
      aria-label="Runit desired state reconciliation">
      <h4 className="text-sm font-medium">Runit desired vs observed</h4>
      <div className="flex flex-wrap gap-2">
        <Badge variant="outline">Enabled: {autostartReview.enabled}</Badge>
        <Badge variant="outline">Disabled: {autostartReview.disabled}</Badge>
        <Badge variant="outline">Unknown: {autostartReview.unknown}</Badge>
        <Badge variant="outline">Mismatched: {autostartReview.mismatch}</Badge>
        <Badge variant="outline">Staged sources: {autostartReview.staged}</Badge>
      </div>
      <p className="text-xs text-muted-foreground">
        Counts cover attested standalone workers only. Desired policy comes from the runit down
        marker; observed state comes from the current supervisor. This is not readiness or
        Android boot verification. No automatic reconciliation is performed.
      </p>
      {autostartReview.mismatch > 0 && <p role="alert" className="text-xs">
        At least one owned service differs from the saved runit policy. Inspect individually
        before issuing commands; no corrective action was started.
      </p>}
    </section>}
    {mode === "lifecycle" && <RunitWorkerCreator
      busy={busy} services={services} archived={archived} creatorOpen={creatorOpen}
      setCreatorOpen={setCreatorOpen} workerName={workerName} setWorkerName={setWorkerName}
      workerTemplate={workerTemplate} setWorkerTemplate={setWorkerTemplate}
      pythonSource={pythonSource} setPythonSource={setPythonSource} createWorker={createWorker} />}
    {!services && !error && <p role="status" className="text-sm text-muted-foreground">Loading runit services…</p>}
    {services?.length === 0 && <p className="text-muted-foreground text-xs">No discoverable runit services.</p>}
    {counts && <div className="flex flex-wrap gap-2" aria-label="PocketHost service coordination summary">
      <Badge variant="outline">PocketHost-owned: {counts.owned}</Badge>
      <Badge variant="outline">Standalone: {counts.managed}</Badge>
      <Badge variant="outline">Delegated: {counts.delegated}</Badge>
      <Badge variant="outline">Protected: {counts.protected}</Badge>
      <Badge variant="outline">Unverified: {counts.unverified}</Badge>
      {counts.changed > 0 && <Badge variant="outline">Identity changed: {counts.changed}</Badge>}
      {counts.conflicts > 0 && <Badge variant="outline">Archive conflicts: {counts.conflicts}</Badge>}
    </div>}
    {mode === "lifecycle" && services && counts?.managed === 0 && (
      <div className="space-y-2 rounded-md border p-3">
        <p className="text-sm font-medium">No standalone workers yet</p>
        <p className="text-muted-foreground text-xs">
          Create a stopped, PocketHost-owned Node.js or Python heartbeat worker
          to manage its lifecycle and inspect Health checks. No project or
          external service adoption is required; creating never starts a process
          or enables autostart.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button disabled={busy} onClick={() => {
            setWorkerTemplate("heartbeat-worker-v1")
            setCreatorOpen(true)
          }}>Create standalone worker</Button>
          <Button variant="outline" render={<Link to="/projects" />}>
            Node project hosting
          </Button>
        </div>
        {creatorOpen && <p className="text-muted-foreground text-xs">
          The creator is open above. Select a name and confirm to create a stopped worker.
        </p>}
      </div>
    )}
    {services?.filter(service => service.registered && !service.protected && !isPanelService(service)).map(serviceRow)}
    {services && services.some(service => service.protected || isPanelService(service)) &&
      <section className="rounded-md border p-2" aria-label="Protected and PocketHost-owned services">
        <h4 className="text-sm font-medium">Unverified or protected services · view only</h4>
        {services.some(service => service.identity === "changed") && (
          <p role="alert" className="text-xs">
            A registered unit no longer matches its recorded run script or target.
            Controls are blocked until independently reattested by its creator.
          </p>
        )}
        {services.some(service => service.identity === "archive-conflict") && (
          <p role="alert" className="text-xs">
            Archive and live service ownership records overlap. All lifecycle controls are
            blocked until the partial operation is inspected and reconciled.
          </p>
        )}
        <p className="py-2 text-xs text-muted-foreground">
          Lifecycle state and autostart come from runit. Application health is independent.
        </p>
        {services.filter(service => service.protected || isPanelService(service)).map(serviceRow)}
      </section>}
    {mode === "lifecycle" && archived.length > 0 && <section className="space-y-2 rounded-md border p-3"
      aria-label="Archived PocketHost workers">
      <p className="text-sm font-medium">Archived workers ({archived.length})</p>
      <p className="text-xs text-muted-foreground">
        Archive retains service code and logs. Saved logs can be read only for an
        independently attested archived definition. Restore returns it stopped with
        autostart disabled. Retire revokes future restoration and moves the
        definition and logs to bounded private quarantine (no deletion).
        Entries in conflict or with changed identity are read-only and require inspection.
      </p>
      {archived.map(entry => <div className="flex flex-wrap items-center justify-between gap-2 border-b py-2" key={entry.name}>
        <div className="space-y-1">
          <p className="text-sm font-medium">{entry.name}</p>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">{entry.template === "python-source-v1" ? "Python source" :
              entry.template === "node-source-v1" ? "Node.js source" :
              entry.template === "python-heartbeat-v1" ? "Python heartbeat" : "Node.js"}</Badge>
            <Badge variant="outline">{entry.identity === "restorable" ? "Archived · verified" :
              entry.identity === "conflict" ? "Archive/live conflict · blocked" : "Identity changed · blocked"}</Badge>
          </div>
        </div>
        <div className="flex flex-wrap gap-1">
          <Button variant="outline" disabled={busy || entry.identity !== "restorable"}
            onClick={() => void readServiceLogs(entry.name)}>Saved logs</Button>
          <Button variant="outline" disabled={busy || entry.identity !== "restorable"}
            onClick={() => void restoreWorker(entry)}>Restore service</Button>
          <Button variant="outline" disabled={busy || entry.identity !== "restorable"}
            onClick={() => void retireWorker(entry)}>Retire definition</Button>
        </div>
      </div>)}
    </section>}
    {mode === "lifecycle" && nodeSourceReview &&
      services?.some(service => service.name === nodeSourceReview.name &&
        service.registered && service.control === "standalone" &&
        service.template === "node-source-v1") &&
      <RunitSourceReview review={nodeSourceReview} history={nodeSourceHistory}
        replacement={nodeReplacement} setReplacement={setNodeReplacement}
        loadHistory={loadNodeSourceHistory} restoreRevision={restoreNodeRevision}
        replaceSource={replaceNodeSource} busy={busy} />}
    {mode === "lifecycle" && sourceReview &&
      services?.some(service => service.name === sourceReview.name &&
        service.registered && service.control === "standalone" &&
        service.template === "python-source-v1") &&
      <RunitSourceReview review={sourceReview} history={sourceHistory}
        replacement={pythonReplacement} setReplacement={setPythonReplacement}
        loadHistory={loadPythonSourceHistory} restoreRevision={restorePythonRevision}
        replaceSource={replacePythonSource} busy={busy} />}
    {mode === "lifecycle" && serviceLogs && <RunitLogsPanel
      serviceLogs={serviceLogs} busy={busy} readServiceLogs={readServiceLogs}
      setServiceLogs={setServiceLogs} logQuery={logQuery} setLogQuery={setLogQuery}
      logLevel={logLevel} setLogLevel={setLogLevel} />}
    <Feedback error={error} done={done} />
  </div>
}

