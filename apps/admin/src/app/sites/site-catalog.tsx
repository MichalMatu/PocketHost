import { Plus } from "lucide-react"

import { InventoryList, InventoryRow } from "@/components/inventory-card"
import { pageActionClass } from "@/components/layouts/standard-page-layout"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatBytes } from "@/lib/format-memory"
import type { FleetSite } from "@/lib/site-fleet-schema"
import { siteDetailPath } from "./site-route"

export function SiteCatalog({ sites, loading, error, notice, creating, onAdd }: {
  sites: FleetSite[]
  loading: boolean
  error: string | null
  notice: string | null
  creating: boolean
  onAdd: () => void
}) {
  return (
    <Card role="region" aria-labelledby="static-sites-heading">
      <CardHeader>
        <CardTitle><h2 id="static-sites-heading">Static websites</h2></CardTitle>
        <CardAction>
          <Button className={pageActionClass} disabled={creating || loading || error !== null || sites.length >= 8}
            onClick={onAdd}><Plus aria-hidden="true" data-icon="inline-start" />Add website</Button>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading && <p role="status">Reading owned site inventory…</p>}
        {error && <p role="alert" className="text-destructive">{error}</p>}
        {notice && !error && <p role="status">{notice}</p>}
        {creating && <p role="status">Creating site and verifying readback…</p>}
        {!loading && !error && !creating && (sites.length === 0
          ? <p className="text-muted-foreground">No static sites yet.</p>
          : <InventoryList>
            {sites.map(site => (
              <InventoryRow key={site.id} name={site.name} to={siteDetailPath(site.id)} state={site.state}>
                <span>Port {site.port} · {site.fileCount} files · {formatBytes(site.bytes)}</span>
              </InventoryRow>
            ))}
          </InventoryList>)}
        <p className="text-muted-foreground text-xs">Use the management panel only on a trusted LAN.</p>
      </CardContent>
    </Card>
  )
}
