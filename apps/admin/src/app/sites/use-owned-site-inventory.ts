import * as React from "react"
import type { FleetSite } from "@/lib/site-fleet-schema"
import { readSites } from "./site-client"

/** The newest owned inventory wins; earlier GETs must never restore stale controls. */
export function useOwnedSiteInventory() {
  const [sites, updateSites] = React.useState<FleetSite[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const sequence = React.useRef(0)

  // A verified mutation/readback from the parent is newer than any GET in flight.
  // Preserve the existing setter contract while preventing stale catalog replies.
  const setSites = React.useCallback<React.Dispatch<React.SetStateAction<FleetSite[]>>>(next => {
    sequence.current += 1
    updateSites(next)
    setLoading(false)
  }, [])

  const reload = React.useCallback(async (signal?: AbortSignal, removedId?: string) => {
    const current = ++sequence.current
    try {
      const observed = await readSites(signal)
      if (signal?.aborted || current !== sequence.current)
        throw new Error("Owned inventory refresh was superseded.")
      if (removedId && observed.some(site => site.id === removedId))
        throw new Error("Site removal unconfirmed. Refresh the owned inventory before retrying.")
      updateSites(observed)
      setError(null)
    } catch (cause) {
      if (!signal?.aborted && current === sequence.current) {
        updateSites([])
        setError(cause instanceof Error ? cause.message : "Could not load static sites.")
      }
      throw cause
    } finally {
      // Only the newest active read may finish the inventory loading state.
      // A site-card readback can supersede a manual Refresh.
      if (!signal?.aborted && current === sequence.current) setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    const controller = new AbortController()
    void Promise.resolve().then(() => reload(controller.signal))
      .catch(() => {})
    return () => controller.abort()
  }, [reload])

  const refresh = async () => {
    setLoading(true)
    await reload().catch(() => undefined)
  }

  return { sites, setSites, loading, error, setError, reload, refresh }
}
