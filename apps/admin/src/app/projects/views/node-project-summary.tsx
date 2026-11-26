import { Badge } from "@/components/ui/badge"
import { CardDescription } from "@/components/ui/card"
import { shortRelease } from "../node-project-display"
import type { SelectedNodeController } from "../state/use-node-project-controller"

export function NodeProjectSummary({ controller, compact = false }: { controller: SelectedNodeController; compact?: boolean }) {
  const { selected, runtime, health } = controller
  if (compact) return <div className="space-y-2">
    <div className="flex flex-wrap items-center gap-3"><h1 className="text-xl font-semibold">{selected.name}</h1>
      <Badge variant={runtime?.state === "running" ? "default" : "secondary"}>{runtime?.state ?? "unverified"}</Badge>
    </div>
    <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground" aria-label="Node runtime summary">
      <span>Port: {runtime?.port ?? "Not assigned"}</span>
      {runtime?.activeRelease && <span title={runtime.activeRelease}>Release: {shortRelease(runtime.activeRelease)}</span>}
      {selected.candidateRelease && selected.candidateRelease !== runtime?.activeRelease && <span>Update ready</span>}
      {health && <span>HTTP: {health.ready === true ? "Ready" : health.ready === false ? "Not ready" : "Not probed"}</span>}
    </div>
  </div>
  return <>
    <div><h1 className="text-xl font-semibold">{selected.name}</h1>
      <CardDescription aria-label="Node runtime summary">
        {runtime?.state ?? "unverified"} · Live: <span title={runtime?.activeRelease ?? undefined}>{shortRelease(runtime?.activeRelease)}</span> ·
        Prepared: <span title={selected.candidateRelease ?? undefined}>{shortRelease(selected.candidateRelease)}</span> ·
        HTTP readiness: {!health ? "not checked" : health.ready === null ? "not probed" : health.ready ? "ready" : "not ready"}
      </CardDescription></div>
  </>
}
