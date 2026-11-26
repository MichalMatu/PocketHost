import { api, validProject, NodeProjectValidationError } from "../node-project-client"
import { verifyNodeRemoval } from "../node-project-removal"
import type { NodeProjectController, SelectedNodeController } from "../state/use-node-project-controller"

export async function createNodeProject(controller: NodeProjectController, onCreated?: (id: string) => void) {
  const { setCreatePhase, name, getJson, refresh, invalidateRead, beginInspection, resetLogs, setSelectedId, setName, setApproved, setPreview, setMessage, loadRuntime, setError, creatingRef } = controller
  setCreatePhase("pending")
  const submittedName = name.trim()
  try {
    const data = await getJson(api + "/", "POST", { name: submittedName })
    const createdProject = data.project
    if (!validProject(createdProject) || createdProject.name !== submittedName)
      throw new Error("Unverified create acknowledgement")
    const catalog = await refresh()
    if (!catalog.some(project => project.id === createdProject.id && project.name === submittedName))
      throw new Error("Created project not found in verified catalog")
    invalidateRead()
    beginInspection()
    resetLogs()
    setSelectedId(createdProject.id); setName(""); setApproved(false)
    setPreview(null)
    setCreatePhase("confirmed")
    setMessage("Private Node project created.")
    if (onCreated) onCreated(createdProject.id)
    else void loadRuntime(createdProject.id).catch(() => {
      setError("Project confirmed in catalog, but runtime readback failed. Refresh runtime status.")
    })
  } catch (cause) {
    if (cause instanceof NodeProjectValidationError) {
      setCreatePhase("rejected")
      throw cause
    }
    // Missing or invalid acknowledgement does not prove that the POST failed.
    setCreatePhase("unknown")
    throw new Error("Project creation unconfirmed. Refresh the catalog before another create.", { cause })
  } finally {
    creatingRef.current = false
  }
}

export async function removeNodeProject(controller: SelectedNodeController, onRemoved?: () => void) {
  const { getJson, selected, runtime, refresh, invalidateRead, beginInspection, resetLogs, setSelectedId, setSearchParams, setMessage, verifiedCatalog, setProjects, setCatalogState } = controller
  try {
    const result = await getJson(api + "/" + selected.id + "/remove", "POST", {
      approved: true, expectedRevision: selected.deploymentCount,
      expectedCandidate: selected.candidateRelease, expectedActiveRelease: runtime?.activeRelease ?? null,
    })
    verifyNodeRemoval(result, selected.id)
    const catalog = await refresh()
    if (catalog.some(item => item.id === selected.id)) throw new Error("Project still in catalog")
    invalidateRead(); beginInspection(); resetLogs()
    setSelectedId(""); setSearchParams({}, { replace: true })
    setMessage("Project removed. Source, data and logs retained.")
    onRemoved?.()
  } catch (cause) {
    verifiedCatalog.current = []; setProjects([]); setCatalogState("error")
    invalidateRead(); beginInspection(); resetLogs(); setSelectedId("")
    throw new Error("Removal unconfirmed. Refresh before another operation.", { cause })
  }
}
