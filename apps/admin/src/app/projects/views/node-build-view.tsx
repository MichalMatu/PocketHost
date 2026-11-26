import { Button } from "@/components/ui/button"
import { reviewDependencies, installDependencies, reviewBuild, executeBuild, checkBuildSyntax } from "../actions/node-build-actions"
import type { SelectedNodeController } from "../state/use-node-project-controller"

export function NodeBuildView({ controller, standalone = false }: { controller: SelectedNodeController; standalone?: boolean }) {
  const { busy, ownerAuthorized, editorDirty, selected, action, dependencyApproved, setDependencyApproved, dependencyInstallEnabled, dependencyReview, buildApproved, setBuildApproved, buildEnabled, buildReview, plan, buildCheck } = controller
  return <>
    <details data-testid="node-advanced-setup" className="rounded-lg border p-3" open={standalone || undefined}>
      <summary className="cursor-pointer text-sm font-medium">Dependencies & build
        <span className="ml-2 text-xs font-normal text-muted-foreground">Advanced · separate approval</span>
      </summary>
      <div className="mt-3 flex flex-wrap gap-2">
      <Button variant="outline" disabled={busy || !ownerAuthorized || editorDirty || !selected.candidateRelease}
        onClick={() => action(async () => {
          await reviewDependencies(controller)
        })}>Review dependency setup</Button>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" aria-label="Approve Node dependency install"
          checked={dependencyApproved} onChange={event => setDependencyApproved(event.target.checked)}
          disabled={busy || !dependencyInstallEnabled || dependencyReview?.status !== "review-required"} />
        I authorize one isolated npm ci for this PocketHost release (network downloads permitted).
      </label>
      <Button variant="outline" disabled={busy || !ownerAuthorized || editorDirty || !dependencyApproved ||
        !dependencyInstallEnabled || !selected.candidateRelease ||
        dependencyReview?.release !== selected.candidateRelease ||
        dependencyReview.status !== "review-required" || !dependencyReview.installRequired ||
        dependencyReview.blockers.length > 0}
        onClick={() => action(async () => {
          await installDependencies(controller)
        })}>Install approved dependencies</Button>
      <Button variant="outline" disabled={busy || !ownerAuthorized || editorDirty || !selected.candidateRelease}
        onClick={() => action(async () => {
          await reviewBuild(controller)
        })}>Review Node build</Button>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" aria-label="Approve Node build execution"
          checked={buildApproved} onChange={value => setBuildApproved(value.target.checked)}
          disabled={busy || !buildEnabled || buildReview?.status !== "ready-to-build"} />
        I explicitly approve running the displayed build script from this trusted project.
        It runs as the Termux user; the private folder is not an OS sandbox.
      </label>
      <Button variant="outline" disabled={busy || !ownerAuthorized || editorDirty || !buildApproved ||
        !buildEnabled || !selected.candidateRelease ||
        buildReview?.release !== selected.candidateRelease ||
        buildReview.status !== "ready-to-build" ||
        !buildReview.dependenciesPrepared || !buildReview.buildRequired ||
        buildReview.blockers.length > 0}
        onClick={() => action(async () => {
          await executeBuild(controller)
        })}>Execute approved Node build</Button>
      <Button disabled={busy || !ownerAuthorized || editorDirty || !plan?.allowed || !selected.candidateRelease}
        variant="outline" onClick={() => action(async () => {
          await checkBuildSyntax(controller)
        })}>Check Node build syntax</Button>
      </div>
    </details>
    {buildCheck && <p className="text-muted-foreground text-xs" role="status">
      Candidate syntax: {buildCheck.status} · No project code executed.
    </p>}
  </>
}
