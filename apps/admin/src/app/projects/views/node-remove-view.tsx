import { NodeProjectRemoval } from "../node-project-removal"
import { removeNodeProject } from "../actions/node-catalog-actions"
import type { SelectedNodeController } from "../state/use-node-project-controller"

export function NodeRemoveView({ controller, onRemoved }: { controller: SelectedNodeController; onRemoved?: () => void }) {
  const { selected, runtime, busy, ownerAuthorized, catalogState, action } = controller
  return <>
    <NodeProjectRemoval project={selected} runtime={runtime} disabled={busy || !ownerAuthorized || catalogState !== "ready"}
      onRemove={() => action(async () => {
        await removeNodeProject(controller, onRemoved)
      })} />
  </>
}
