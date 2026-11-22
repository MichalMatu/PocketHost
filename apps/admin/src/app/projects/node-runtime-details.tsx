import type { RuntimeState, RuntimePlan, BuildReview, DependencyReview } from "./node-project-client"
import { shortRelease } from "./node-project-display"

type Props = {
  runtime: RuntimeState | null
  plan: RuntimePlan | null
  buildReview: BuildReview | null
  dependencyReview: DependencyReview | null
}

/** Presentation only: technical readback and review details remain collapsed by default. */
export function NodeRuntimeDetails({ runtime, plan, buildReview, dependencyReview }: Props) {
  return (
    <details data-testid="node-runtime-details" className="rounded-lg border px-3 py-2 text-xs">
      <summary className="cursor-pointer font-medium">Technical details</summary>
      <div className="mt-2 space-y-2 text-muted-foreground">
    <p aria-label="Node local address" className="text-sm">
      Device loopback: {runtime?.port ? `http://127.0.0.1:${runtime.port}/` : "not assigned"}.
      Not a public or directly reachable LAN URL.
    </p>
    <p className="text-sm">Staged candidate plan: {plan?.reason ?? "not checked"} · Dependencies: {plan?.dependencyCount ?? "unknown"} · Port: {runtime?.port ?? "not allocated"} · Node: {plan?.nodeVersion ?? "unknown"} · npm: {plan?.npmVersion ?? "unknown"}</p>
    {buildReview && <p className="text-muted-foreground text-xs"
      aria-label="Node build setup">
      Build: {buildReview.status} · Script: {buildReview.script ?? "not required"} ·
      Dependencies prepared: {String(buildReview.dependenciesPrepared)} ·
      Artifact verified: {String(buildReview.artifactVerified)} ·
      {buildReview.artifact && <>
        Files: {buildReview.artifact.files.join(", ") || "none"}
        {buildReview.artifact.truncated ? " (more files)" : ""} ·
        Size: {buildReview.artifact.bytes} bytes ·
      </>}
      Blockers: {buildReview.blockers.length ? buildReview.blockers.join(", ") : "none"}
    </p>}
    {dependencyReview && <p className="text-muted-foreground text-xs"
      aria-label="Node dependency setup">
      Setup: {dependencyReview.status} · Dependencies: {dependencyReview.dependencyCount} ·
      Install: {dependencyReview.installRequired ? dependencyReview.installCommand?.join(" ") : "not required"} ·
      Build: {dependencyReview.buildRequired ? dependencyReview.buildCommand?.join(" ") : "not required"} ·
      Blockers: {dependencyReview.blockers.length ? dependencyReview.blockers.join(", ") : "none"} ·
      {dependencyReview.status === "prepared"
        ? " Installed package bytes verified; no npm command executed during this review."
        : " Not executed; installation/build requires separate approval."}
    </p>}
    <p className="text-sm">Last: <span title={runtime?.lastGoodRelease ?? undefined}>{shortRelease(runtime?.lastGoodRelease)}</span> · Previous: <span title={runtime?.previousGoodRelease ?? undefined}>{shortRelease(runtime?.previousGoodRelease)}</span> · Desired: {runtime?.desired ?? "unknown"}</p>
    <p className="text-muted-foreground text-xs">Health policy (read-only): {runtime?.healthDecision?.reason ?? "not checked"}.
      No automatic restart is authorized.
    </p>
      </div>
    </details>
  )
}
