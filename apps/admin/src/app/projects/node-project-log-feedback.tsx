type Props = {
  lines: string[]
  loading: boolean
  error: string | null
  checked: boolean
}

/** Source-preserving, read-only feedback for one owned Node project's runit logs. */
export function NodeProjectLogFeedback({ lines, loading, error, checked }: Props) {
  return <>
    {loading && <p role="status" className="text-xs text-muted-foreground">
      Reading Node logs for selected project…
    </p>}
    {error && <p role="alert" className="text-xs text-muted-foreground">
      {error}
    </p>}
    {checked && !loading && !error && lines.length === 0 && (
      <p role="status" className="text-xs text-muted-foreground">
        No owned Node runtime log lines in this snapshot.
      </p>
    )}
    {!loading && !error && lines.length > 0 && (
      <pre aria-label="Node runit logs" className="max-h-52 overflow-auto whitespace-pre-wrap rounded-md border p-3 text-xs">
        {lines.join("\n")}
      </pre>
    )}
  </>
}
