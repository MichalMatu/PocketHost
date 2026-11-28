import { action, inspect } from "./admin-actions-api"
import type { PythonSourceReview, PythonSourceHistory, NodeSourceReview, NodeSourceHistory } from "./runit-service-inventory"

type SourceActionContext = {
  busy: boolean
  setBusy: (value: boolean) => void
  setError: (value: string | null) => void
  setDone: (value: string | null) => void
  refresh: () => Promise<unknown>
  sourceReview: PythonSourceReview | null
  setSourceReview: (value: PythonSourceReview | null) => void
  sourceHistory: PythonSourceHistory | null
  setSourceHistory: (value: PythonSourceHistory | null) => void
  nodeSourceReview: NodeSourceReview | null
  setNodeSourceReview: (value: NodeSourceReview | null) => void
  nodeSourceHistory: NodeSourceHistory | null
  setNodeSourceHistory: (value: NodeSourceHistory | null) => void
  pythonReplacement: string
  nodeReplacement: string
}

/** Source revisions retain the original identity checks and shared busy state. */
export function createRunitSourceActions({
  busy, setBusy, setError, setDone, refresh,
  sourceReview, setSourceReview, sourceHistory, setSourceHistory,
  nodeSourceReview, setNodeSourceReview, nodeSourceHistory, setNodeSourceHistory,
  pythonReplacement, nodeReplacement,
}: SourceActionContext) {
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
  return {
    reviewPythonSource, reviewNodeSource, loadPythonSourceHistory,
    restorePythonRevision, replacePythonSource, loadNodeSourceHistory,
    restoreNodeRevision, replaceNodeSource,
  }
}
