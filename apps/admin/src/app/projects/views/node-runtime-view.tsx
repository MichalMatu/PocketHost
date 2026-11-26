import { Button } from "@/components/ui/button"
import { parseNodeHealth } from "../node-project-client"
import { NodeRuntimeDetails } from "../node-runtime-details"
import { NodeProjectLogFeedback } from "../node-project-log-feedback"
import { TrafficPanel } from "@/components/traffic-panel"
import type { SelectedNodeController } from "../state/use-node-project-controller"

export function NodeRuntimeView({ controller, standalone = false }: { controller: SelectedNodeController; standalone?: boolean }) {
  const { ownerAuthorized, runtime, plan, buildReview, dependencyReview, selected, busy, action, loadRuntime, setMessage, canPublish, runRuntimeAction, setHealth, readScoped, invalidateRead, beginInspection, resetLogs, setApproved, setPreview, loadLogs, executionEnabled, preview, logLines, logsLoading, logsError, logsChecked } = controller
  return <>
    {!ownerAuthorized && <p role="status" className="text-xs text-muted-foreground">
      Read-only · <a href="#node-owner-access" className="underline underline-offset-4">Unlock owner access</a>
    </p>}
    {!standalone && <NodeRuntimeDetails runtime={runtime} plan={plan}
      buildReview={buildReview} dependencyReview={dependencyReview} />}
    {!standalone && <TrafficPanel key={selected.id} projectId={selected.id} kind="node" />}
    {plan && (plan.missingTools.length > 0 || plan.conflicts.length > 0 ||
        (plan.dependencyIssues?.length ?? 0) > 0) &&
      <p role="alert" className="text-sm text-destructive">{[
        ...plan.missingTools, ...plan.conflicts, ...(plan.dependencyIssues ?? []),
      ].join(", ")}</p>}
    <div className="flex flex-wrap gap-2">
      <Button disabled={busy} variant="outline" onClick={() => action(async () => {
        await loadRuntime(selected.id); setMessage("Runtime status and plan refreshed.")
      })}>Review plan</Button>
      {(!standalone || selected.candidateRelease !== runtime?.activeRelease) && <Button disabled={!canPublish} variant={canPublish ? "default" : "outline"}
        className={!canPublish ? "cursor-not-allowed opacity-35" : undefined}
        title={!canPublish ? "Unlock owner access, review the plan, approve execution and select an eligible staged release." : "Publish the reviewed release"}
        onClick={() => action(async () => {
          await runRuntimeAction(selected.id, "deploy",
            { approved: true, release: selected.candidateRelease },
            "Owned Node release started and readiness verified by host.")
        })}>{runtime?.activeRelease ? "Publish update" : "Deploy selected release"}</Button>}
      {!standalone && <Button variant="outline" disabled={busy} onClick={() => action(async () => {
        // A failed or pending GET must not keep the previous probe marked ready.
        setHealth(null)
        const response = await readScoped(selected.id, "health")
        if (!response) return
        const observed = parseNodeHealth(response.health)
        // A host may have switched releases or stopped since the last
        // runtime read. Any changed state or release invalidates the
        // old plan, even when readiness was not probed.
        const runtimeChanged = runtime !== null && (
          observed.release !== runtime.activeRelease ||
          observed.state !== runtime.state
        )
        if (runtimeChanged ||
            (observed.ready === true && runtime?.state !== "running")) {
          invalidateRead()
          beginInspection()
          resetLogs()
          setApproved(false)
          setPreview(null)
          throw new Error("Node runtime changed since review. Inspect runtime again before acting.")
        }
        setHealth(observed)
        setMessage("Current Node readiness checked against verified local ownership.")
      })}>Check live readiness</Button>
      <Button variant="outline" disabled={busy || !ownerAuthorized ||
        runtime?.state !== "running" || !runtime?.activeRelease}
        onClick={() => action(async () => {
          // Do not retain a previous page body while a new inspection is pending or fails.
          setPreview(null)
          const expectedRelease = runtime?.activeRelease
          if (!expectedRelease) throw new Error("Review current Node runtime before preview.")
          const response = await readScoped(selected.id, "preview")
          if (!response) return
          const value = response.preview as Record<string, unknown> | undefined
          if (!value || typeof value.release !== "string" ||
            !/^r-[a-f0-9]{32}$/.test(value.release) ||
            value.release !== expectedRelease ||
            typeof value.body !== "string" || value.body.length > 8192)
            throw new Error("Invalid private Node preview response")
          setPreview({ release: value.release, body: value.body })
          setMessage("Private loopback response inspected as plain text, not published.")
        })}>Preview local response</Button>
      <Button variant="outline" disabled={busy} onClick={() => action(async () => {
        const current = await loadLogs(selected.id)
        if (current) setMessage("Bounded runit logs loaded.")
      })}>View logs</Button>}
    </div>
    {!executionEnabled && ownerAuthorized && <p className="text-xs text-muted-foreground">
      Execution unavailable; review runtime permissions.
    </p>}
    {preview && <pre aria-label="Local Node response" className="max-h-48 overflow-auto whitespace-pre-wrap rounded-md border p-3 text-xs">
      {preview.body}
    </pre>}
    {!standalone && <NodeProjectLogFeedback lines={logLines} loading={logsLoading} error={logsError} checked={logsChecked} />}
  </>
}
