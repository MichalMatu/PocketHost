import { Button } from "@/components/ui/button"
import type { RuntimeState } from "./node-project-client"

type Operation = "start" | "stop" | "restart"

export function NodeLifecycleActions({ runtime, approved, onApprove, disabled, onAction }: {
  runtime: RuntimeState | null; approved: boolean; onApprove: (value: boolean) => void
  disabled: boolean; onAction: (operation: Operation, message: string) => void
}) {
  const drift = runtime?.state === "stopped" && runtime.desired === "running"
  const blocked = disabled || !approved
  const verified = Boolean(runtime?.activeRelease && runtime.activeRelease === runtime.lastGoodRelease)
  return <section aria-label="Node runtime actions" className="space-y-2">
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" aria-label="Approve local Node execution" checked={approved}
        onChange={event => onApprove(event.target.checked)} />
      Approve runtime actions for this trusted application.
    </label>
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" disabled={blocked || runtime?.state !== "stopped" || drift || !verified}
        onClick={() => onAction("start", "Previously verified Node release started and readiness confirmed.")}>
        Start stopped service
      </Button>
      <Button variant="outline" disabled={blocked || !(runtime?.state === "running" || drift)}
        onClick={() => onAction("stop", "Owned Node service stopped.")}>
        {drift ? "Confirm stopped state" : "Stop owned service"}
      </Button>
      <Button variant="outline" disabled={blocked || runtime?.state !== "running" || !verified}
        onClick={() => onAction("restart", "Owned Node service restarted and readiness verified.")}>
        Restart service
      </Button>
    </div>
    {drift && <p role="status" className="text-sm text-muted-foreground">
      Process is down, but its saved target is running. Approve and confirm stopped state to enable Start and Delete.
    </p>}
  </section>
}
