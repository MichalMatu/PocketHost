import * as React from "react"
import type { FleetSite } from "@/lib/site-fleet-schema"
import { readSites } from "./site-client"

/** The newest owned inventory wins; earlier GETs must never restore stale controls. */
export function useOwnedSiteInventory() {
  const [sites, setSites] = React.useState<FleetSite[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const sequence = React.useRef(0)

  const reload = React.useCallback(async (signal?: AbortSignal) => {
    const current = ++sequence.current
    try {
      const observed = await readSites(signal)
      if (signal?.aborted || current !== sequence.current)
        throw new Error("Owned inventory refresh was superseded.")
      setSites(observed)
      setError(null)
    } catch (cause) {
      if (!signal?.aborted && current === sequence.current) {
        setSites([])
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
