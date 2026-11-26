import { Play, Square, RotateCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { RuntimeState } from "./node-project-client"

type Operation = "start" | "stop" | "restart"

export function NodeLifecycleActions({ runtime, approved, onApprove, disabled, onAction, compact = false }: {
  runtime: RuntimeState | null; approved: boolean; onApprove: (value: boolean) => void
  compact?: boolean; disabled: boolean; onAction: (operation: Operation, message: string) => void
}) {
  const drift = runtime?.state === "stopped" && runtime.desired === "running"
  const blocked = disabled || (!compact && !approved)
  const verified = Boolean(runtime?.activeRelease && runtime.activeRelease === runtime.lastGoodRelease)
  const invoke = (operation: Operation, message: string, label: string) => {
    if (!compact || window.confirm(label + " this trusted Node application?")) onAction(operation, message)
  }
  return <section aria-label="Node runtime actions" className="space-y-2">
    {!compact && <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" aria-label="Approve local Node execution" checked={approved}
        onChange={event => onApprove(event.target.checked)} />
      Approve runtime actions for this trusted application.
    </label>}
    <div className="flex flex-wrap gap-2">
      {(!compact || (runtime?.state === "stopped" && !drift && verified)) && <Button variant={compact ? "default" : "outline"} disabled={blocked || runtime?.state !== "stopped" || drift || !verified}
        onClick={() => invoke("start", "Previously verified Node release started and readiness confirmed.", "Start")}>
        <Play aria-hidden="true" />{compact ? "Start" : "Start stopped service"}
      </Button>}
      {(!compact || runtime?.state === "running" || drift) && <Button variant="outline" disabled={blocked || !(runtime?.state === "running" || drift)}
        onClick={() => invoke("stop", "Owned Node service stopped.", drift ? "Confirm stopped state for" : "Stop")}>
        <Square aria-hidden="true" />{drift ? "Confirm stopped state" : compact ? "Stop" : "Stop owned service"}
      </Button>}
      {(!compact || (runtime?.state === "running" && verified)) && <Button variant="outline" disabled={blocked || runtime?.state !== "running" || !verified}
        onClick={() => invoke("restart", "Owned Node service restarted and readiness verified.", "Restart")}>
        <RotateCw aria-hidden="true" />{compact ? "Restart" : "Restart service"}
      </Button>}
    </div>
    {drift && <p role="status" className="text-sm text-muted-foreground">
      {compact ? "Process stopped. Confirm stopped state before starting or removing the application." : "Process is down, but its saved target is running. Approve and confirm stopped state to enable Start and Delete."}
    </p>}
  </section>
}
