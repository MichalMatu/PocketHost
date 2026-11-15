import { Link } from "react-router-dom"
import { ChevronRight } from "lucide-react"
import { BaseLayout } from "@/components/layouts/base-layout"
import { navGroups } from "@/config/navigation"

export default function ServicesOverviewPage() {
  const items = navGroups.find(group => group.label === "Services")
    ?.items.filter(item => item.url !== "/services") ?? []

  return <BaseLayout title="Services" description="Choose the service area you want to manage">
    <div className="space-y-4 px-4 pb-8 lg:px-6">
      <p className="text-sm text-muted-foreground">
        Each area loads independently when opened. PocketHost only controls services
        it has explicitly enrolled; protected and observed services remain read-only.
      </p>
      <nav aria-label="Service management areas" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {items.map(({ title, url, icon: Icon }) => <Link key={url} to={url}
          className="flex min-h-16 items-center gap-3 rounded-lg border px-4 py-3 text-sm
            transition-colors hover:bg-accent hover:text-accent-foreground
            focus-visible:outline-2 focus-visible:outline-offset-2">
          <Icon className="size-5 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1 font-medium">{title}</span>
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
        </Link>)}
      </nav>
      <p className="text-xs text-muted-foreground">
        Service processes, boot settings and HTTP readiness are separate responsibilities.
        A running process does not prove application health.
      </p>
    </div>
  </BaseLayout>
}
