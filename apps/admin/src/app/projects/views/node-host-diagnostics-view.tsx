import { Button } from "@/components/ui/button"
import type { NodeProjectController } from "../state/use-node-project-controller"

export function NodeHostDiagnosticsView({ controller }: { controller: NodeProjectController }) {
  const { busy, catalogState, action, checkTools, inspectRegistries, setMessage } = controller
  return <div className="flex flex-wrap gap-2">
        <Button variant="outline" disabled={busy || catalogState !== "ready"}
          onClick={() => action(async () => {
            if (await checkTools()) setMessage("Node toolchain version read confirmed.")
          })}>Check Node tools</Button>
        <Button variant="outline" disabled={busy || catalogState !== "ready"} onClick={() => action(async () => {
          if (await inspectRegistries())
            setMessage("Read-only module, service and project declarations verified.")
        })}>Inspect hosting registries</Button>
  </div>
}
