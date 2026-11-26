import { Button } from "@/components/ui/button"
import { RefreshCw } from "lucide-react"
import type { NodeProjectController } from "../state/use-node-project-controller"

export function NodeRefresh({ controller }: { controller: NodeProjectController }) {
  const { busy, action, refresh, createPhase, setCreatePhase, setMessage } = controller
  return <>
    <Button variant="outline" disabled={busy} onClick={() => action(async () => {
      await refresh()
      if (createPhase === "unknown") {
        setCreatePhase("idle")
        setMessage("Catalog refreshed. Check existing projects before creating another.")
      }
    })}><RefreshCw aria-hidden="true" />Refresh</Button>
  </>
}
