import { Button } from "@/components/ui/button"
import { RefreshCw } from "lucide-react"
import type { NodeProjectController } from "../state/use-node-project-controller"

export function NodeRefresh({ controller, projectId }: { controller: NodeProjectController; projectId?: string }) {
  const { busy, action, refresh, createPhase, setCreatePhase, setMessage, loadReleases, loadRuntime } = controller
  return <>
    <Button variant="outline" disabled={busy} onClick={() => action(async () => {
      const catalog = await refresh()
      if (projectId && catalog.some(project => project.id === projectId))
        await Promise.all([loadReleases(projectId), loadRuntime(projectId)])
      if (createPhase === "unknown") {
        setCreatePhase("idle")
        setMessage("Catalog refreshed. Check existing projects before creating another.")
      }
    })}><RefreshCw aria-hidden="true" />Refresh</Button>
  </>
}
