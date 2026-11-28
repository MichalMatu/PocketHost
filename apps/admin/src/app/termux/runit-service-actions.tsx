import * as React from "react"
import { Link } from "react-router-dom"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Feedback } from "./admin-actions-feedback"
import { action, inspect } from "./admin-actions-api"
import { createRunitSourceActions } from "./runit-source-actions"
import { createRunitLifecycleActions } from "./runit-lifecycle-actions"
import { RunitServiceRow } from "./runit-service-row"

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
    {mode === "lifecycle" && <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-muted-foreground text-xs">
          Standalone workers need no Project. Only PocketHost-created, attested services can be managed.
        </p>
        <Button variant="outline"
          disabled={busy || (!creatorOpen && !services)}
          onClick={() => setCreatorOpen(open => !open)}>
          {creatorOpen ? "Close creator" : "Add Service"}
        </Button>
      </div>
      {creatorOpen && <div className="space-y-3 rounded-md border p-3" aria-label="Add standalone service">
        <p className="text-sm font-medium">Create standalone service</p>
        <p className="text-muted-foreground text-xs">
          Create a fixed Node.js/Python heartbeat worker, or stage your own
          immutable Python/Node.js source. Source is never executed or enabled by
          this LAN page; only a separately authorized local owner workflow
          can review activation. Maximum four definitions and 32 KB per source.
          No process adoption or arbitrary service path is allowed.
        </p>
        <div className="flex flex-wrap gap-2" aria-label="Worker runtime">
          <Button disabled={busy}
            variant={workerTemplate === "heartbeat-worker-v1" ? "secondary" : "outline"}
            aria-pressed={workerTemplate === "heartbeat-worker-v1"}
            onClick={() => setWorkerTemplate("heartbeat-worker-v1")}>Node.js</Button>
          <Button disabled={busy}
            variant={workerTemplate === "python-heartbeat-v1" ? "secondary" : "outline"}
            aria-pressed={workerTemplate === "python-heartbeat-v1"}
            onClick={() => setWorkerTemplate("python-heartbeat-v1")}>Python heartbeat</Button>
          <Button disabled={busy}
            variant={workerTemplate === "python-source-v1" ? "secondary" : "outline"}
            aria-pressed={workerTemplate === "python-source-v1"}
            onClick={() => setWorkerTemplate("python-source-v1")}>My Python code</Button>
          <Button disabled={busy}
            variant={workerTemplate === "node-source-v1" ? "secondary" : "outline"}
            aria-pressed={workerTemplate === "node-source-v1"}
            onClick={() => setWorkerTemplate("node-source-v1")}>My Node.js code</Button>
        </div>
        {(workerTemplate === "python-source-v1" || workerTemplate === "node-source-v1") && <div className="space-y-2">
          <label htmlFor="python-worker-source" className="text-sm font-medium">
            {workerTemplate === "node-source-v1" ? "worker.mjs source" : "worker.py source"}
          </label>
          <Textarea id="python-worker-source" value={pythonSource}
            onChange={event => setPythonSource(event.target.value)}
            maxLength={32 * 1024} rows={7} disabled={busy}
            placeholder={workerTemplate === "node-source-v1" ? 'console.log("Hello from Node.js")' : 'print("Hello from Python")'} />
          <p className="text-xs text-muted-foreground">
            Stored privately without executing, dependencies or network listener.
            Start, Restart, Autostart and recovery are disabled from this page.
          </p>
        </div>}
        <div className="flex flex-wrap items-center gap-2">
          <Input aria-label="New service name" placeholder="e.g. monitoring-worker"
            className="min-w-48 max-w-72" maxLength={64} disabled={busy}
            value={workerName} onChange={event => setWorkerName(event.target.value.toLowerCase())} />
          <Button disabled={busy || !services ||
              services.some(item => item.name === workerName) ||
              archived.some(item => item.name === workerName) ||
              !/^[a-z][a-z0-9-]{1,63}$/.test(workerName) ||
              ((workerTemplate === "python-source-v1" || workerTemplate === "node-source-v1") &&
                (!pythonSource.trim() || new Blob([pythonSource]).size > 32 * 1024))}
            onClick={() => void createWorker()}>
            {workerTemplate === "node-source-v1" ? "Stage Node.js source" :
              workerTemplate === "python-source-v1" ? "Stage Python source" : "Create stopped service"}
          </Button>
        </div>
        <p className="text-muted-foreground text-xs">
          Names must be unique and 2–64 characters: lowercase letters, digits and hyphens.
          Creating a service never executes staged source or enables autostart.
        </p>
        {services && workerName &&
          (services.some(item => item.name === workerName) ||
            archived.some(item => item.name === workerName)) &&
          <p role="alert" className="text-destructive text-xs">
            Service name already exists or is archived. Choose a different name.
          </p>}
        {!services && <p role="status" className="text-muted-foreground text-xs">
          Service inventory unavailable. Refresh services before creating a worker.
        </p>}
      </div>}
    </>}
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
      <section className="space-y-1 rounded-md border p-3" aria-label="Node.js source identity review">
        <p className="text-sm font-medium">Node.js source review: {nodeSourceReview.name}</p>
        <p className="break-all font-mono text-xs">SHA-256: {nodeSourceReview.sourceSha256}</p>
        <p className="text-xs">Size: {nodeSourceReview.sourceBytes} bytes · runit: {nodeSourceReview.observed} · autostart: {
          nodeSourceReview.autostart === null ? "unknown" :
            nodeSourceReview.autostart ? "enabled" : "disabled"
        }</p>
        <p className="text-xs text-muted-foreground">
          Inspected: {nodeSourceReview.checkedAt}. Source text and credentials are not returned.
          This proves file identity only, not safety or readiness. Starting Node.js code
          is blocked from LAN; device-owner authorization is not configured.
        </p>
        <Button variant="outline" disabled={busy}
          onClick={() => void loadNodeSourceHistory(nodeSourceReview.name)}>
          Read saved revisions
        </Button>
        {nodeSourceHistory?.name === nodeSourceReview.name &&
          nodeSourceHistory.currentSha256 === nodeSourceReview.sourceSha256 &&
          <div className="space-y-1 rounded-md border p-2">
            <p className="text-xs font-medium">Saved Node.js revisions ({nodeSourceHistory.revisions.length})</p>
            {nodeSourceHistory.revisions.length === 0 &&
              <p className="text-xs text-muted-foreground">No older revisions retained.</p>}
            {nodeSourceHistory.revisions.map(item =>
              <div key={item.id} className="flex flex-wrap items-center gap-2 border-b py-2">
                <div className="min-w-0 flex-1 text-xs">
                  <p>{item.savedAt} · {item.bytes} bytes</p>
                  <p className="break-all font-mono">SHA-256: {item.sourceSha256}</p>
                </div>
                <Button variant="outline"
                  disabled={busy || nodeSourceReview.observed !== "stopped" ||
                    nodeSourceReview.autostart !== false ||
                    nodeSourceHistory.revisions.length >= 8}
                  onClick={() => void restoreNodeRevision(item)}>Restore this source</Button>
              </div>)}
            {nodeSourceHistory.revisions.length >= 8 &&
              <p className="text-xs text-muted-foreground">
                Revision history full. Restore is blocked to preserve existing files.
              </p>}
          </div>}
        {nodeSourceReview.observed === "stopped" && nodeSourceReview.autostart === false ? <>
          <label htmlFor="node-replacement-source" className="text-sm font-medium">
            Replace staged worker.mjs (full source)
          </label>
          <Textarea id="node-replacement-source" rows={7}
            value={nodeReplacement} onChange={event => setNodeReplacement(event.target.value)}
            maxLength={32 * 1024} disabled={busy}
            placeholder="Paste the complete revised Node.js source" />
          <p className="text-xs text-muted-foreground">
            Exact-SHA update only. Old code retained in private history (maximum eight revisions).
            Failed partial writes require manual reconciliation. This does not run Node.js.
          </p>
          <Button variant="outline" disabled={busy ||
              !nodeReplacement.trim() || new Blob([nodeReplacement]).size > 32 * 1024}
            onClick={() => void replaceNodeSource()}>Replace staged Node.js source</Button>
        </> : <p className="text-xs text-muted-foreground">
          Revision requires a confirmed stopped worker with autostart disabled.
        </p>}
      </section>}
    {mode === "lifecycle" && sourceReview &&
      services?.some(service => service.name === sourceReview.name &&
        service.registered && service.control === "standalone" &&
        service.template === "python-source-v1") &&
      <section className="space-y-1 rounded-md border p-3" aria-label="Python source identity review">
        <p className="text-sm font-medium">Python source review: {sourceReview.name}</p>
        <p className="break-all font-mono text-xs">SHA-256: {sourceReview.sourceSha256}</p>
        <p className="text-xs">Size: {sourceReview.sourceBytes} bytes · runit: {sourceReview.observed} · autostart: {
          sourceReview.autostart === null ? "unknown" :
            sourceReview.autostart ? "enabled" : "disabled"
        }</p>
        <p className="text-xs text-muted-foreground">
          Inspected: {sourceReview.checkedAt}. Source text and credentials are not returned.
          This proves file identity only, not safety or readiness. Starting Python code
          is blocked from LAN; device-owner authorization is not configured.
        </p>
        <Button variant="outline" disabled={busy}
          onClick={() => void loadPythonSourceHistory(sourceReview.name)}>
          Read saved revisions
        </Button>
        {sourceHistory?.name === sourceReview.name &&
          sourceHistory.currentSha256 === sourceReview.sourceSha256 &&
          <div className="space-y-1 rounded-md border p-2">
            <p className="text-xs font-medium">Saved Python revisions ({sourceHistory.revisions.length})</p>
            {sourceHistory.revisions.length === 0 &&
              <p className="text-xs text-muted-foreground">No older revisions retained.</p>}
            {sourceHistory.revisions.map(item =>
              <div key={item.id} className="flex flex-wrap items-center gap-2 border-b py-2">
                <div className="min-w-0 flex-1 text-xs">
                  <p>{item.savedAt} · {item.bytes} bytes</p>
                  <p className="break-all font-mono">SHA-256: {item.sourceSha256}</p>
                </div>
                <Button variant="outline"
                  disabled={busy || sourceReview.observed !== "stopped" ||
                    sourceReview.autostart !== false ||
                    sourceHistory.revisions.length >= 8}
                  onClick={() => void restorePythonRevision(item)}>Restore this source</Button>
              </div>)}
            {sourceHistory.revisions.length >= 8 &&
              <p className="text-xs text-muted-foreground">
                Revision history full. Restore is blocked to preserve existing files.
              </p>}
          </div>}
        {sourceReview.observed === "stopped" && sourceReview.autostart === false ? <>
          <label htmlFor="python-replacement-source" className="text-sm font-medium">
            Replace staged worker.py (full source)
          </label>
          <Textarea id="python-replacement-source" rows={7}
            value={pythonReplacement} onChange={event => setPythonReplacement(event.target.value)}
            maxLength={32 * 1024} disabled={busy}
            placeholder="Paste the complete revised Python source" />
          <p className="text-xs text-muted-foreground">
            Exact-SHA update only. Old code retained in private history (maximum eight revisions).
            Failed partial writes require manual reconciliation. This does not run Python.
          </p>
          <Button variant="outline" disabled={busy ||
              !pythonReplacement.trim() || new Blob([pythonReplacement]).size > 32 * 1024}
            onClick={() => void replacePythonSource()}>Replace staged Python source</Button>
        </> : <p className="text-xs text-muted-foreground">
          Revision requires a confirmed stopped worker with autostart disabled.
        </p>}
      </section>}
    {mode === "lifecycle" && serviceLogs && <section className="space-y-2 rounded-md border p-3"
      aria-label={"Runit logs for " + serviceLogs.name}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">Runit logs: {serviceLogs.name}</p>
        <div className="flex flex-wrap gap-1">
          <Button variant="outline" disabled={busy}
            onClick={() => void readServiceLogs(serviceLogs.name)}>Refresh logs</Button>
          <Button variant="outline" disabled={busy}
            onClick={() => setServiceLogs(null)}>Close</Button>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Input aria-label="Search service logs" placeholder="Search recent lines"
          className="min-w-40 max-w-64" disabled={busy}
          value={logQuery} onChange={event => setLogQuery(event.target.value)} />
        {(["all", "errors", "warnings"] as const).map(level =>
          <Button key={level} disabled={busy} aria-pressed={logLevel === level}
            variant={logLevel === level ? "secondary" : "outline"}
            onClick={() => setLogLevel(level)}>
            {level === "all" ? "All" : level === "errors" ? "Errors" : "Warnings"}
          </Button>)}
      </div>
      {(() => {
        const visible = serviceLogs.lines.filter(line =>
          line.toLowerCase().includes(logQuery.trim().toLowerCase()) &&
          (logLevel === "all" ||
            (logLevel === "errors" ? /error|fatal|exception|failed|traceback/i.test(line) :
              /warn|warning|deprecat/i.test(line))))
        return <>
          <p className="text-xs text-muted-foreground">
            {visible.length} / {serviceLogs.lines.length} recent redacted lines · manual refresh only
          </p>
          <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words text-xs">
            {visible.length ? visible.join("\n") : "No matching log lines."}
          </pre>
        </>
      })()}
    </section>}
    <Feedback error={error} done={done} />
  </div>
}

