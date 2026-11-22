import { parseFleetSite, type FleetSite } from "@/lib/site-fleet-schema"
import { endpoint, readSignal, readSites } from "./site-client"

/** Confirm exact stopped-site identity and any first imported release before updating the UI. */
export async function verifyCreatedSiteReadback(
  created: FleetSite,
  expectedName: string,
  hasFirstFiles: boolean,
): Promise<FleetSite[]> {
  const observed = await readSites()
  const matching = observed.filter(site => site.id === created.id)
  const current = matching[0]
  if (matching.length !== 1 || !current ||
      current.name !== expectedName ||
      current.kind !== "static-site" ||
      current.state !== "stopped" || current.pid !== null ||
      current.startTicks !== null ||
      current.previousRelease !== null || current.canRollback ||
      created.id !== current.id || created.name !== current.name ||
      created.port !== current.port || created.state !== current.state ||
      created.activeRelease !== current.activeRelease ||
      created.fileCount !== current.fileCount ||
      created.bytes !== current.bytes ||
      created.releases !== current.releases)
    throw new Error("create-readback-mismatch")
  if (hasFirstFiles) {
    const response = await fetch(endpoint + "/" + created.id, {
      credentials: "same-origin", cache: "no-store", signal: readSignal(),
    })
    if (!response.ok) throw new Error("first-release-readback-unavailable")
    const exact = parseFleetSite(await response.json())
    if (created.activeRelease === null || created.releases !== 1 ||
        created.fileCount < 1 || created.bytes < 1 ||
        exact.id !== created.id || exact.name !== created.name ||
        exact.port !== created.port || exact.state !== "stopped" ||
        exact.pid !== null || exact.previousRelease !== null ||
        exact.activeRelease !== created.activeRelease ||
        exact.fileCount !== created.fileCount || exact.bytes !== created.bytes ||
        exact.releases !== created.releases ||
        exact.history.length !== created.history.length)
      throw new Error("first-release-readback-mismatch")
  } else if (created.activeRelease !== null || created.releases !== 0 ||
             created.fileCount !== 0 || created.bytes !== 0) {
    throw new Error("unexpected initial site release")
  }
  return observed
}
