import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import type { NodeSourceReview, PythonSourceReview, PythonSourceHistory } from "./runit-service-inventory"

type SourceReviewProps = {
  review: NodeSourceReview | PythonSourceReview
  history: PythonSourceHistory | null
  replacement: string
  setReplacement: (value: string) => void
  loadHistory: (name: string) => Promise<void>
  restoreRevision: (item: PythonSourceHistory["revisions"][number]) => Promise<void>
  replaceSource: () => Promise<void>
  busy: boolean
}

export function RunitSourceReview({
  review, history, replacement, setReplacement, loadHistory, restoreRevision, replaceSource, busy,
}: SourceReviewProps) {
  const node = review.template === "node-source-v1"
  const language = node ? "Node.js" : "Python"
  const filename = node ? "worker.mjs" : "worker.py"
  const inputId = node ? "node-replacement-source" : "python-replacement-source"
  return (
  <section className="space-y-1 rounded-md border p-3" aria-label={language + " source identity review"}>
    <p className="text-sm font-medium">{language} source review: {review.name}</p>
    <p className="break-all font-mono text-xs">SHA-256: {review.sourceSha256}</p>
    <p className="text-xs">Size: {review.sourceBytes} bytes · runit: {review.observed} · autostart: {
      review.autostart === null ? "unknown" :
        review.autostart ? "enabled" : "disabled"
    }</p>
    <p className="text-xs text-muted-foreground">
      Inspected: {review.checkedAt}. Source text and credentials are not returned.
      This proves file identity only, not safety or readiness. Starting {language} code
      is blocked from LAN; device-owner authorization is not configured.
    </p>
    <Button variant="outline" disabled={busy}
      onClick={() => void loadHistory(review.name)}>
      Read saved revisions
    </Button>
    {history?.name === review.name &&
      history.currentSha256 === review.sourceSha256 &&
      <div className="space-y-1 rounded-md border p-2">
        <p className="text-xs font-medium">Saved {language} revisions ({history.revisions.length})</p>
        {history.revisions.length === 0 &&
          <p className="text-xs text-muted-foreground">No older revisions retained.</p>}
        {history.revisions.map(item =>
          <div key={item.id} className="flex flex-wrap items-center gap-2 border-b py-2">
            <div className="min-w-0 flex-1 text-xs">
              <p>{item.savedAt} · {item.bytes} bytes</p>
              <p className="break-all font-mono">SHA-256: {item.sourceSha256}</p>
            </div>
            <Button variant="outline"
              disabled={busy || review.observed !== "stopped" ||
                review.autostart !== false ||
                history.revisions.length >= 8}
              onClick={() => void restoreRevision(item)}>Restore this source</Button>
          </div>)}
        {history.revisions.length >= 8 &&
          <p className="text-xs text-muted-foreground">
            Revision history full. Restore is blocked to preserve existing files.
          </p>}
      </div>}
    {review.observed === "stopped" && review.autostart === false ? <>
      <label htmlFor={inputId} className="text-sm font-medium">
        Replace staged {filename} (full source)
      </label>
      <Textarea id={inputId} rows={7}
        value={replacement} onChange={event => setReplacement(event.target.value)}
        maxLength={32 * 1024} disabled={busy}
        placeholder={"Paste the complete revised " + language + " source"} />
      <p className="text-xs text-muted-foreground">
        Exact-SHA update only. Old code retained in private history (maximum eight revisions).
        Failed partial writes require manual reconciliation. This does not run {language}.
      </p>
      <Button variant="outline" disabled={busy ||
          !replacement.trim() || new Blob([replacement]).size > 32 * 1024}
        onClick={() => void replaceSource()}>Replace staged {language} source</Button>
    </> : <p className="text-xs text-muted-foreground">
      Revision requires a confirmed stopped worker with autostart disabled.
    </p>}
  </section>
  )
}
