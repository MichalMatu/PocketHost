"use client"

import * as React from "react"
import { RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { CommandSearch, SearchTrigger } from "@/components/command-search"
import { ModeToggle, type AppearanceTab } from "@/components/mode-toggle"

interface SiteHeaderProps {
  onCustomize: (tab: AppearanceTab) => void
  onResetAppearance: () => void
  onRefresh?: () => void
  refreshDisabled?: boolean
}

export function SiteHeader({
  onCustomize,
  onResetAppearance,
  onRefresh,
  refreshDisabled,
}: SiteHeaderProps) {
  const [searchOpen, setSearchOpen] = React.useState(false)

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setSearchOpen((open) => !open)
      }
    }

    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [])

  return (
    <>
      <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
        <div className="flex w-full items-center gap-1 px-4 py-1.5 lg:gap-2 lg:px-6">
          <SidebarTrigger className="-ml-1 size-10" />
          <Separator
            orientation="vertical"
            className="mx-2 data-vertical:self-center data-vertical:h-4"
          />
          <div className="min-w-0 flex-1 max-w-sm">
            <SearchTrigger onClick={() => setSearchOpen(true)} />
          </div>
          <div className="ml-auto flex items-center gap-2">
            {onRefresh && (
              <Button variant="outline" size="icon" className="min-h-10 min-w-10"
                aria-label="Refresh" title="Refresh" disabled={refreshDisabled} onClick={onRefresh}>
                <RefreshCw aria-hidden="true" />
              </Button>
            )}
            <ModeToggle
              onCustomize={onCustomize}
              onResetAppearance={onResetAppearance}
            />
          </div>
        </div>
      </header>
      <CommandSearch open={searchOpen} onOpenChange={setSearchOpen} />
    </>
  )
}
