import type { RuntimeState } from "./node-project-client"
import { localEventTime, shortRelease } from "./node-project-display"

type Props = { history: RuntimeState["history"] }

/** Read-only presentation of the latest eight verified runtime events. */
export function NodeRuntimeHistory({ history }: Props) {
  if (history.length === 0) return null

  return (
    <details data-testid="node-history" className="rounded-lg border p-3 text-xs">
      <summary className="cursor-pointer font-medium">Runtime history ({history.length})</summary>
      <ol className="mt-2 space-y-1" aria-label="Node runtime history">
        {history.slice(-8).reverse().map((event, i) =>
          <li key={event.at + i}>
            <span className="text-muted-foreground">{localEventTime(event.at)}</span> · {event.action} ·
            <span title={event.release}> {shortRelease(event.release)}</span>
          </li>)}
      </ol>
    </details>
  )
}
