import * as React from "react"
import type { FleetSite } from "@/lib/site-fleet-schema"
import { parseH3Files, type H3Files } from "@/lib/termux-center-schema"
import { endpoint, readSignal } from "./site-client"

/** Read-only active-release assets with cancel/reopen and revision scoping. */
export function useSiteAssets(
  site: FleetSite,
  setError: React.Dispatch<React.SetStateAction<string | null>>,
  busy: boolean,
) {
  const [assets, setAssets] = React.useState<H3Files | null>(null)
  const [assetsLoading, setAssetsLoading] = React.useState(false)
  // A refreshed site object invalidates the visible list in the same render,
  // before the effect's async cleanup or any late GET can update the view.
  const [assetRevision, setAssetRevision] = React.useState(site)
  const opened = React.useRef(false)
  const sequence = React.useRef(0)

  const resetAssets = () => {
    sequence.current++
    opened.current = false
    setAssets(null)
    setAssetsLoading(false)
  }

  React.useEffect(() => {
    const revision = ++sequence.current
    opened.current = false
    void Promise.resolve().then(() => {
      if (revision !== sequence.current) return
      setAssets(null)
      setAssetsLoading(false)
    })
    return () => { sequence.current++ }
  }, [site])

  const toggleAssets = () => {
    if (opened.current) {
      // Hiding while a GET is pending does not wait for a possibly stalled host.
      resetAssets()
      return
    }
    if (busy || site.state === "unknown" || !site.activeRelease) return
    opened.current = true
    setAssetRevision(site)
    const request = ++sequence.current
    const current = () => request === sequence.current && opened.current
    setAssets(null)
    setAssetsLoading(true)
    setError(null)
    void fetch(endpoint + "/" + site.id + "/files", {
      method: "GET", credentials: "same-origin", cache: "no-store", signal: readSignal(),
    }).then(async response => {
      if (!response.ok) throw new Error("Active site files are unavailable.")
      const files = parseH3Files(await response.json())
      // The asset list and summary are separate reads. Reject a stale or
      // incomplete list instead of presenting it as the current release.
      if (files.length !== site.fileCount ||
          files.reduce((total, file) => total + file.bytes, 0) !== site.bytes)
        throw new Error("Asset inventory does not match the current site. Refresh and retry.")
      return files
    }).then(parsed => {
      if (current()) setAssets(parsed)
    }).catch(cause => {
      if (!current()) return
      // A failed read closes the inventory; the next Inspect click must retry.
      opened.current = false
      setAssets(null)
      setError(cause instanceof Error ? cause.message : "Asset inventory unavailable.")
    }).finally(() => {
      if (request === sequence.current) setAssetsLoading(false)
    })
  }

  return {
    assets: assetRevision === site ? assets : null,
    assetsLoading: assetRevision === site ? assetsLoading : false,
    toggleAssets, resetAssets,
  }
}
