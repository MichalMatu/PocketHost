import * as React from "react"
import { matchPath, useLocation, useNavigate, useSearchParams } from "react-router-dom"
import { Plus, RefreshCw } from "lucide-react"

import { BaseLayout } from "@/components/layouts/base-layout"
import { Button } from "@/components/ui/button"
import { siteDetailPath } from "./site-route"
import { useOwnedSiteCreation } from "./use-owned-site-creation"
import { useOwnedSiteInventory } from "./use-owned-site-inventory"
import { SiteCreationWorkspace } from "./site-creation-workspace"
import { SiteDetailPanel } from "./site-detail-panel"
import { SiteCatalog } from "./site-catalog"

export default function SitesPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const adding = matchPath("/sites/new", location.pathname) !== null
  const selectedSiteId = adding ? null :
    matchPath("/sites/:id", location.pathname)?.params.id ?? searchParams.get("site")
  const inventory = useOwnedSiteInventory()
  const { sites, loading, error, reload, refresh, setSites, setError } = inventory
  const selected = sites.find(site => site.id === selectedSiteId)
  const selection = React.useRef(selectedSiteId)
  React.useEffect(() => {
    selection.current = selectedSiteId
    return () => { selection.current = null }
  }, [selectedSiteId])
  const routeKey = React.useRef<string | null>(location.key)
  React.useEffect(() => {
    routeKey.current = location.key
    return () => { routeKey.current = null }
  }, [location.key])
  const creation = useOwnedSiteCreation({
    sitesCount: sites.length, loading, error, setSites, setError,
    onCreated: (id, message) => {
      if (adding && routeKey.current === location.key) void navigate(siteDetailPath(id), {
        replace: true, state: { siteId: id, notice: message },
      })
    },
  })
  const notice = location.state?.siteId === selectedSiteId && typeof location.state?.notice === "string"
    ? location.state.notice : null

  return (
    <BaseLayout>
      <div className="space-y-5 px-4 pb-8 lg:px-6">
        {adding ? <SiteCreationWorkspace inventory={inventory} creation={creation} /> : <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-xl font-semibold">{selectedSiteId !== null ? "Website details" : "Static websites"}</h1>
            <div className="flex flex-wrap items-center gap-2">
              {selectedSiteId !== null
                ? <Button variant="outline" onClick={() => void navigate("/sites")}>Show all sites</Button>
                : <Button disabled={creation.creating || loading || error !== null || sites.length >= 8}
                    onClick={() => void navigate("/sites/new")}><Plus /> Add website</Button>}
              <Button variant="outline" disabled={loading || creation.creating} onClick={() => void refresh()}>
                <RefreshCw /> Refresh
              </Button>
            </div>
          </div>
          {loading && <p role="status" className="text-sm">Reading owned site inventory…</p>}
          {error && <p role="alert" className="text-destructive text-sm">{error}</p>}
          {notice && !error && <p role="status" className="text-sm">{notice}</p>}
          {creation.creating && <p role="status" className="text-sm">Creating site and verifying readback…</p>}
          {!creation.creating && (selectedSiteId === null
            ? !loading && !error && <SiteCatalog sites={sites} />
            : selected
              ? <SiteDetailPanel key={selected.id} site={selected} onChange={removedId => reload(undefined, removedId)}
                  onRemoved={name => {
                    if (selection.current === selected.id) void navigate("/sites", {
                      replace: true, state: { siteId: null, notice: "Deleted " + name + "." },
                    })
                  }} />
              : !loading && !error && <p role="alert" className="text-sm">This static site was not found in the owned inventory.</p>)}
        </>}
        <p className="text-muted-foreground text-xs">Use the management panel only on a trusted LAN.</p>
      </div>
    </BaseLayout>
  )
}
