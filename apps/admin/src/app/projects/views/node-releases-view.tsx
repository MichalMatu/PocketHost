import { NodeReleaseInventory } from "../node-release-inventory"
import type { SelectedNodeController } from "../state/use-node-project-controller"

export function NodeReleasesView({ controller }: { controller: SelectedNodeController }) {
  const { releases, releasesLoading, releasesError, releasesChecked, busy, runtime, action, loadReleases, selected } = controller
  return <>
    <NodeReleaseInventory releases={releases} loading={releasesLoading}
      error={releasesError} checked={releasesChecked} busy={busy}
      activeRelease={runtime?.activeRelease} running={runtime?.state === "running"}
      onRefresh={() => action(() => loadReleases(selected.id))} />
  </>
}
