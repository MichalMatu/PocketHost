import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { jsonApiStarter } from "../node-starters"
import { readLocalNodeFiles, readLocalNodeFolder } from "@/lib/node-source-import"
import { reviewGithubSource, loadCandidateSource, stageCandidateSource, restoreCandidateSource } from "../actions/node-source-actions"
import type { SelectedNodeController } from "../state/use-node-project-controller"

export function NodeSourceView({ controller, standalone = false }: { controller: SelectedNodeController; standalone?: boolean }) {
  const { sourceOrigin, busy, ownerAuthorized, setManifest, setLockfile, setSource, setSourceOrigin, setExtraFiles, setAssetFiles, setEditorDirty, resetRuntimeReviews, setApproved, setBuildCheck, setPlan, setPreview, setExecutionEnabled, setGithubReview, setError, setMessage, githubRepository, setGithubRepository, action, selected, githubReview, setDependencyReview, setBuildApproved, setBuildReview, manifest, lockfile, source, extraFiles, assetFiles, editorDirty } = controller
  return <>
    <details id="node-source" data-testid="node-source-panel" aria-label="Node source editor"
      className="rounded-lg border" open={standalone || undefined}>
      <summary className="cursor-pointer px-4 py-3 font-semibold">
        Source files <span className="ml-2 text-xs font-normal text-muted-foreground">
          {sourceOrigin === "example" ? "Example — not deployed" :
            sourceOrigin === "staged" ? "Staged candidate — not necessarily live" :
            sourceOrigin === "github" ? "GitHub — not staged" :
            sourceOrigin === "local" ? "Local — not staged" : "Draft — not staged"}
        </span>
      </summary>
      <div className="space-y-3 border-t p-4">
    <details data-testid="node-source-safety" className="rounded-md border px-3 py-2 text-xs">
      <summary className="cursor-pointer font-medium">Deployment requirements</summary>
      <p className="mt-2 text-muted-foreground">
        The reviewed server.mjs runs as the Termux user on loopback only after explicit approval.
        Dependency installation and builds require separate review and SHA-256 verification.
        Generated dist files are not served unless server.mjs serves them.
        /__pockethost/ready must return the private X-PocketHost-Ready nonce.
        No public routes or automatic startup.
      </p>
    </details>
    <Button variant="outline" disabled={busy || !ownerAuthorized}
      onClick={() => {
        if (!window.confirm("Replace the editor draft with the JSON API starter? Nothing is staged or started.")) return
        setManifest(jsonApiStarter.manifest); setLockfile(jsonApiStarter.lockfile)
        setSource(jsonApiStarter.source); setSourceOrigin("example")
        setExtraFiles({}); setAssetFiles({}); setEditorDirty(true)
        resetRuntimeReviews(); setApproved(false); setBuildCheck(null)
        setPlan(null); setPreview(null); setExecutionEnabled(false); setGithubReview(null)
        setError(null); setMessage("JSON API starter loaded. Review and stage when ready.")
      }}>Load JSON API starter</Button>
    <div className="flex flex-wrap items-end gap-2">
      <label className="grid min-w-56 flex-1 gap-1 text-sm">Public GitHub repository
        <Input aria-label="Public GitHub repository" placeholder="owner/repository"
          value={githubRepository} maxLength={150}
          onChange={event => {
            setGithubRepository(event.target.value)
            setGithubReview(null)
          }} />
      </label>
      <Button variant="outline" disabled={busy || !ownerAuthorized || !githubRepository.trim()}
        onClick={() => action(async () => {
          await reviewGithubSource(controller)
        })}>{selected.candidateRelease ? "Check GitHub updates" : "Load GitHub source"}</Button>
    </div>
    {githubReview && <p className="text-muted-foreground text-xs"
      aria-label="GitHub source changes">
      {githubReview.repository} @ {githubReview.commit.slice(0, 12)} · Changed: {githubReview.changed.join(", ")} · Dependencies: {githubReview.dependencies} · Build: {githubReview.buildRequired ? "required" : "none"} · Frontend files: {githubReview.extraCount} · Binary assets: {githubReview.assetCount}
      {(githubReview.dependencies > 0 || githubReview.buildRequired) &&
        " · Staging only; package installation/build requires separate approval."}
    </p>}
    <label className="grid gap-1 text-sm">Load local Node files
      <input type="file" aria-label="Load local Node files" multiple accept=".json,.mjs"
        disabled={busy} className="w-full rounded-md border bg-background p-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-2 file:text-sm file:font-medium"
        onChange={event => {
          const picked = Array.from(event.currentTarget.files ?? [])
          event.currentTarget.value = ""
          if (!picked.length) return
          action(async () => {
            const files = await readLocalNodeFiles(picked)
            setManifest(files.manifest)
            setLockfile(files.lockfile)
            setSource(files.source)
            setSourceOrigin("local")
            setExtraFiles({})
            setAssetFiles({})
            setApproved(false)
            setBuildCheck(null)
            setPlan(null)
            setPreview(null)
            setExecutionEnabled(false)
            setEditorDirty(true)
            setGithubReview(null)
            setDependencyReview(null)
            setMessage("Three Node files loaded into the editor. Validate and stage to save a candidate.")
          })
        }} />
    </label>
    <label className="grid gap-1 text-sm">Load Node project folder
      <input type="file" aria-label="Load Node project folder" multiple
        ref={element => { if (element) element.setAttribute("webkitdirectory", "") }}
        disabled={busy} className="w-full rounded-md border bg-background p-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-2 file:text-sm file:font-medium"
        onChange={event => {
          const chosen = Array.from(event.currentTarget.files ?? [])
          event.currentTarget.value = ""
          if (!chosen.length) return
          action(async () => {
            const local = await readLocalNodeFolder(chosen)
            setManifest(local.manifest)
            setLockfile(local.lockfile)
            setSource(local.source)
            setSourceOrigin("local")
            setExtraFiles(local.extraFiles)
            setAssetFiles(local.assetFiles)
            setApproved(false); setBuildApproved(false); setBuildCheck(null)
            setPlan(null); setPreview(null); setBuildReview(null)
            setExecutionEnabled(false); setEditorDirty(true)
            setGithubReview(null); setDependencyReview(null)
            setMessage("Local project folder reviewed. Validate and stage to save its files; no code executed.")
          })
        }} />
    </label>
    <details data-testid="node-source-editors" className="rounded-lg border p-3">
      <summary className="cursor-pointer text-sm font-medium">
        Edit package.json, package-lock.json & server.mjs
      </summary>
      <div className="mt-3 space-y-3">
    <label className="grid gap-1 text-sm">package.json
      <textarea aria-label="package.json" className="w-full rounded-md border bg-background p-3 font-mono text-xs" rows={8}
        value={manifest} onChange={event => { setManifest(event.target.value); setEditorDirty(true); setSourceOrigin("edited"); setApproved(false); setGithubReview(null); setDependencyReview(null) }} /></label>
    <label className="grid gap-1 text-sm">package-lock.json
      <textarea aria-label="package-lock.json" className="w-full rounded-md border bg-background p-3 font-mono text-xs" rows={8}
        value={lockfile} onChange={event => { setLockfile(event.target.value); setEditorDirty(true); setSourceOrigin("edited"); setApproved(false); setGithubReview(null); setDependencyReview(null) }} /></label>
    <label className="grid gap-1 text-sm">server.mjs
      <textarea aria-label="server.mjs" className="w-full rounded-md border bg-background p-3 font-mono text-xs" rows={8}
        value={source} onChange={event => { setSource(event.target.value); setEditorDirty(true); setSourceOrigin("edited"); setApproved(false); setGithubReview(null); setDependencyReview(null) }} /></label>
      </div>
    </details>
    <p className="text-muted-foreground text-xs" aria-label="Imported frontend files">
      Extra source files: {Object.keys(extraFiles).length ?
        Object.keys(extraFiles).sort().join(", ") : "none"}
    </p>
    <p className="text-muted-foreground text-xs" aria-label="Imported binary assets">
      Binary assets: {Object.keys(assetFiles).length ?
        Object.keys(assetFiles).sort().join(", ") : "none"}
    </p>
    {(Object.keys(extraFiles).length > 0 || Object.keys(assetFiles).length > 0) &&
      <Button variant="outline"
      disabled={busy} onClick={() => {
        setExtraFiles({})
        setAssetFiles({})
        setEditorDirty(true)
        setApproved(false)
        setGithubReview(null)
        setDependencyReview(null)
        setBuildReview(null)
        setPlan(null)
      }}>Clear imported frontend files</Button>}
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" disabled={busy || !ownerAuthorized || !selected.candidateRelease}
        onClick={() => action(async () => {
          await loadCandidateSource(controller)
        })}>Load staged source</Button>
      <Button disabled={busy || !ownerAuthorized || (!!selected.candidateRelease && !editorDirty)}
        onClick={() => action(async () => {
          await stageCandidateSource(controller)
      })}>Validate and stage source</Button>
      <Button variant="outline" disabled={busy || !ownerAuthorized || !selected.previousCandidate}
        onClick={() => action(async () => {
          await restoreCandidateSource(controller)
        })}>Restore previous candidate</Button>
    </div>
      </div>
    </details>
  </>
}
