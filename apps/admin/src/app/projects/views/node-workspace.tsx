import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { RefreshCw } from "lucide-react"
import { TrafficPanel } from "@/components/traffic-panel"
import { NodeLifecycleActions } from "../node-lifecycle-actions"
import { NodeRuntimeDetails } from "../node-runtime-details"
import { NodeRuntimeHistory } from "../node-runtime-history"
import { NodeProjectLogFeedback } from "../node-project-log-feedback"
import { NodeAccessView } from "./node-access-view"
import { NodeBuildView } from "./node-build-view"
import { NodeDataView } from "./node-data-view"
import { NodeRecoveryView } from "./node-recovery-view"
import { NodeReleasesView } from "./node-releases-view"
import { NodeRemoveView } from "./node-remove-view"
import { NodeRuntimeView } from "./node-runtime-view"
import { NodeSourceView } from "./node-source-view"
import { NodeProjectSummary } from "./node-project-summary"
import type { SelectedNodeController } from "../state/use-node-project-controller"

const tabs = [
  ["overview", "Overview"], ["source", "Source"], ["build", "Dependencies & build"],
  ["deployments", "Deployments"], ["logs", "Logs"], ["traffic", "Traffic"],
  ["data", "Data"], ["settings", "Settings"],
] as const
export function nodeWorkspaceTab(value: string | null) {
  return value !== null && tabs.some(([key]) => key === value) ? value : "overview"
}

export function NodeWorkspace({ controller: c, tab, onTab, onRemoved }: {
  controller: SelectedNodeController; tab: string; onTab: (tab: string) => void; onRemoved: () => void
}) {
  const { selected, runtime, approved, setApproved, busy, ownerAuthorized, executionEnabled,
    action, runRuntimeAction, plan, buildReview, dependencyReview, loadLogs, logLines, logsLoading, logsError, logsChecked } = c
  const approval = <label className="inline-flex min-h-11 max-w-full cursor-pointer items-center gap-2 text-sm">
    <input type="checkbox" className="size-4 shrink-0" aria-label="Approve local Node execution" checked={approved}
      onChange={event => setApproved(event.target.checked)} />
    Approve running this trusted application.
  </label>
  return <section className="space-y-4">
    <NodeProjectSummary controller={c} compact />
    <NodeLifecycleActions compact runtime={runtime} approved={approved} onApprove={setApproved}
      disabled={busy || !ownerAuthorized || !executionEnabled}
      onAction={(op, message) => action(() => runRuntimeAction(selected.id, op, { approved: true }, message))} />
    <Tabs value={tab} onValueChange={value => { if (!busy) onTab(String(value)) }}>
      <TabsList aria-label="Application sections" className="w-full flex-wrap justify-start gap-1 group-data-horizontal/tabs:h-auto">
        {tabs.map(([key, title]) => <TabsTrigger key={key} value={key} disabled={busy} className="h-10 flex-none px-3">{title}</TabsTrigger>)}
      </TabsList>
      <TabsContent value="overview" className="space-y-3 pt-3">
        {tab === "overview" && <>
          {selected.candidateRelease && selected.candidateRelease !== runtime?.activeRelease && approval}
          <NodeRuntimeView controller={c} standalone />
        </>}
      </TabsContent>
      <TabsContent value="source" className="space-y-3 pt-3">{tab === "source" && <NodeSourceView controller={c} standalone />}</TabsContent>
      <TabsContent value="build" className="space-y-3 pt-3">{tab === "build" && <>
        <NodeBuildView controller={c} standalone />
        <NodeRuntimeDetails runtime={runtime} plan={plan} buildReview={buildReview} dependencyReview={dependencyReview} />
      </>}</TabsContent>
      <TabsContent value="deployments" className="space-y-3 pt-3">{tab === "deployments" && <>
        {runtime?.previousGoodRelease && approval}
        <NodeRecoveryView controller={c} standalone />
        <NodeReleasesView controller={c} />
        <NodeRuntimeHistory history={runtime?.history ?? []} />
      </>}</TabsContent>
      <TabsContent value="logs" className="space-y-3 pt-3">{tab === "logs" && <>
        <Button variant="outline" disabled={busy || logsLoading} onClick={() => action(async () => {
          await loadLogs(selected.id)
        })}><RefreshCw aria-hidden="true" />Refresh logs</Button>
        <NodeProjectLogFeedback lines={logLines} loading={logsLoading} error={logsError} checked={logsChecked} />
      </>}</TabsContent>
      <TabsContent value="traffic" className="pt-3">{tab === "traffic" && <TrafficPanel key={selected.id} projectId={selected.id} kind="node" />}</TabsContent>
      <TabsContent value="data" className="pt-3">{tab === "data" && <NodeDataView controller={c} standalone />}</TabsContent>
      <TabsContent value="settings" className="space-y-3 pt-3">{tab === "settings" && <>
        {c.accessMode === "trusted-lan" && <NodeAccessView controller={c} />}
        <NodeRuntimeDetails runtime={runtime} plan={plan} buildReview={null} dependencyReview={null} />
        <NodeRemoveView controller={c} onRemoved={onRemoved} />
      </>}</TabsContent>
    </Tabs>
  </section>
}
