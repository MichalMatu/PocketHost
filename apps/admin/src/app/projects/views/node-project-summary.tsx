import { CardDescription } from "@/components/ui/card"
import { shortRelease } from "../node-project-display"
import type { SelectedNodeController } from "../state/use-node-project-controller"

export function NodeProjectSummary({ controller }: { controller: SelectedNodeController }) {
  const { selected, runtime, health } = controller
  return <>
    <div><h1 className="text-xl font-semibold">{selected.name}</h1>
      <CardDescription aria-label="Node runtime summary">
        {runtime?.state ?? "unverified"} · Live: <span title={runtime?.activeRelease ?? undefined}>{shortRelease(runtime?.activeRelease)}</span> ·
        Prepared: <span title={selected.candidateRelease ?? undefined}>{shortRelease(selected.candidateRelease)}</span> ·
        HTTP readiness: {!health ? "not checked" : health.ready === null ? "not probed" : health.ready ? "ready" : "not ready"}
      </CardDescription></div>
  </>
}
