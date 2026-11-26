import { NodeDataPanel } from "../node-data-panel"
import type { NodeProjectController } from "../state/use-node-project-controller"

export function NodeDataView({ controller }: { controller: NodeProjectController }) {
  const { selected, ownerAuthorized, busy, action, getJson } = controller
  return <>
    <NodeDataPanel key={(selected?.id ?? "none") + ":" + String(ownerAuthorized)}
       projectId={selected?.id ?? null} ownerAuthorized={ownerAuthorized}
      busy={busy} action={action} getJson={getJson} />
  </>
}
