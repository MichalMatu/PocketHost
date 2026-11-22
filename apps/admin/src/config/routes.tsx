import type { ComponentType } from "react"
import { Navigate, type RouteObject } from "react-router-dom"
import type { DiagnosticServiceId } from "@/config/service-workspaces"

/**
 * Every page is code-split. With the data router, a route's code is loaded
 * *before* the navigation commits: the current page stays on screen and the
 * root layout shows a progress bar until the next page is ready.
 */
function page(load: () => Promise<{ default: ComponentType }>) {
  return async () => {
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      const loaded = await Promise.race([
        load(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error("Page module loading timed out")), 20_000)
        }),
      ])
      return { Component: loaded.default }
    } finally {
      if (timer !== undefined) clearTimeout(timer)
    }
  }
}

/** Dedicated service URLs share one rendering shell, never duplicated data requests. */
function servicePage(service: DiagnosticServiceId) {
  return async () => {
    const { default: ServiceDetailPage } = await import("@/app/services/service-detail-page")
    return { Component: () => <ServiceDetailPage service={service} /> }
  }
}

export const routes: RouteObject[] = [
  // Use relative path "dashboard" instead of "/dashboard" for basename compatibility
  { path: "/", element: <Navigate to="/dashboard" replace /> },
  // PocketHost read-only status
  { path: "/host", lazy: page(() => import("@/app/host/page")) },
  { path: "/observability", lazy: page(() => import("@/app/observability/page")) },
  { path: "/shizuku", lazy: page(() => import("@/app/shizuku/page")) },
  { path: "/phone-settings", lazy: page(() => import("@/app/phone-settings/page")) },
  { path: "/termux", element: <Navigate to="/dashboard" replace /> },
  { path: "/system", element: <Navigate to="/dashboard" replace /> },
  { path: "/packages", lazy: page(() => import("@/app/termux/packages-page")) },
  { path: "/files", lazy: page(() => import("@/app/termux/files-page")) },
  { path: "/services", lazy: page(() => import("@/app/services/services-overview-page")) },
  { path: "/services/runit", lazy: page(() => import("@/app/services/runit-page")) },
  { path: "/services/autostart", lazy: page(() => import("@/app/services/autostart-page")) },
  { path: "/services/hosting", lazy: page(() => import("@/app/services/hosting-workloads-page")) },
  { path: "/services/health", lazy: page(() => import("@/app/services/health-checks-page")) },
  { path: "/services/cloudflare", lazy: servicePage("cloudflare") },
  { path: "/services/ssh", lazy: servicePage("ssh") },
  { path: "/services/mqtt", lazy: servicePage("mqtt") },
  { path: "/services/:serviceId", lazy: page(() => import("@/app/services/service-detail-page")) },
  { path: "/local-agent", lazy: page(() => import("@/app/local-agent/page")) },
  { path: "/backups", lazy: page(() => import("@/app/termux/backups-page")) },
  { path: "/terminal", lazy: page(() => import("@/app/termux/terminal-page")) },
  { path: "/agents", lazy: page(() => import("@/app/termux/agents-page")) },
  // PocketHost-owned test site; opt-in DEV-only actions (no external service controls)
  { path: "/owned-site", lazy: page(() => import("@/app/owned-site/page")) },
  { path: "/hosting", lazy: page(() => import("@/app/hosting/page")) },
  { path: "/sites", lazy: page(() => import("@/app/sites/page")) },
  { path: "/deployments", lazy: page(() => import("@/app/deployments/page")) },
  { path: "/projects", lazy: page(() => import("@/app/projects/page")) },
  { path: "/runtime-logs", lazy: page(() => import("@/app/runtime-logs/page")) },
  // PocketHost management dashboard and settings.
  { path: "/dashboard", lazy: page(() => import("@/app/termux/system-page")) },
  { path: "/settings/network", lazy: page(() => import("@/app/settings/network/page")) },
  { path: "/settings/platform", lazy: page(() => import("@/app/settings/platform/page")) },
  { path: "/settings/appearance", lazy: page(() => import("@/app/settings/appearance/page")) },
  // Catch-all route for 404
  { path: "*", lazy: page(() => import("@/app/errors/not-found/page")) },
]
