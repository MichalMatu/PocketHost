import { Button } from "@/components/ui/button"
import type { Project, RuntimeState } from "./node-project-client"

export function NodeProjectRemoval({ project, runtime, disabled, onRemove }: {
  project: Project; runtime: RuntimeState | null; disabled: boolean; onRemove: () => void
}) {
  const stopped = runtime?.desired === "stopped" &&
    (runtime.state === "stopped" || runtime.state === "not-provisioned")
  return <section className="space-y-2 rounded-md border p-3" aria-label="Remove Node project">
    <p className="text-sm text-muted-foreground">
      Remove this stopped project from Hosting. Source, application data and logs are retained.
      {!stopped && (runtime?.state === "stopped" && runtime.desired === "running"
        ? " Confirm stopped state above first." : " Review runtime and stop the project first.")}
    </p>
    <Button variant="destructive" disabled={disabled || !stopped} onClick={() => {
      if (window.confirm("Remove " + project.name + " from Hosting? Files and logs will be retained.")) onRemove()
    }}>Delete project</Button>
  </section>
}

export function verifyNodeRemoval(result: Record<string, unknown>, id: string) {
  if (result.removed !== true || result.id !== id || result.filesRetained !== true)
    throw new Error("Unverified project removal")
}
