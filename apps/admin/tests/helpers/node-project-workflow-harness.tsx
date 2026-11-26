import { useNodeProjectController } from "@/app/projects/state/use-node-project-controller"
import { NodeLifecycleActions } from "@/app/projects/node-lifecycle-actions"
import { NodeRuntimeHistory } from "@/app/projects/node-runtime-history"
import { NodeAccessView } from "@/app/projects/views/node-access-view"
import { NodeFeedback } from "@/app/projects/views/node-feedback"
import { NodeCatalogView } from "@/app/projects/views/node-catalog-view"
import { NodeCreateView } from "@/app/projects/views/node-create-view"
import { NodeBackupsView } from "@/app/projects/views/node-backups-view"
import { NodeDataView } from "@/app/projects/views/node-data-view"
import { NodeRefresh } from "@/app/projects/views/node-refresh"
import { NodeProjectSummary } from "@/app/projects/views/node-project-summary"
import { NodeRemoveView } from "@/app/projects/views/node-remove-view"
import { NodeRuntimeView } from "@/app/projects/views/node-runtime-view"
import { NodeBuildView } from "@/app/projects/views/node-build-view"
import { NodeRecoveryView } from "@/app/projects/views/node-recovery-view"
import { NodeSourceView } from "@/app/projects/views/node-source-view"
import { NodeReleasesView } from "@/app/projects/views/node-releases-view"

/** Shared workflow regression fixture; production navigation is tested independently. */
export default function NodeProjectWorkflowHarness() {
  const c = useNodeProjectController()
  const current = c.selected && c.catalogState === "ready" ? { ...c, selected: c.selected } : null
  return <main>
    <div className="space-y-4 px-4 pb-8 lg:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Node.js applications</h1>
        <NodeRefresh controller={c} />
      </div>
      <NodeCatalogView controller={c} />
      <NodeAccessView controller={c} />
      <NodeFeedback controller={c} />
      {current && <section className="space-y-4 rounded-lg border p-4">
        <NodeProjectSummary controller={current} />
        <NodeLifecycleActions runtime={c.runtime} approved={c.approved} onApprove={c.setApproved}
          disabled={c.busy || !c.ownerAuthorized || !c.executionEnabled}
          onAction={(op, message) => c.action(() => c.runRuntimeAction(current.selected.id, op, { approved: true }, message))} />
        <NodeRemoveView controller={current} />
        <nav aria-label="Node project sections" className="flex flex-wrap gap-2 text-sm">
          <a href="#node-runtime">Runtime</a><a href="#node-source">Source</a><a href="#node-candidates">Releases</a>
        </nav>
        <section id="node-runtime" className="space-y-3">
          <NodeRuntimeView controller={current} />
          <NodeBuildView controller={current} />
          <NodeRecoveryView controller={current} />
          <NodeRuntimeHistory history={c.runtime?.history ?? []} />
        </section>
        <NodeSourceView controller={current} />
        <NodeReleasesView controller={current} />
      </section>}
      <NodeCreateView controller={c} />
      <NodeDataView controller={c} />
      <NodeBackupsView controller={c} />
    </div>
  </main>
}
