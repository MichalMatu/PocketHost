import * as React from "react"
import { parseFleetReleases, type FleetRelease, type FleetSite } from "@/lib/site-fleet-schema"
import { endpoint, readSignal } from "./site-client"

export function useSiteVersions(
  site: FleetSite, epoch: React.RefObject<number>,
  setError: React.Dispatch<React.SetStateAction<string | null>>,
  busy: boolean,
) {
  const [versions, setVersions] = React.useState<FleetRelease[] | null>(null)
  const [versionsLoading, setVersionsLoading] = React.useState(false)
  const opened = React.useRef(false)
  const requestSequence = React.useRef(0)

  const load = () => {
    const revision = epoch.current
    const request = ++requestSequence.current
    const current = () =>
      revision === epoch.current && request === requestSequence.current
    setVersionsLoading(true)
    void fetch(endpoint + "/" + site.id + "/releases", {
      credentials: "same-origin", cache: "no-store", signal: readSignal(),
    }).then(async response => {
      if (!response.ok) throw new Error("Version history is unavailable.")
      const releases = parseFleetReleases(await response.json())
      // The history response may be older than the verified site inventory.
      // Never offer restore/prune controls for a mismatched active/rollback release.
      if (site.activeRelease !== undefined &&
          ((releases.find(release => release.active)?.id ?? null) !== site.activeRelease ||
           (releases.find(release => release.rollbackTarget)?.id ?? null) !== site.previousRelease))
        throw new Error("Version history does not match the current site. Refresh and retry.")
      return releases
    }).then(parsed => {
      if (current() && opened.current) setVersions(parsed)
    }).catch(cause => {
      if (current() && opened.current) {
        opened.current = false
        setVersions(null)
        setError(cause instanceof Error ? cause.message : "Version inventory unavailable.")
      }
    }).finally(() => {
      if (current()) setVersionsLoading(false)
    })
  }

  React.useEffect(() => {
    // A new verified inventory revision supersedes all prior version GETs.
    requestSequence.current += 1
    setVersions(null)
    setVersionsLoading(false)
    if (opened.current) load()
  }, [site])

  React.useEffect(() => () => { requestSequence.current += 1 }, [])

  const toggleVersions = () => {
    if (opened.current) {
      // Closing must release the loading state without waiting for a hung GET.
      // A later reopen must not accept the previously opened request's reply.
      opened.current = false
      requestSequence.current += 1
      setVersions(null)
      setVersionsLoading(false)
      return
    }
    if (versionsLoading || busy) return
    opened.current = true
    setError(null)
    load()
  }

  return { versions, versionsLoading, toggleVersions }
}
