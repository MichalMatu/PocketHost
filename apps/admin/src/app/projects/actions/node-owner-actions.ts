import { api, requestJson } from "../node-project-client"
import type { NodeProjectController } from "../state/use-node-project-controller"

export async function unlockNodeOwner(controller: NodeProjectController) {
  const { tokenRef, setOwnerConfigured, setOwnerAuthorized, setMessage } = controller
  const attemptedToken = tokenRef.current
  const response = await requestJson(api + "/owner-session", undefined, undefined, attemptedToken)
  if (tokenRef.current !== attemptedToken)
    throw new Error("Owner token changed while verifying. Unlock again.")
  if (typeof response.configured !== "boolean" || typeof response.authorized !== "boolean" ||
      (response.mode !== undefined && response.mode !== "protected"))
    throw new Error("Invalid owner session response")
  setOwnerConfigured(response.configured)
  setOwnerAuthorized(response.authorized)
  if (!response.authorized)
    throw new Error(response.configured ? "Invalid Node owner token." : "Node owner token is not configured on the host.")
  setMessage("Owner authenticated for Node management.")
}
