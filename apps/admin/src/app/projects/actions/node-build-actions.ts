import { api, type DependencyReview, type BuildReview } from "../node-project-client"
import type { SelectedNodeController } from "../state/use-node-project-controller"

export async function reviewDependencies(controller: SelectedNodeController) {
  const { setDependencyReview, setDependencyApproved, setDependencyInstallEnabled, getJson, selected, setMessage } = controller
  setDependencyReview(null)
  setDependencyApproved(false)
  setDependencyInstallEnabled(false)
  const result = await getJson(api + "/" + selected.id + "/dependency-review")
  const review = result.review as Partial<DependencyReview> | undefined
  if (!review || review.release !== selected.candidateRelease ||
      !["not-required", "review-required", "prepared", "blocked"].includes(review.status ?? "") ||
      typeof review.dependencyCount !== "number" ||
      !Number.isSafeInteger(review.dependencyCount) ||
      review.dependencyCount < 0 || review.dependencyCount > 500 ||
      typeof review.installRequired !== "boolean" ||
      typeof review.buildRequired !== "boolean" ||
      !Array.isArray(review.blockers) ||
      !review.blockers.every(item => typeof item === "string") ||
      review.executed !== false ||
      (review.installCommand !== null &&
       (!Array.isArray(review.installCommand) ||
        ![
          "npm ci --ignore-scripts --no-bin-links --no-audit --no-fund --omit=dev",
          "npm ci --ignore-scripts --no-bin-links --no-audit --no-fund --include=dev",
        ].includes(review.installCommand.join(" ")))) ||
      (review.buildCommand !== null &&
       (!Array.isArray(review.buildCommand) ||
        review.buildCommand.join(" ") !== "npm run build")) ||
      (review.installRequired !== (review.installCommand !== null)) ||
      (review.buildRequired !== (review.buildCommand !== null)))
    throw new Error("Invalid Node dependency review")
  setDependencyReview(review as DependencyReview)
  setDependencyInstallEnabled(result.dependencyInstallEnabled === true)
  setMessage(review.status === "prepared"
    ? "Installed Node packages verified against the pinned release."
    : "Dependency setup reviewed without running npm or build.")
}

export async function installDependencies(controller: SelectedNodeController) {
  const { selected, dependencyReview, setDependencyApproved, setDependencyReview, setDependencyInstallEnabled, getJson, loadRuntime, setMessage } = controller
  const release = selected.candidateRelease!
  const expectedCount = dependencyReview!.dependencyCount
  setDependencyApproved(false)
  setDependencyReview(null)
  setDependencyInstallEnabled(false)
  let result: Record<string, unknown>
  try {
    result = await getJson(api + "/" + selected.id + "/install-dependencies",
      "POST", { approved: true, release })
  } catch {
    throw new Error("Package installation result unconfirmed. Review setup before retrying.")
  }
  const packages = result.dependencies as Record<string, unknown> | undefined
  if (!packages || packages.release !== release || packages.prepared !== true ||
      packages.verified !== true || packages.dependencyCount !== expectedCount)
    throw new Error("Package installation response unverified. Review before retry.")
  await loadRuntime(selected.id)
  const checked = await getJson(api + "/" + selected.id + "/dependency-review")
  const verified = checked.review as Partial<DependencyReview> | undefined
  if (!verified || verified.release !== release || verified.status !== "prepared")
    throw new Error("Package installation acknowledged but integrity unconfirmed.")
  setDependencyReview(verified as DependencyReview)
  setDependencyInstallEnabled(checked.dependencyInstallEnabled === true)
  setMessage(verified.buildRequired
    ? "Node build dependencies verified. Build execution is still disabled."
    : "Owned Node packages installed and SHA-256 integrity verified. Review deploy plan.")
}

export async function reviewBuild(controller: SelectedNodeController) {
  const { setBuildReview, setBuildApproved, setBuildEnabled, getJson, selected, setMessage } = controller
  setBuildReview(null)
  setBuildApproved(false)
  setBuildEnabled(false)
  const result = await getJson(api + "/" + selected.id + "/build-review")
  const review = result.review as Partial<BuildReview> | undefined
  if (!review || review.release !== selected.candidateRelease ||
      !["not-required", "requires-dependencies", "ready-to-build", "verified", "blocked"]
        .includes(review.status ?? "") ||
      typeof review.buildRequired !== "boolean" ||
      typeof review.dependenciesPrepared !== "boolean" ||
      typeof review.artifactVerified !== "boolean" ||
      typeof review.dependencyCount !== "number" ||
      !Number.isSafeInteger(review.dependencyCount) ||
      review.dependencyCount < 0 || review.dependencyCount > 500 ||
      !Array.isArray(review.blockers) || review.blockers.length > 32 ||
      !review.blockers.every(value => typeof value === "string" && value.length <= 160) ||
      (review.script !== null &&
       (typeof review.script !== "string" || review.script.length > 256)) ||
      review.buildRequired !== (review.script !== null) ||
      (review.artifact !== null && review.artifact !== undefined && (
        !review.artifactVerified ||
        typeof review.artifact !== "object" ||
        !Number.isSafeInteger(review.artifact.entries) ||
        review.artifact.entries < 1 || review.artifact.entries > 512 ||
        !Number.isSafeInteger(review.artifact.bytes) ||
        review.artifact.bytes < 0 || review.artifact.bytes > 16 * 1024 * 1024 ||
        !Array.isArray(review.artifact.files) ||
        review.artifact.files.length > 24 ||
        !review.artifact.files.every(value =>
          typeof value === "string" && value.length <= 256 &&
          !value.startsWith("/") && !value.includes("..") && !value.includes("\\")) ||
        typeof review.artifact.truncated !== "boolean"
      )))
    throw new Error("Invalid Node build review")
  setBuildReview(review as BuildReview)
  setBuildEnabled(result.buildEnabled === true)
  setMessage(review.status === "verified"
    ? "Build artifact verified. Review the deployment plan."
    : "Build reviewed without running project code.")
}

export async function executeBuild(controller: SelectedNodeController) {
  const { selected, setBuildApproved, setBuildReview, setBuildEnabled, setApproved, setPlan, getJson, loadRuntime, setMessage } = controller
  const release = selected.candidateRelease!
  setBuildApproved(false)
  setBuildReview(null)
  setBuildEnabled(false)
  setApproved(false)
  setPlan(null)
  let result: Record<string, unknown>
  try {
    result = await getJson(api + "/" + selected.id + "/build",
      "POST", { approved: true, release })
  } catch {
    throw new Error("Node build result unconfirmed. Review the artifact before retrying.")
  }
  const built = result.build as Record<string, unknown> | undefined
  if (!built || built.release !== release || built.prepared !== true ||
      built.verified !== true || typeof built.entries !== "number" ||
      !Number.isSafeInteger(built.entries) || built.entries < 1 ||
      built.entries > 512 || typeof built.bytes !== "number" ||
      !Number.isSafeInteger(built.bytes) || built.bytes < 0 ||
      built.bytes > 16 * 1024 * 1024)
    throw new Error("Unverified Node build result. Review before retrying.")
  await loadRuntime(selected.id)
  const checked = await getJson(api + "/" + selected.id + "/build-review")
  const review = checked.review as Partial<BuildReview> | undefined
  if (!review || review.release !== release || review.status !== "verified" ||
      review.artifactVerified !== true)
    throw new Error("Node build acknowledged but artifact integrity unconfirmed.")
  setBuildReview(review as BuildReview)
  setBuildEnabled(checked.buildEnabled === true)
  setMessage("Node build published privately and artifact integrity verified. Review deploy plan.")
}

export async function checkBuildSyntax(controller: SelectedNodeController) {
  const { getJson, selected, setBuildCheck, setMessage } = controller
  const result = await getJson(api + "/" + selected.id + "/check-build",
    "POST", { release: selected.candidateRelease })
  const report = result.buildCheck as Record<string, unknown> | undefined
  if (!report || report.release !== selected.candidateRelease ||
    !["syntax-valid", "syntax-invalid"].includes(String(report.status)) ||
    report.executed !== false) throw new Error("Invalid source check result")
  setBuildCheck(report as {
    release: string; status: "syntax-valid" | "syntax-invalid"; executed: false
  })
  setMessage("Node syntax check completed without executing project source.")
}
