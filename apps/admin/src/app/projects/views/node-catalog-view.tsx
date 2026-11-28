import { NodeProjectPicker } from "../node-project-picker"
import type { NodeProjectController } from "../state/use-node-project-controller"

export function NodeCatalogView({ controller, onSelect, embedded }: { controller: NodeProjectController; onSelect?: (id: string) => void; embedded?: boolean }) {
  const { catalogState, projects, selectedId, busy, selected } = controller
  return <>
    {catalogState === "ready" &&
      <NodeProjectPicker projects={projects} selectedId={selectedId} busy={busy} embedded={embedded}
        onSelect={project => onSelect ? onSelect(project.id) : controller.selectProject(project)} />}
    {!selected && catalogState === "ready" && projects.length > 0 && !onSelect &&
      <p role="status" className="text-sm text-muted-foreground">
        Select a project above to inspect its runtime, source files and releases.
      </p>}
  </>
}
