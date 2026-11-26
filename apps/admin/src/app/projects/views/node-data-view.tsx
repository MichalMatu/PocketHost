import { NodeDataPanel } from "../node-data-panel"
import type { NodeProjectController } from "../state/use-node-project-controller"

export function NodeDataView({ controller, standalone = false }: { controller: NodeProjectController; standalone?: boolean }) {
  const { selected, ownerAuthorized, busy, action, getJson } = controller
  return <>
    <NodeDataPanel standalone={standalone} key={(selected?.id ?? "none") + ":" + String(ownerAuthorized)}
       projectId={selected?.id ?? null} ownerAuthorized={ownerAuthorized}
      busy={busy} action={action} getJson={getJson} />
  </>
}
