import { api, validatedExtras, validatedAssets, validProject, nodeSourceWriteMatchesReadback } from "../node-project-client"
import type { SelectedNodeController } from "../state/use-node-project-controller"

export async function reviewGithubSource(controller: SelectedNodeController) {
  const { getJson, selected, githubRepository, setGithubReview, setMessage, setExtraFiles, setAssetFiles, setManifest, setLockfile, setSource, setSourceOrigin, setApproved, setBuildCheck, setPlan, setPreview, setDependencyReview, setExecutionEnabled, setEditorDirty } = controller
  const result = await getJson(api + "/github/preview", "POST",
    { repository: githubRepository.trim() })
  const data = result.preview as Record<string, unknown> | undefined
  const contents = data?.source as Record<string, unknown> | undefined
  const sourcePlan = data?.plan as Record<string, unknown> | undefined
  const commands = sourcePlan?.commands as Record<string, unknown> | undefined
  if (!data || !sourcePlan || !commands ||
      typeof sourcePlan.dependencyCount !== "number" ||
      !Number.isSafeInteger(sourcePlan.dependencyCount) ||
      (sourcePlan.dependencyCount as number) < 0 ||
      (sourcePlan.dependencyCount as number) > 500 ||
      (commands.build !== null &&
       (!Array.isArray(commands.build) ||
        commands.build.length !== 3 ||
        commands.build.join(" ") !== "npm run build")) ||
      data.repository !== githubRepository.trim() ||
      typeof data.commit !== "string" || !/^[a-f0-9]{40}$/.test(data.commit) ||
      !contents || typeof contents.packageJson !== "object" ||
      !contents.packageJson || Array.isArray(contents.packageJson) ||
      typeof contents.packageLock !== "object" ||
      !contents.packageLock || Array.isArray(contents.packageLock) ||
      typeof contents.serverSource !== "string" ||
      !contents.serverSource.trim() || contents.serverSource.length > 65536)
    throw new Error("Invalid GitHub Node source preview")
  const fetchedExtras = validatedExtras(contents.extraFiles)
  const fetchedAssets = validatedAssets(contents.assetFiles)
  const changed = ["package.json", "package-lock.json", "server.mjs"]
  if (selected.candidateRelease) {
    // Compare only with attested on-host source, never the editor buffer.
    const current = await getJson(api + "/" + selected.id + "/source")
    const staged = current.source as Record<string, unknown> | undefined
    if (!staged || staged.release !== selected.candidateRelease ||
        typeof staged.manifest !== "string" ||
        typeof staged.lockfile !== "string" ||
        typeof staged.serverSource !== "string" ||
        staged.manifest.length > 140000 || staged.lockfile.length > 140000 ||
        staged.serverSource.length > 65536)
      throw new Error("Could not verify current staged Node source")
    try {
      if (JSON.stringify(JSON.parse(staged.manifest)) ===
          JSON.stringify(contents.packageJson)) changed.splice(changed.indexOf("package.json"), 1)
      if (JSON.stringify(JSON.parse(staged.lockfile)) ===
          JSON.stringify(contents.packageLock)) changed.splice(changed.indexOf("package-lock.json"), 1)
      if (staged.serverSource === contents.serverSource)
        changed.splice(changed.indexOf("server.mjs"), 1)
    } catch {
      throw new Error("Could not verify current staged Node source")
    }
    const oldExtras = validatedExtras(staged.extraFiles)
    if (JSON.stringify(oldExtras) !== JSON.stringify(fetchedExtras))
      changed.push("frontend files")
    const oldAssets = validatedAssets(staged.assetFiles)
    if (JSON.stringify(oldAssets) !== JSON.stringify(fetchedAssets))
      changed.push("binary assets")
    if (!changed.length) {
      setGithubReview(null)
      setMessage("GitHub commit " + data.commit.slice(0, 12) +
        " matches the current staged source. No update needed.")
      return
    }
  }
  setGithubReview({
    repository: data.repository as string,
    commit: data.commit,
    changed,
    dependencies: sourcePlan.dependencyCount as number,
    buildRequired: commands.build !== null,
    extraCount: Object.keys(fetchedExtras).length,
    assetCount: Object.keys(fetchedAssets).length,
  })
  setExtraFiles(fetchedExtras)
  setAssetFiles(fetchedAssets)
  setManifest(JSON.stringify(contents.packageJson, null, 2))
  setLockfile(JSON.stringify(contents.packageLock, null, 2))
  setSource(contents.serverSource)
  setSourceOrigin("github")
  setApproved(false); setBuildCheck(null); setPlan(null); setPreview(null)
  setDependencyReview(null)
  setExecutionEnabled(false); setEditorDirty(true)
  setMessage("GitHub commit " + data.commit.slice(0, 12) +
    " contains changes. Review and stage to preserve the previous release.")
}

export async function loadCandidateSource(controller: SelectedNodeController) {
  const { getJson, selected, setManifest, setLockfile, setSource, setSourceOrigin, setExtraFiles, setAssetFiles, setApproved, setBuildCheck, setPreview, setEditorDirty, setGithubReview, setDependencyReview, setMessage } = controller
  const response = await getJson(api + "/" + selected.id + "/source")
  const value = response.source as Record<string, unknown> | undefined
  if (!value || value.release !== selected.candidateRelease ||
    typeof value.manifest !== "string" || value.manifest.length > 140000 ||
    typeof value.lockfile !== "string" || value.lockfile.length > 140000 ||
    typeof value.serverSource !== "string" || value.serverSource.length > 65536)
    throw new Error("Invalid verified candidate source")
  const verifiedExtras = validatedExtras(value.extraFiles)
  const verifiedAssets = validatedAssets(value.assetFiles)
  setManifest(value.manifest); setLockfile(value.lockfile)
  setSource(value.serverSource); setSourceOrigin("staged"); setExtraFiles(verifiedExtras)
  setAssetFiles(verifiedAssets); setApproved(false)
  setBuildCheck(null); setPreview(null); setEditorDirty(false); setGithubReview(null)
  setDependencyReview(null)
  setMessage("Verified staged source loaded into editor; no process changed.")
}

export async function stageCandidateSource(controller: SelectedNodeController) {
  const { getJson, selected, manifest, lockfile, source, extraFiles, assetFiles, refresh, invalidateRead, beginInspection, resetLogs, setApproved, setPreview, loadReleases, loadRuntime, setBuildCheck, setEditorDirty, setGithubReview, setSourceOrigin, setMessage } = controller
  const data = await getJson(api + "/" + selected.id + "/stage", "POST", {
    packageJson: JSON.parse(manifest) as unknown,
    packageLock: JSON.parse(lockfile) as unknown,
    serverSource: source,
    ...(Object.keys(extraFiles).length ? { extraFiles } : {}),
    ...(Object.keys(assetFiles).length ? { assetFiles } : {}),
    expectedCandidate: selected.candidateRelease,
    expectedRevision: selected.deploymentCount,
  })
  if (!validProject(data.project)) throw new Error("Invalid stage response")
  const catalog = await refresh()
  if (!nodeSourceWriteMatchesReadback(selected.id, data.project, catalog)) {
    invalidateRead(); beginInspection(); resetLogs()
    setApproved(false); setPreview(null)
    throw new Error("Node source result unconfirmed. Refresh project and review the candidate before retrying.")
  }
  await Promise.all([loadReleases(selected.id), loadRuntime(selected.id)])
  setApproved(false); setBuildCheck(null); setEditorDirty(false); setGithubReview(null)
  setSourceOrigin("staged")
  setMessage(data.unchanged === true
    ? "Source matches the current verified candidate. No new release created."
    : "Source candidate staged. Review the execution plan before deploying.")
}

export async function restoreCandidateSource(controller: SelectedNodeController) {
  const { getJson, selected, refresh, invalidateRead, beginInspection, resetLogs, setApproved, setPreview, loadReleases, loadRuntime, setGithubReview, setMessage } = controller
  const data = await getJson(api + "/" + selected.id + "/restore-candidate", "POST", {
    expectedCandidate: selected.candidateRelease,
    expectedRevision: selected.deploymentCount,
  })
  if (!validProject(data.project)) throw new Error("Invalid restore response")
  const catalog = await refresh()
  if (!nodeSourceWriteMatchesReadback(selected.id, data.project, catalog)) {
    invalidateRead(); beginInspection(); resetLogs()
    setApproved(false); setPreview(null)
    throw new Error("Node source result unconfirmed. Refresh project and review the candidate before retrying.")
  }
  await Promise.all([loadReleases(selected.id), loadRuntime(selected.id)])
  setApproved(false); setGithubReview(null)
  setMessage("Previous source candidate restored. No live process was changed.")
}
