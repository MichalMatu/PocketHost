import { disabledMessage } from "../node-project-client"
import { NodeOwnerPanel } from "../node-owner-panel"
import { unlockNodeOwner } from "../actions/node-owner-actions"
import type { NodeProjectController } from "../state/use-node-project-controller"

export function NodeAccessView({ controller, showTrusted = true }: { controller: NodeProjectController; showTrusted?: boolean }) {
  const { accessMode, ownerAuthorized, ownerConfigured, token, busy, lanView, tokenRef, setToken, revokeOwnerAccess, action, setMessage, catalogState } = controller
  if (accessMode === "trusted-lan" && !showTrusted) return null
  return <>
    <NodeOwnerPanel trusted={accessMode === "trusted-lan"} authorized={ownerAuthorized}
      configured={ownerConfigured} token={token} busy={busy} lanView={lanView}
      onToken={value => { tokenRef.current = value; setToken(value); revokeOwnerAccess() }}
      onUnlock={() => action(async () => {
        await unlockNodeOwner(controller)
      })}
      onLock={() => {
        tokenRef.current = ""; setToken(""); revokeOwnerAccess(); setMessage("Owner access locked.")
      }} />
    {catalogState === "disabled" && <p role="status" className="text-muted-foreground text-sm">{disabledMessage}</p>}
  </>
}
