import type { ReactNode } from "react"
import { RefreshCw } from "lucide-react"

import { BaseLayout } from "@/components/layouts/base-layout"
import { Button } from "@/components/ui/button"

// Preserve the existing 40px touch target on narrow screens, using the
// original template's default 32px action size at larger widths.
export const pageActionClass = "max-md:min-h-10"

export function PageRefresh({ onRefresh }: { onRefresh: () => void }) {
  return (
    <Button variant="outline" className={pageActionClass} onClick={onRefresh}>
      <RefreshCw aria-hidden="true" data-icon="inline-start" />
      Refresh
    </Button>
  )
}

export function StandardPageLayout({ title, description, actions, children }: {
  title: string
  description?: string
  actions?: ReactNode
  children: ReactNode
}) {
  return (
    <BaseLayout composition="standard">
      <header data-slot="page-heading" className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex flex-col gap-2">
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          {description && <p className="text-muted-foreground">{description}</p>}
        </div>
        {actions && <div data-slot="page-actions" className="flex flex-wrap items-center gap-2">{actions}</div>}
      </header>
      {children}
    </BaseLayout>
  )
}
