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

  const read = async () => {
    const revision = epoch.current
    const response = await fetch(endpoint + "/" + site.id + "/releases", {
      credentials: "same-origin", cache: "no-store", signal: readSignal(),
    })
    if (!response.ok) throw new Error("Version history is unavailable.")
    const parsed = parseFleetReleases(await response.json())
    if (revision === epoch.current && opened.current) setVersions(parsed)
  }
  const load = () => {
    const revision = epoch.current
    setVersionsLoading(true)
    void read().catch(cause => {
      if (revision === epoch.current && opened.current) {
        opened.current = false
        setError(cause instanceof Error ? cause.message : "Version inventory unavailable.")
      }
    }).finally(() => { if (revision === epoch.current) setVersionsLoading(false) })
  }
  React.useEffect(() => {
    setVersions(null)
    setVersionsLoading(false)
    if (opened.current) load()
  }, [site])
  const toggleVersions = () => {
    if (opened.current) { opened.current = false; setVersions(null); return }
    if (versionsLoading || busy) return
    opened.current = true
    setError(null)
    load()
  }
  return { versions, versionsLoading, toggleVersions }
}
