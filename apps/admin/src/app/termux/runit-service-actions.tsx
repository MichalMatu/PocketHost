import * as React from "react"
import { Link } from "react-router-dom"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Feedback } from "./admin-actions-feedback"
import { action, inspect } from "./admin-actions-api"

import {
  isPanelService, confirmedStoppedWorker,
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
  const reviewPythonSource = async (name: string) => {
    if (busy) return
    setBusy(true); setError(null); setSourceReview(null); setSourceHistory(null)
    try {
      const result = await inspect<PythonSourceReview>("python-source-review", name)
      if (result.name !== name || result.template !== "python-source-v1" ||
          !/^[a-f0-9]{64}$/.test(result.sourceSha256) ||
          !Number.isSafeInteger(result.sourceBytes) || result.sourceBytes < 1 ||
          result.sourceBytes > 32 * 1024 ||
          !["running", "stopped", "unknown"].includes(result.observed) ||
          ![true, false, null].includes(result.autostart) ||
          result.canStartFromLan !== false || result.ownerApproval !== "not-configured" ||
          !Number.isFinite(Date.parse(result.checkedAt)))
        throw new Error("Invalid Python source review")
      setSourceReview(result)
    } catch {
      setError("Python source identity review refused or unavailable. Recheck ownership.")
    } finally { setBusy(false) }
  }
  const reviewNodeSource = async (name: string) => {
    if (busy) return
    setBusy(true); setError(null); setNodeSourceReview(null); setNodeSourceHistory(null)
    try {
      const result = await inspect<NodeSourceReview>("node-source-review", name)
      if (result.name !== name || result.template !== "node-source-v1" ||
          !/^[a-f0-9]{64}$/.test(result.sourceSha256) ||
          !Number.isSafeInteger(result.sourceBytes) || result.sourceBytes < 1 ||
          result.sourceBytes > 32 * 1024 ||
          !["running", "stopped", "unknown"].includes(result.observed) ||
          ![true, false, null].includes(result.autostart) ||
          result.canStartFromLan !== false || result.ownerApproval !== "not-configured" ||
          !Number.isFinite(Date.parse(result.checkedAt)))
        throw new Error("Invalid Node.js source review")
      setNodeSourceReview(result)
    } catch {
      setError("Node.js source identity review refused or unavailable. Recheck ownership.")
    } finally { setBusy(false) }
  }
  const loadPythonSourceHistory = async (name: string) => {
    if (busy || sourceReview?.name !== name) return
    setBusy(true); setError(null); setSourceHistory(null)
    try {
      const result = await inspect<PythonSourceHistory>("python-source-history", name)
      if (result.name !== name || result.currentSha256 !== sourceReview.sourceSha256 ||
          result.execution !== "blocked" || !Array.isArray(result.revisions) ||
          result.revisions.length > 8 || result.revisions.some(item =>
            !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(item.id) ||
            !/^[a-f0-9]{64}$/.test(item.sourceSha256) ||
            !Number.isSafeInteger(item.bytes) || item.bytes < 1 || item.bytes > 32768 ||
            !Number.isFinite(Date.parse(item.savedAt))))
        throw new Error("Revision history unavailable or stale")
      setSourceHistory(result)
    } catch {
      setError("Python revision history unverified. Refresh the source review.")
    } finally { setBusy(false) }
  }
  const restorePythonRevision = async (item: PythonSourceHistory["revisions"][number]) => {
    const record = sourceReview, history = sourceHistory
    if (busy || !record || !history || record.name !== history.name ||
        record.sourceSha256 !== history.currentSha256 ||
        record.observed !== "stopped" || record.autostart !== false) return
    if (window.prompt("Restore saved Python revision " + item.id +
        " for " + record.name + "? Type the exact service name.") !== record.name ||
        !window.confirm("Restore SHA-256 " + item.sourceSha256 +
          "? The current source will be retained and no Python code will execute.")) return
    setBusy(true); setError(null); setDone(null)
    setSourceHistory(null); setSourceReview(null)
    try {
      const result = await action<{
        changed: boolean; sourceSha256: string; sourceBytes: number; execution: "blocked"
      }>({ action: "service-python-restore", path: record.name,
        name: item.id, root: record.sourceSha256, destination: item.sourceSha256 })
      if (result.sourceSha256 !== item.sourceSha256 || result.execution !== "blocked" ||
          typeof result.changed !== "boolean" ||
          !Number.isSafeInteger(result.sourceBytes) ||
          result.sourceBytes < 1 || result.sourceBytes > 32768)
        throw new Error("Unexpected Python restore receipt")
      await refresh()
      setDone(record.name + ": previous Python source restored, execution still blocked")
    } catch {
      setError("Python source restore refused or unconfirmed. Refresh identity before any retry.")
    } finally { setBusy(false) }
  }
  const replacePythonSource = async () => {
    const review = sourceReview
    const bytes = new Blob([pythonReplacement]).size
    if (busy || !review || review.observed !== "stopped" ||
        review.autostart !== false || !pythonReplacement.trim() ||
        bytes < 1 || bytes > 32 * 1024) return
    if (window.prompt(
      "Replace the source for " + review.name +
      "? Enter the exact service name. The previous source is retained privately " +
      "and the new source will NOT execute.",
    ) !== review.name || !window.confirm(
      "Commit new worker.py for " + review.name + " only if its SHA-256 remains " +
      review.sourceSha256 + "? Start and autostart will stay blocked.",
    )) return
    setBusy(true); setError(null); setDone(null)
    // Any uncertain response must invalidate the old digest, not retry.
    setSourceReview(null)
    try {
      const result = await action<{
        changed: boolean; sourceSha256: string; sourceBytes: number; execution: "blocked"
      }>({ action: "service-python-update", path: review.name,
        destination: review.sourceSha256, content: pythonReplacement })
      if (typeof result.changed !== "boolean" ||
          !/^[a-f0-9]{64}$/.test(result.sourceSha256) ||
          !Number.isSafeInteger(result.sourceBytes) ||
          result.sourceBytes < 1 || result.sourceBytes > 32 * 1024 ||
          result.execution !== "blocked")
        throw new Error("Python revision receipt invalid")
      await refresh()
      setDone(review.name + ": source revision acknowledged. Review its new SHA before further changes.")
    } catch {
      setError("Python revision refused or unconfirmed. Inspect current source/marker; never retry blindly.")
    } finally {
      setBusy(false)
    }
  }
  const loadNodeSourceHistory = async (name: string) => {
    if (busy || nodeSourceReview?.name !== name) return
    setBusy(true); setError(null); setNodeSourceHistory(null)
    try {
      const result = await inspect<NodeSourceHistory>("node-source-history", name)
      if (result.name !== name || result.currentSha256 !== nodeSourceReview.sourceSha256 ||
          result.execution !== "blocked" || !Array.isArray(result.revisions) ||
          result.revisions.length > 8 || result.revisions.some(item =>
            !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(item.id) ||
            !/^[a-f0-9]{64}$/.test(item.sourceSha256) ||
            !Number.isSafeInteger(item.bytes) || item.bytes < 1 || item.bytes > 32768 ||
            !Number.isFinite(Date.parse(item.savedAt))))
        throw new Error("Revision history unavailable or stale")
      setNodeSourceHistory(result)
    } catch {
      setError("Node.js revision history unverified. Refresh the source review.")
    } finally { setBusy(false) }
  }
  const restoreNodeRevision = async (item: NodeSourceHistory["revisions"][number]) => {
    const record = nodeSourceReview, history = nodeSourceHistory
    if (busy || !record || !history || record.name !== history.name ||
        record.sourceSha256 !== history.currentSha256 ||
        record.observed !== "stopped" || record.autostart !== false) return
    if (window.prompt("Restore saved Node.js revision " + item.id +
        " for " + record.name + "? Type the exact service name.") !== record.name ||
        !window.confirm("Restore SHA-256 " + item.sourceSha256 +
          "? The current source will be retained and no Node.js code will execute.")) return
    setBusy(true); setError(null); setDone(null)
    setNodeSourceHistory(null); setNodeSourceReview(null)
    try {
      const result = await action<{
        changed: boolean; sourceSha256: string; sourceBytes: number; execution: "blocked"
      }>({ action: "service-node-restore", path: record.name,
        name: item.id, root: record.sourceSha256, destination: item.sourceSha256 })
      if (result.sourceSha256 !== item.sourceSha256 || result.execution !== "blocked" ||
          typeof result.changed !== "boolean" ||
          !Number.isSafeInteger(result.sourceBytes) ||
          result.sourceBytes < 1 || result.sourceBytes > 32768)
        throw new Error("Unexpected Node.js restore receipt")
      await refresh()
      setDone(record.name + ": previous Node.js source restored, execution still blocked")
    } catch {
      setError("Node.js source restore refused or unconfirmed. Refresh identity before any retry.")
    } finally { setBusy(false) }
  }
  const replaceNodeSource = async () => {
    const review = nodeSourceReview
    const bytes = new Blob([nodeReplacement]).size
    if (busy || !review || review.observed !== "stopped" ||
        review.autostart !== false || !nodeReplacement.trim() ||
        bytes < 1 || bytes > 32 * 1024) return
    if (window.prompt(
      "Replace the source for " + review.name +
      "? Enter the exact service name. The previous source is retained privately " +
      "and the new source will NOT execute.",
    ) !== review.name || !window.confirm(
      "Commit new worker.mjs for " + review.name + " only if its SHA-256 remains " +
      review.sourceSha256 + "? Start and autostart will stay blocked.",
    )) return
    setBusy(true); setError(null); setDone(null)
    // Any uncertain response must invalidate the old digest, not retry.
    setNodeSourceReview(null)
    try {
      const result = await action<{
        changed: boolean; sourceSha256: string; sourceBytes: number; execution: "blocked"
      }>({ action: "service-node-update", path: review.name,
        destination: review.sourceSha256, content: nodeReplacement })
      if (typeof result.changed !== "boolean" ||
          !/^[a-f0-9]{64}$/.test(result.sourceSha256) ||
          !Number.isSafeInteger(result.sourceBytes) ||
          result.sourceBytes < 1 || result.sourceBytes > 32 * 1024 ||
          result.execution !== "blocked")
        throw new Error("Node.js revision receipt invalid")
      await refresh()
      setDone(review.name + ": source revision acknowledged. Review its new SHA before further changes.")
    } catch {
      setError("Node.js revision refused or unconfirmed. Inspect current source/marker; never retry blindly.")
    } finally {
      setBusy(false)
    }
  }
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
  const perform = async (name: "start" | "stop" | "restart" | "enable" | "disable", service: RunitEntry) => {
    if (busy || service.control !== "standalone" || service.protected || isPanelService(service) ||
        (mode === "autostart" && name !== "enable" && name !== "disable") ||
        (mode === "lifecycle" && (name === "enable" || name === "disable")) ||
        !window.confirm(
      name === "enable"
        ? "Enable persistent runit autostart for " + service.name +
          "? Removing its down marker can also start the service now. " +
          "This does not configure Android/Termux:Boot."
        : name === "disable"
          ? "Disable persistent runit autostart for " + service.name +
            "? This records the down marker and may stop the service now."
          : "Run " + name + " for explicitly registered runit service " + service.name + "?",
    )) return
    setBusy(true); setError(null); setDone(null)
    try {
      const receipt = await action<{ changed: boolean; result?: { exit: number; output: string } }>(
        { action: "service", name, path: service.name })
      if (receipt?.changed !== true || !receipt.result || receipt.result.exit !== 0 ||
          typeof receipt.result.output !== "string" || receipt.result.output.length > 12000)
        throw new Error("Unverified runit command receipt")
      try {
        const live = await refresh()
        const observed = live.services.find(item => item.name === service.name)
        if (!observed || !observed.registered || observed.protected ||
            observed.identity !== "verified" ||
            observed.identityReason !== "run-sha-attested" ||
            observed.control !== "standalone" ||
            observed.template !== service.template) {
          setError("Command acknowledged, but service ownership changed or was not read back. Do not retry.")
          return
        }
        if (name === "enable" || name === "disable") {
          if (observed.enabled !== (name === "enable")) {
            setError("Autostart command acknowledged, but persistent policy was not verified.")
            return
          }
          setDone(service.name + ": runit autostart " +
            (observed.enabled ? "enabled" : "disabled") + " · saved and verified")
        } else {
          const expected = name === "stop" ? "stopped" : "running"
          if (observed.state !== expected) {
            setError("Runit " + name + " acknowledged, but current state is " +
              observed.state + " (expected " + expected + "). Inspect before another action.")
            return
          }
          setDone(service.name + ": runit " + name +
            " confirmed " + observed.state + " · application readiness not verified")
        }
      } catch {
        setError("Service command acknowledged, but inventory readback failed. Inspect before another command.")
      }
    } catch {
      setError("Service result unconfirmed or refused. Verify registration and live state before retrying.")
    } finally { setBusy(false) }
  }
  const archiveWorker = async (service: RunitEntry) => {
    if (busy || !service.template || service.control !== "standalone" ||
        !service.registered || service.protected ||
        service.state !== "stopped" || service.enabled !== false ||
        !window.confirm("Archive PocketHost worker " + service.name +
          "? This detaches its own runit supervisor and removes it from the service inventory. " +
          "The run script and logs are retained for recovery; no foreign files are deleted.")) return
    setBusy(true); setError(null); setDone(null)
    try {
      const receipt = await action<{ changed: boolean; archived: boolean; retainedFiles: boolean }>(
        { action: "service-archive", name: service.template, path: service.name })
      if (receipt.changed !== true || receipt.archived !== true || receipt.retainedFiles !== true)
        throw new Error("Archive receipt incomplete")
      try {
        const snapshot = await refresh()
        const saved = snapshot.archived.find(item => item.name === service.name)
        if (snapshot.services.some(item => item.name === service.name) ||
            saved?.template !== service.template || saved.identity !== "restorable") {
          setError("Archive acknowledged, but ownership or archive readback is inconsistent. Do not retry.")
          return
        }
        setServiceLogs(previous => previous?.name === service.name ? null : previous)
        setDone(service.name + ": worker archived and verified; script and logs retained")
      } catch {
        setError("Archive acknowledged but inventory refresh failed. Verify state before any follow-up.")
      }
    } catch {
      setError("Archive refused or unconfirmed. Verify worker identity and stopped state before retrying.")
    } finally { setBusy(false) }
  }
  const restoreWorker = async (entry: ArchivedEntry) => {
    if (busy || entry.identity !== "restorable" ||
        !window.confirm("Restore archived " +
          (entry.template === "python-source-v1" ? "Python source" :
            entry.template === "node-source-v1" ? "Node.js source" :
            entry.template === "python-heartbeat-v1" ? "Python" : "Node.js") +
          " service " + entry.name +
          "? The application worker stays stopped with autostart disabled. " +
          "Runit may launch only its own supervisor/logger.")) return
    setBusy(true); setError(null); setDone(null)
    try {
      const receipt = await action<{ changed: boolean; restored: boolean; started: boolean }>(
        { action: "service-restore", name: entry.template, path: entry.name })
      if (receipt.changed !== true || receipt.restored !== true || receipt.started !== false)
        throw new Error("Restore receipt incomplete")
      try {
        const snapshot = await refresh()
        if (!confirmedStoppedWorker(snapshot.services, entry.name, entry.template) ||
            snapshot.archived.some(item => item.name === entry.name)) {
          setError("Restore acknowledged, but verified stopped ownership was not read back. Do not retry.")
          return
        }
        setDone(entry.name + ": restored, verified and stopped; autostart disabled")
      } catch {
        setError("Restore acknowledged but inventory refresh failed. Verify before any lifecycle action.")
      }
    } catch {
      setError("Restore refused or unconfirmed. Check archived identity; do not retry automatically.")
    } finally { setBusy(false) }
  }
  const retireWorker = async (entry: ArchivedEntry) => {
    if (busy || entry.identity !== "restorable") return
    const typed = window.prompt(
      "Retire " + entry.name + "? This permanently revokes restoration in PocketHost. " +
      "The owned script and logs will be quarantined on the device, not deleted. " +
      "Type the exact service name to confirm.",
    )
    if (typed !== entry.name ||
        !window.confirm("Retire " + entry.name +
          " from the PocketHost registry? The service cannot be restored from the panel. " +
          "Files remain in private on-device quarantine for manual review.")) return
    setBusy(true); setError(null); setDone(null)
    try {
      const response = await action<{
        changed: boolean; retired: boolean; restorable: boolean; filesRetained: boolean
      }>({ action: "service-retire", name: entry.template, path: entry.name })
      if (response.changed !== true || response.retired !== true ||
          response.restorable !== false || response.filesRetained !== true)
        throw new Error("Unverified retirement receipt")
      try {
        const snapshot = await refresh()
        if (snapshot.archived.some(item => item.name === entry.name) ||
            snapshot.services.some(item => item.name === entry.name)) {
          setError("Retirement acknowledged, but service or archive remains visible. Inspect before retrying.")
          return
        }
        setServiceLogs(previous => previous?.name === entry.name ? null : previous)
        setDone(entry.name + ": retired from registry; definition and logs quarantined")
      } catch {
        setError("Retirement acknowledged but archive inventory is unavailable. Inspect before retrying.")
      }
    } catch {
      setError("Retirement refused or unconfirmed. Do not repeat automatically; inspect archive state.")
    } finally { setBusy(false) }
  }
  const createWorker = async () => {
    const name = workerName.trim()
    const custom = workerTemplate === "python-source-v1" || workerTemplate === "node-source-v1"
    // A verified inventory is required even to create a new worker. A failed
    // refresh must never leave an old creator form authorized to submit.
    if (busy || !services ||
        services.some(item => item.name === name) ||
        archived.some(item => item.name === name) ||
        !/^[a-z][a-z0-9-]{1,63}$/.test(name) ||
        (custom && (!pythonSource.trim() ||
          new Blob([pythonSource]).size > 32 * 1024)) ||
      !window.confirm(custom
        ? "Stage exact " + (workerTemplate === "node-source-v1" ? "Node.js" : "Python") +
          " source for " + name + "? Code will NOT execute from this LAN panel. The file is saved" +
          " with SHA-256 and requires a separately authorized owner executor."
        : "Create a new stopped PocketHost-owned " +
          (workerTemplate === "python-heartbeat-v1" ? "Python" : "Node.js") +
          " heartbeat worker " + name +
          "? It uses a fixed, isolated template and will not start automatically.")) return
    setBusy(true); setError(null); setDone(null)
    try {
      const receipt = await action<{ changed: boolean; name: string; template: WorkerTemplate }>(
        { action: "service-create", name: workerTemplate, path: name,
          ...(custom ? { content: pythonSource } : {}) })
      if (receipt.changed !== true || receipt.name !== name || receipt.template !== workerTemplate)
        throw new Error("Creation receipt incomplete")
      try {
        const snapshot = await refresh()
        if (!confirmedStoppedWorker(snapshot.services, name, workerTemplate) ||
            snapshot.archived.some(item => item.name === name)) {
          setError("Service created, but stopped ownership and autostart were not verified. Inspect before retrying.")
          return
        }
        setDone(name + (custom
          ? ": source staged, verified and stopped · execution blocked in LAN Services"
          : ": verified stopped worker · autostart disabled"))
        setCreatorOpen(false); setWorkerName(""); setPythonSource("")
      } catch {
        setError("Creation acknowledged but inventory refresh failed. Verify identity before retrying.")
      }
    } catch (error) {
      setError(error instanceof Error && error.message.startsWith("Creation blocked:")
        ? error.message
        : "Service creation refused or unconfirmed. Refresh before retrying; no automatic retry.")
    } finally { setBusy(false) }
  }
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
  const serviceRow = (service: RunitEntry) => <div className="flex flex-wrap items-center justify-between gap-2 border-b py-2" key={service.name}>
      <div className="space-y-1">
        <p className="text-sm font-medium">{service.name}</p>
        <div className="flex flex-wrap gap-2" aria-label={"Status for " + service.name}>
          <Badge variant="outline">State: {service.state}</Badge>
          <Badge variant="outline">{service.enabled === null || service.enabled === undefined ? "Autostart unknown" :
            service.enabled ? "Autostart enabled" : "Autostart disabled"}</Badge>
          <Badge variant="outline">{isPanelService(service) ? "PocketHost-owned" :
            service.control === "standalone" ? "Standalone · attested" :
            service.control === "delegated" ? "Provisioner-owned · attested" :
            service.identity === "archive-conflict" ? "Archive conflict · blocked" :
            service.identity === "changed" ? "Identity changed · blocked" :
            service.identity === "legacy" ? "Legacy record · needs reattestation" :
            service.identity === "unregistered" ? "Discovered · unverified" : "Protected · read-only"}</Badge>
          {service.template && <Badge variant="outline">{service.template === "node-source-v1" ? "Node.js source · execution blocked" :
            service.template === "python-source-v1" ? "Python source · execution blocked" :
            service.template === "python-heartbeat-v1" ? "Python heartbeat" : "Node.js heartbeat"}</Badge>}
          {service.project && <Badge variant="outline">Node project: {service.project.name}</Badge>}
        </div>
      </div>
      {service.control === "read-only" && service.identityReason &&
        <p className="text-xs text-muted-foreground" aria-label={"Ownership for " + service.name}>
          {service.identityReason === "worker-provenance-changed" ? "Worker owner marker, source, logger or runit link is unverified. Controls blocked; inspect before repair." :
           service.identityReason === "service-not-published" ? "Enrolled service is missing from runit. No commands allowed; inspect before repair." :
           service.identityReason === "service-target-changed" ? "Recorded service path no longer matches. Commands blocked." :
           service.identityReason === "run-script-changed" ? "Recorded run script SHA-256 no longer matches. Commands blocked." :
           service.identityReason === "legacy-without-sha" ? "Old enrollment lacks a verified script digest. Commands blocked." :
           service.identityReason === "archive-live-conflict" ? "Archived and live enrollment conflict. Commands blocked." :
           service.identityReason === "no-enrollment" ? "Discovered only; no verified enrollment. Commands blocked." :
           "Protected system service. Commands blocked."}
        </p>}
      {mode === "autostart" && service.control === "standalone" && <p
        className="text-xs text-muted-foreground"
        role={service.enabled == null ||
          (service.enabled && service.state === "stopped") ||
          (service.enabled === false && service.state === "running") ? "alert" : undefined}>
        {service.enabled == null || service.state === "unknown"
          ? "Runit policy or process state unverified. No action inferred."
          : service.template === "python-source-v1" || service.template === "node-source-v1"
            ? service.enabled || service.state === "running"
              ? "Custom source is active despite LAN execution restrictions. Inspect locally; do not assume ownership of its process."
              : "Custom source staged and stopped. LAN activation remains blocked."
            : service.enabled && service.state === "running"
              ? "Runit policy: start enabled; supervisor reports running. Application readiness not verified."
              : service.enabled && service.state === "stopped"
                ? "Policy/state mismatch: runit enabled, worker stopped. Inspect Health; no automatic recovery."
                : !service.enabled && service.state === "running"
                  ? "Policy/state mismatch: runit disabled, worker still running. Inspect before changing policy."
                  : "Runit policy: manual stop recorded; worker stopped. Android boot behavior not verified."}
      </p>}
      {service.state === "unknown" && mode === "lifecycle" &&
        <p className="text-xs text-muted-foreground">
          Runtime state unknown. Start, Stop and Restart require a confirmed state.
        </p>}
      {service.control === "delegated" && <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">
          Managed by its creator. Generic runit actions are blocked to protect release identity.
        </span>
        <Link to={service.project ? "/projects?project=" + encodeURIComponent(service.project.id) : "/projects"}
          className="text-xs underline underline-offset-4">
          {service.project ? "Open owning project" : "Review Projects"}
        </Link>
      </div>}
      {service.control === "standalone" && !isPanelService(service) && <div className="flex flex-wrap gap-1">
        {mode === "lifecycle" ? (service.registered ? <>
          <Button size="sm" disabled={busy || service.state !== "stopped" ||
              (service.template === "python-source-v1" || service.template === "node-source-v1")}
            onClick={() => void perform("start", service)}>Start</Button>
          <Button size="sm" variant="outline" disabled={busy || service.state !== "running"}
            onClick={() => void perform("stop", service)}>Stop</Button>
          <Button size="sm" variant="outline" disabled={busy || service.state !== "running" ||
              (service.template === "python-source-v1" || service.template === "node-source-v1")}
            onClick={() => void perform("restart", service)}>Restart</Button>
          <Button size="sm" variant="outline" disabled={busy}
            onClick={() => void readServiceLogs(service.name)}>Logs</Button>
          {service.template === "python-source-v1" &&
            <Button size="sm" variant="outline" disabled={busy}
              onClick={() => void reviewPythonSource(service.name)}>Review Python source</Button>}
          {service.template === "node-source-v1" &&
            <Button size="sm" variant="outline" disabled={busy}
              onClick={() => void reviewNodeSource(service.name)}>Review Node.js source</Button>}
          {service.template &&
            <Button size="sm" variant="outline"
              disabled={busy || service.state !== "stopped" || service.enabled !== false}
              title="Archive only the attested PocketHost worker. Keeps its script and logs."
              onClick={() => void archiveWorker(service)}>Archive worker</Button>}
        </> : <span className="text-xs text-muted-foreground">Not enrolled</span>) :
          (service.registered ? <>
            <Button size="sm" variant="outline"
              disabled={busy || service.enabled !== false ||
                (service.template === "python-source-v1" || service.template === "node-source-v1")}
              onClick={() => void perform("enable", service)}>Enable autostart</Button>
            <Button size="sm" variant="outline"
              disabled={busy || service.enabled !== true}
              onClick={() => void perform("disable", service)}>Disable autostart</Button>
          </> : <span className="text-xs text-muted-foreground">
            Not enrolled · register in Runit services first
          </span>)}
      </div>}
  </div>
  return <div className="space-y-3 rounded-md border p-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className="text-sm font-medium">{mode === "autostart" ? "Autostart registry" : "Runit services"}</h3>
      <Button size="sm" variant="outline" disabled={busy} onClick={() => void refresh().catch(() => setError("Runit services unavailable"))}>Refresh services</Button>
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
        <Button size="sm" variant="outline"
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
          <Button size="sm" disabled={busy}
            variant={workerTemplate === "heartbeat-worker-v1" ? "secondary" : "outline"}
            aria-pressed={workerTemplate === "heartbeat-worker-v1"}
            onClick={() => setWorkerTemplate("heartbeat-worker-v1")}>Node.js</Button>
          <Button size="sm" disabled={busy}
            variant={workerTemplate === "python-heartbeat-v1" ? "secondary" : "outline"}
            aria-pressed={workerTemplate === "python-heartbeat-v1"}
            onClick={() => setWorkerTemplate("python-heartbeat-v1")}>Python heartbeat</Button>
          <Button size="sm" disabled={busy}
            variant={workerTemplate === "python-source-v1" ? "secondary" : "outline"}
            aria-pressed={workerTemplate === "python-source-v1"}
            onClick={() => setWorkerTemplate("python-source-v1")}>My Python code</Button>
          <Button size="sm" disabled={busy}
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
          <Button size="sm" disabled={busy || !services ||
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
          <Button size="sm" disabled={busy} onClick={() => {
            setWorkerTemplate("heartbeat-worker-v1")
            setCreatorOpen(true)
          }}>Create standalone worker</Button>
          <Button size="sm" variant="outline" render={<Link to="/projects" />}>
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
          <Button size="sm" variant="outline" disabled={busy || entry.identity !== "restorable"}
            onClick={() => void readServiceLogs(entry.name)}>Saved logs</Button>
          <Button size="sm" variant="outline" disabled={busy || entry.identity !== "restorable"}
            onClick={() => void restoreWorker(entry)}>Restore service</Button>
          <Button size="sm" variant="outline" disabled={busy || entry.identity !== "restorable"}
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
        <Button size="sm" variant="outline" disabled={busy}
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
                <Button size="sm" variant="outline"
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
          <Button size="sm" variant="outline" disabled={busy ||
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
        <Button size="sm" variant="outline" disabled={busy}
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
                <Button size="sm" variant="outline"
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
          <Button size="sm" variant="outline" disabled={busy ||
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
          <Button size="sm" variant="outline" disabled={busy}
            onClick={() => void readServiceLogs(serviceLogs.name)}>Refresh logs</Button>
          <Button size="sm" variant="outline" disabled={busy}
            onClick={() => setServiceLogs(null)}>Close</Button>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Input aria-label="Search service logs" placeholder="Search recent lines"
          className="min-w-40 max-w-64" disabled={busy}
          value={logQuery} onChange={event => setLogQuery(event.target.value)} />
        {(["all", "errors", "warnings"] as const).map(level =>
          <Button size="sm" key={level} disabled={busy} aria-pressed={logLevel === level}
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

