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
    }
  }, [])

  React.useEffect(() => {
    const controller = new AbortController()
    void Promise.resolve().then(() => reload(controller.signal))
      .catch(() => {})
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [reload])

  const refresh = async () => {
    setLoading(true)
    await reload().catch(() => undefined)
    setLoading(false)
  }

  return { sites, setSites, loading, error, setError, reload, refresh }
}
