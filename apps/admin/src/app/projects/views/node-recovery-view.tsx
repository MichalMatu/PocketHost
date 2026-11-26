import { Button } from "@/components/ui/button"
import { api, type RollbackPreflight } from "../node-project-client"
import type { SelectedNodeController } from "../state/use-node-project-controller"

export function NodeRecoveryView({ controller, standalone = false }: { controller: SelectedNodeController; standalone?: boolean }) {
  const { busy, ownerAuthorized, runtime, action, setRollbackPreflight, getJson, selected, setMessage, approved, executionEnabled, rollbackPreflight, runRuntimeAction } = controller
  return <>
                  <details data-testid="node-recovery" className="rounded-lg border p-3" open={standalone || undefined}>
                    <summary className="cursor-pointer text-sm font-medium">Maintenance & rollback
                    </summary>
                    <div className="mt-3 flex flex-wrap gap-2">
                    <Button variant="outline" disabled={busy || !ownerAuthorized || !runtime?.previousGoodRelease}
                      onClick={() => action(async () => {
                        setRollbackPreflight(null)
                        const target = runtime?.previousGoodRelease
                        if (!target) throw new Error("No previous Node release to review")
                        const data = await getJson(api + "/" + selected.id + "/rollback-preview")
                        const reviewed = data.rollbackPreview as Partial<RollbackPreflight> | undefined
                        if (!reviewed ||
                            reviewed.release !== target ||
                            typeof reviewed.allowed !== "boolean" ||
                            ![
                              "previous-release-verified", "release-already-active",
                              "owned-process-identity-unknown",
                              "rollback-dependencies-or-build-unverified",
                              "rollback-toolchain-blocked", "rollback-source-syntax-invalid",
                              "rollback-release-not-verifiable",
                            ].includes(reviewed.reason ?? "") ||
                            reviewed.allowed !== (reviewed.reason === "previous-release-verified"))
                          throw new Error("Invalid Node rollback review")
                        setRollbackPreflight(reviewed as RollbackPreflight)
                        setMessage(reviewed.allowed
                          ? "Previous Node release verified for explicit rollback."
                          : "Rollback target is not safely recoverable.")
                      })}>Review rollback target</Button>
                    <Button variant="outline" disabled={busy || !ownerAuthorized || !approved || !executionEnabled ||
                      !runtime?.previousGoodRelease || runtime.state === "unknown" ||
                      (rollbackPreflight !== null &&
                        (!rollbackPreflight.allowed ||
                          rollbackPreflight.release !== runtime.previousGoodRelease))}
                      onClick={() => action(async () => {
                        await runRuntimeAction(selected.id, "rollback", { approved: true },
                          "Previous verified Node release restored by host.")
                      })}>Rollback active release</Button>
                    </div>
                  </details>
    {rollbackPreflight && <p className="text-muted-foreground text-xs"
                    aria-label="Node rollback preflight">
                    Rollback to {rollbackPreflight.release ?? "none"}:
                    {rollbackPreflight.allowed ? " verified" : " blocked"} · {rollbackPreflight.reason}.
                  </p>}
  </>
}
