import { Link } from "react-router-dom"
import { RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SiteCreationForm } from "./site-creation-form"
import type { useOwnedSiteCreation } from "./use-owned-site-creation"
import type { useOwnedSiteInventory } from "./use-owned-site-inventory"

export function SiteCreationWorkspace({ inventory, creation }: {
  inventory: ReturnType<typeof useOwnedSiteInventory>
  creation: ReturnType<typeof useOwnedSiteCreation>
}) {
  const { sites, loading, error, refresh } = inventory
  const { creating, notice } = creation

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Add website</h1>
        <div className="flex items-center gap-3">
          <Link to="/sites" className="text-sm underline underline-offset-4">Websites</Link>
          <Button variant="outline" disabled={loading || creating} onClick={() => void refresh()}>
            <RefreshCw /> Refresh
          </Button>
        </div>
      </div>
      {loading && <p role="status" className="text-sm">Reading owned site inventory…</p>}
      {error && <p role="alert" className="text-destructive text-sm">{error}</p>}
      {notice && !creating && !error && <p role="status" className="text-sm">{notice}</p>}
      {!loading && !error && <p className="text-muted-foreground text-sm">
        {sites.length === 0 ? "No static sites yet." : sites.length + " of 8 sites registered."}
      </p>}
      <SiteCreationForm creation={creation} sitesCount={sites.length} loading={loading} error={error} />
    </>
  )
}
