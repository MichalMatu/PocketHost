import { Link } from "react-router-dom"
import { Badge } from "@/components/ui/badge"
import { formatBytes } from "@/lib/format-memory"
import type { FleetSite } from "@/lib/site-fleet-schema"
import { siteDetailPath } from "./site-route"

export function SiteCatalog({ sites }: { sites: FleetSite[] }) {
  if (!sites.length) return <p className="text-muted-foreground text-sm">No static sites yet.</p>

  return (
    <ul className="divide-y rounded-lg border">
      {sites.map(site => (
        <li key={site.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="min-w-0 space-y-1">
            <Link to={siteDetailPath(site.id)} className="inline-flex min-h-10 items-center break-all font-medium underline-offset-4 hover:underline">
              {site.name}
            </Link>
            <p className="text-muted-foreground text-xs">Port {site.port} · {site.fileCount} files · {formatBytes(site.bytes)}</p>
          </div>
          <Badge variant={site.state === "running" ? "secondary" : "outline"}>{site.state}</Badge>
        </li>
      ))}
    </ul>
  )
}
