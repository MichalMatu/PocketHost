import { matchPath, useLocation, useNavigate, useSearchParams } from "react-router-dom"
import { ArrowLeft, Plus, Archive, Wrench } from "lucide-react"
import { BaseLayout } from "@/components/layouts/base-layout"
import { StandardPageLayout, pageActionClass } from "@/components/layouts/standard-page-layout"
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useNodeProjectController } from "./state/use-node-project-controller"
import { NodeAccessView } from "./views/node-access-view"
import { NodeFeedback } from "./views/node-feedback"
import { NodeCatalogView } from "./views/node-catalog-view"
import { NodeCreateView } from "./views/node-create-view"
import { NodeBackupsView } from "./views/node-backups-view"
import { NodeHostDiagnosticsView } from "./views/node-host-diagnostics-view"
import { NodeRefresh, refreshNodeWorkspace } from "./views/node-refresh"
import { NodeWorkspace, nodeWorkspaceTab } from "./views/node-workspace"

export default function ProjectsPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const adding = matchPath("/projects/new", location.pathname) !== null
  const backups = matchPath("/projects/backups", location.pathname) !== null
  const diagnostics = matchPath("/projects/diagnostics", location.pathname) !== null
  const requested = adding || backups || diagnostics ? null :
    matchPath("/projects/:id", location.pathname)?.params.id ?? params.get("project")
  const c = useNodeProjectController(requested)
  const selected = c.selected?.id === requested ? c.selected : undefined
  const detail = requested !== null
  const go = (url: string) => { void navigate(url) }
  const title = adding ? "Add Node.js application" : backups ? "Node backups" : diagnostics ? "Node diagnostics" : "Node.js applications"
  if (adding || (!backups && !diagnostics && !detail)) return (
    <StandardPageLayout title={title} onRefresh={() => refreshNodeWorkspace(c)} refreshDisabled={c.busy}>
      <NodeAccessView controller={c} showTrusted={false} />
      {adding ? <NodeCreateView controller={c} standalone onCreated={id => go("/projects/" + id)}
        onBack={() => go("/projects")} feedback={<NodeFeedback controller={c} showDiagnostics={false} />} />
        : <Card role="region" aria-labelledby="node-catalog-heading">
          <CardHeader>
            <CardTitle><h2 id="node-catalog-heading">Node.js applications</h2></CardTitle>
            <CardAction>
              <Button className={pageActionClass} disabled={c.busy} onClick={() => go("/projects/new")}>
                <Plus aria-hidden="true" data-icon="inline-start" />Add application
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent className="space-y-4">
            <NodeFeedback controller={c} showDiagnostics={false} />
            <NodeCatalogView controller={c} embedded onSelect={id => go("/projects/" + id)} />
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" className={pageActionClass} disabled={c.busy} onClick={() => go("/projects/diagnostics")}><Wrench aria-hidden="true" />Diagnostics</Button>
              <Button variant="outline" className={pageActionClass} disabled={c.busy} onClick={() => go("/projects/backups")}><Archive aria-hidden="true" />Backups</Button>
            </div>
          </CardContent>
        </Card>}
    </StandardPageLayout>
  )
  return <BaseLayout>
    <div className="space-y-4 px-4 pb-8 lg:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="ghost" disabled={c.busy} onClick={() => go("/projects")}>
            <ArrowLeft aria-hidden="true" />Applications
          </Button>
          {!detail && <h1 className="text-xl font-semibold">{title}</h1>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <NodeRefresh controller={c} projectId={selected?.id} />
        </div>
      </div>
      <NodeAccessView controller={c} showTrusted={false} />
      <NodeFeedback controller={c} showDiagnostics={diagnostics} />
      {backups ? <NodeBackupsView controller={c} standalone />
        : diagnostics ? <NodeHostDiagnosticsView controller={c} />
        : detail ? c.catalogState === "ready" && selected
          ? <NodeWorkspace key={selected.id} controller={{ ...c, selected }} tab={nodeWorkspaceTab(params.get("tab"))}
              onTab={tab => setParams(current => { const next = new URLSearchParams(current); next.set("tab", tab); return next }, { replace: true })}
              onRemoved={() => go("/projects")} />
          : c.catalogState === "ready" && !c.projects.some(project => project.id === requested)
            ? <p role="alert">Application not found.</p>
            : c.catalogState === "loading" || c.catalogState === "ready" ? <p role="status">Loading application…</p> : null
        : null}
    </div>
  </BaseLayout>
}
