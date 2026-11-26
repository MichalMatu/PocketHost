import { NodeBackupPanel } from "../node-backup-panel"
import type { NodeProjectController } from "../state/use-node-project-controller"

export function NodeBackupsView({ controller, standalone = false }: { controller: NodeProjectController; standalone?: boolean }) {
  const { catalogState, ownerAuthorized, busy, action, getJson, setMessage } = controller
  return <>
    <NodeBackupPanel standalone={standalone} key={String(catalogState === "ready") + ":" + String(ownerAuthorized)}
       catalogReady={catalogState === "ready"} ownerAuthorized={ownerAuthorized}
      busy={busy} action={action} getJson={getJson} onMessage={setMessage} />
  </>
}
