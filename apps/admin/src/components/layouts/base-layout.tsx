"use client"

import * as React from "react"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { ThemeCustomizer } from "@/components/theme-customizer"
import { useTheme } from "@/hooks/use-theme"
import { useThemeManager } from "@/hooks/use-theme-manager"
import type { AppearanceTab } from "@/components/mode-toggle"
import { useSidebarConfig } from "@/hooks/use-sidebar-config"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"

interface BaseLayoutProps {
  children: React.ReactNode
  title?: string
  description?: string
}

/** All PocketHost routes share one compact, accessible management shell. */
export function BaseLayout({ children, title, description }: BaseLayoutProps) {
  const [themeCustomizerOpen, setThemeCustomizerOpen] = React.useState(false)
  const [customizerTab, setCustomizerTab] = React.useState<AppearanceTab>("theme")
  const [customizerVersion, setCustomizerVersion] = React.useState(0)
  const { config, updateConfig } = useSidebarConfig()
  const { setTheme } = useTheme()
  const { resetTheme, applyRadius, setBrandColorsValues } = useThemeManager()

  const openCustomizer = (tab: AppearanceTab) => {
    setCustomizerTab(tab)
    setThemeCustomizerOpen(true)
  }

  const resetAppearance = () => {
    setTheme("system")
    resetTheme()
    applyRadius("0.5rem")
    setBrandColorsValues({})
    updateConfig({
      variant: "inset",
      collapsible: "offcanvas",
      side: "left",
    })
    setCustomizerTab("theme")
    setThemeCustomizerOpen(false)
    setCustomizerVersion((previous) => previous + 1)
  }

  const sidebar = (
    <AppSidebar
      variant={config.variant}
      collapsible={config.collapsible}
      side={config.side}
    />
  )
  const content = (
    <SidebarInset>
      <SiteHeader
        onCustomize={openCustomizer}
        onResetAppearance={resetAppearance}
      />
      <div className="flex flex-1 flex-col">
        <div className="@container/main flex flex-1 flex-col gap-2">
          <div className="flex flex-col gap-3 py-2 md:gap-4 md:py-3">
            {title && (
              <div className="sr-only">
                <h1>{title}</h1>
                {description && <p>{description}</p>}
              </div>
            )}
            {children}
          </div>
        </div>
      </div>
    </SidebarInset>
  )

  return (
    <SidebarProvider
      style={{
        "--sidebar-width": "16rem",
        "--sidebar-width-icon": "3rem",
        "--header-height": "calc(var(--spacing) * 14)",
      } as React.CSSProperties}
      className={config.collapsible === "none" ? "sidebar-none-mode" : ""}
    >
      {config.side === "left" ? (
        <>{sidebar}{content}</>
      ) : (
        <>{content}{sidebar}</>
      )}
      <ThemeCustomizer
        key={customizerVersion}
        open={themeCustomizerOpen}
        onOpenChange={setThemeCustomizerOpen}
        activeTab={customizerTab}
        onTabChange={setCustomizerTab}
        onResetAppearance={resetAppearance}
      />
    </SidebarProvider>
  )
}
