import type { Dispatch, SetStateAction } from "react"
import { action } from "./admin-actions-api"
import {
  isPanelService, confirmedStoppedWorker,
  type WorkerTemplate, type ArchivedEntry, type RunitEntry,
} from "./runit-service-inventory"

type LifecycleContext = {
  mode: "lifecycle" | "autostart"
  busy: boolean
  setBusy: (value: boolean) => void
  setError: (value: string | null) => void
  setDone: (value: string | null) => void
  refresh: () => Promise<{ services: RunitEntry[]; archived: ArchivedEntry[] }>
  services: RunitEntry[] | null
  archived: ArchivedEntry[]
  setServiceLogs: Dispatch<SetStateAction<{ name: string; lines: string[] } | null>>
  workerName: string
  workerTemplate: WorkerTemplate
  pythonSource: string
  setCreatorOpen: (value: boolean) => void
  setWorkerName: (value: string) => void
  setPythonSource: (value: string) => void
}

/** Worker changes remain gated by ownership, confirmation and fresh readback. */
export function createRunitLifecycleActions({
  mode, busy, setBusy, setError, setDone, refresh, services, archived,
  setServiceLogs, workerName, workerTemplate, pythonSource,
  setCreatorOpen, setWorkerName, setPythonSource,
}: LifecycleContext) {
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
  return { perform, archiveWorker, restoreWorker, retireWorker, createWorker }
}
