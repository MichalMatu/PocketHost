import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { NodeHostDiagnosticsView } from "./node-host-diagnostics-view"
import { createNodeProject } from "../actions/node-catalog-actions"
import type { NodeProjectController } from "../state/use-node-project-controller"

export function NodeCreateView({ controller, standalone = false, onCreated }: { controller: NodeProjectController; standalone?: boolean; onCreated?: (id: string) => void }) {
  const { name, setName, busy, createPhase, ownerAuthorized, catalogState, creatingRef, actionInFlight, action } = controller
  return <>
    <details data-testid="node-create-panel" className="rounded-xl border bg-card text-card-foreground" open={standalone || undefined}>
      <summary className="cursor-pointer px-4 py-3 text-sm font-semibold">
        Create Node.js project <span className="ml-2 text-xs font-normal text-muted-foreground">New application</span>
      </summary>
      <div className="space-y-3 border-t px-4 py-4">
        <div className="flex flex-wrap items-end gap-3">
        <label className="grid min-w-52 gap-1 text-sm">Project name
          <Input aria-label="Project name" value={name} maxLength={60} onChange={event => setName(event.target.value)} />
        </label>
        <Button disabled={busy || createPhase === "unknown" || createPhase === "pending" ||
          !ownerAuthorized || catalogState !== "ready" || name.trim().length < 2}
          onClick={() => {
            if (creatingRef.current || actionInFlight.current || createPhase === "unknown") return
            creatingRef.current = true
            action(async () => {
              await createNodeProject(controller, onCreated)
            })
          }}>Create project</Button>
        {!standalone && <NodeHostDiagnosticsView controller={controller} />}
        </div>
        {createPhase === "pending" && <p role="status" className="text-sm text-muted-foreground">
          Creating project… Do not submit again while the host processes this request.
        </p>}
        {createPhase === "confirmed" && <p role="status" className="text-sm text-muted-foreground">
          Project identity verified in the refreshed catalog.
        </p>}
        {createPhase === "rejected" && <p role="status" className="text-sm text-destructive">
          Project name was rejected. Correct the name before trying again.
        </p>}
        {createPhase === "unknown" && <p role="alert" className="text-sm text-destructive">
          The host may have created this project. Use Refresh above to inspect the catalog; do not resubmit yet.
        </p>}
      </div>
    </details>
  </>
}
