import * as React from "react"
import { useSearchParams } from "react-router-dom"
import { RefreshCw } from "lucide-react"

import { BaseLayout } from "@/components/layouts/base-layout"
import { Button } from "@/components/ui/button"
import { useOwnedSiteInventory } from "./use-owned-site-inventory"
import { useOwnedSiteCreation } from "./use-owned-site-creation"
import { SiteCreationForm } from "./site-creation-form"
import { SiteDetailPanel } from "./site-detail-panel"

export default function SitesPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const selectedSiteId = searchParams.get("site")
  const { sites, setSites, loading, error, setError, reload, refresh } = useOwnedSiteInventory()
  const creation = useOwnedSiteCreation({
    sitesCount: sites.length, loading, error, setSites, setError,
  })
  const { creating, notice } = creation
  const [removalNotice, setRemovalNotice] = React.useState<string | null>(null)

  return (
    <BaseLayout title="Hosted sites" description="Create and operate your own static sites on Samsung Termux, without a shell.">
      <div className="space-y-5 px-4 pb-8 lg:px-6">
        <div className="flex min-h-10 items-center justify-end">
          <Button type="button" variant="outline" disabled={loading || creating} onClick={() => void refresh()}>
            <RefreshCw className="size-4" /> Refresh
          </Button>
        </div>
        <SiteCreationForm creation={creation} sitesCount={sites.length} loading={loading} error={error} />
        {selectedSiteId && <div className="flex flex-wrap items-center gap-3 text-sm">
          <span>{sites.some(site => site.id === selectedSiteId)
            ? "Selected static site: " + sites.find(site => site.id === selectedSiteId)?.name
            : "Selected static site: " + selectedSiteId}</span>
          <Button variant="outline" size="sm" onClick={() => setSearchParams({})}>Show all sites</Button>
        </div>}
        {loading && <p role="status" className="text-sm">Reading owned site inventory…</p>}
        {error && <p role="alert" className="text-destructive text-sm">{error}</p>}
        {notice && <p role="status" className="text-sm">{notice}</p>}
        {removalNotice && <p role="status" className="text-sm">{removalNotice}</p>}
        {!loading && sites.length === 0 && !error && <p className="text-muted-foreground text-sm">
          No static sites yet. Create your first site above.
        </p>}
        {!loading && selectedSiteId && !sites.some(site => site.id === selectedSiteId) && !error &&
          <p role="alert" className="text-sm">This static site was not found in the owned inventory.</p>}
        <div className="grid gap-5">
          {sites.filter(site => !selectedSiteId || site.id === selectedSiteId)
            .map(site => <SiteDetailPanel key={site.id} site={site} onChange={removedId => reload(undefined, removedId)}
              onRemoved={name => {
                setRemovalNotice("Deleted " + name + ".")
                if (selectedSiteId === site.id) setSearchParams({})
              }} />)}
        </div>
        <p className="text-muted-foreground text-xs">
          Each site is bound to its own local-only port; the manually enabled trusted-LAN gateway
          publishes GET/HEAD-only previews on its separate site origin. No authentication is provided
          on this development LAN; never expose it on untrusted networks.
        </p>
      </div>
    </BaseLayout>
  )
}
