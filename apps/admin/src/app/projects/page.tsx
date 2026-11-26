import { BaseLayout } from "@/components/layouts/base-layout"
import { useNodeProjectController } from "./state/use-node-project-controller"
import { NodeLifecycleActions } from "./node-lifecycle-actions"
import { NodeRuntimeHistory } from "./node-runtime-history"
import { NodeAccessView } from "./views/node-access-view"
import { NodeFeedback } from "./views/node-feedback"
import { NodeCatalogView } from "./views/node-catalog-view"
import { NodeCreateView } from "./views/node-create-view"
import { NodeBackupsView } from "./views/node-backups-view"
import { NodeDataView } from "./views/node-data-view"
import { NodeRefresh } from "./views/node-refresh"
import { NodeProjectSummary } from "./views/node-project-summary"
import { NodeRemoveView } from "./views/node-remove-view"
import { NodeRuntimeView } from "./views/node-runtime-view"
import { NodeBuildView } from "./views/node-build-view"
import { NodeRecoveryView } from "./views/node-recovery-view"
import { NodeSourceView } from "./views/node-source-view"
import { NodeReleasesView } from "./views/node-releases-view"

export default function ProjectsPage() {
  const c = useNodeProjectController()
  const current = c.selected && c.catalogState === "ready" ? { ...c, selected: c.selected } : null
  return <BaseLayout>
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
  </BaseLayout>
}
