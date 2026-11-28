import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type LogLevel = "all" | "errors" | "warnings"
type LogsProps = {
  serviceLogs: { name: string; lines: string[] }
  busy: boolean
  readServiceLogs: (name: string) => Promise<void>
  setServiceLogs: (value: { name: string; lines: string[] } | null) => void
  logQuery: string
  setLogQuery: (value: string) => void
  logLevel: LogLevel
  setLogLevel: (value: LogLevel) => void
}

export function RunitLogsPanel({
  serviceLogs, busy, readServiceLogs, setServiceLogs, logQuery, setLogQuery, logLevel, setLogLevel,
}: LogsProps) {
  return (
    <section className="space-y-2 rounded-md border p-3"
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
    </section>
  )
}
