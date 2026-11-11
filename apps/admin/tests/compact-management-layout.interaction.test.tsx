import * as React from "react"
import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { MemoryRouter } from "react-router-dom"

const sidebarState = vi.hoisted(() => ({ side: "left" as "left" | "right" }))

vi.mock("@/components/app-sidebar", () => ({
  AppSidebar: () => <nav aria-label="Sidebar">Navigation</nav>,
}))
vi.mock("@/components/site-header", () => ({
  SiteHeader: () => <header>Toolbar</header>,
}))
vi.mock("@/components/site-footer", () => ({
  SiteFooter: () => <footer>Footer</footer>,
}))
vi.mock("@/components/theme-customizer", () => ({
  ThemeCustomizer: () => null,
}))
vi.mock("@/components/ui/sidebar", () => ({
  SidebarProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarInset: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}))
vi.mock("@/hooks/use-sidebar-config", () => ({
  useSidebarConfig: () => ({
    config: { side: sidebarState.side, variant: "inset", collapsible: "offcanvas" },
    updateConfig: vi.fn(),
  }),
}))
vi.mock("@/hooks/use-theme", () => ({
  useTheme: () => ({ setTheme: vi.fn() }),
}))
vi.mock("@/hooks/use-theme-manager", () => ({
  useThemeManager: () => ({
    resetTheme: vi.fn(),
    applyRadius: vi.fn(),
    setBrandColorsValues: vi.fn(),
  }),
}))

import { BaseLayout } from "@/components/layouts/base-layout"

// Every owner-facing management page uses the compact shell, not a repeated
// marketing-style heading. Added management routes must join this regression.
const managementRoutes = [
  ["/dashboard", "Dashboard"],
  ["/observability", "Monitoring"],
  ["/host", "Host overview"],
  ["/shizuku", "Android & Shizuku"],
  ["/phone-settings", "Phone Settings"],
  ["/packages", "Packages & Software"],
  ["/files", "File Manager"],
  ["/services", "Services"],
  ["/terminal", "Terminal"],
  ["/backups", "Backups & Recovery"],
  ["/sites", "Hosted sites"],
  ["/projects", "Projects"],
  ["/deployments", "Deployments"],
  ["/agents", "Agents & API"],
  ["/runtime-logs", "Project logs"],
  ["/settings/network", "Network access"],
  ["/settings/appearance", "Appearance"],
  ["/owned-site", "Owned site"],
  ["/managed-projects", "Managed projects"],
] as const

afterEach(() => {
  cleanup()
  sidebarState.side = "left"
})

function show(path: string, title: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <BaseLayout title={title} description="Descriptive subtitle">
        <div data-testid="page-content">Working controls</div>
      </BaseLayout>
    </MemoryRouter>,
  )
}

describe("PocketHost global heading density", () => {
  it("removes all repeated management-page hero headers without losing accessible page names", () => {
    for (const [path, title] of managementRoutes) {
      const rendered = show(path, title)
      const h1 = rendered.container.querySelector("h1")
      expect(h1?.textContent, path).toBe(title)
      expect(h1?.parentElement?.classList.contains("sr-only"), path).toBe(true)
      expect(h1?.parentElement?.textContent, path).toContain("Descriptive subtitle")
      expect(rendered.container.querySelector(".text-2xl"), path).toBeNull()
      expect(rendered.queryByText("Footer"), path).toBeNull()
      expect(rendered.container.querySelector('[data-testid="page-content"]')?.textContent).toBe("Working controls")
      expect(Array.from(rendered.container.querySelectorAll("div")).some(element =>
        element.classList.contains("py-2") && element.classList.contains("md:py-3"),
      ), path).toBe(true)
      rendered.unmount()
    }
  })

  it("uses the same compact pattern when the sidebar moves to the right", () => {
    sidebarState.side = "right"
    const rendered = show("/shizuku", "Android & Shizuku")
    expect(rendered.container.querySelector("h1")?.parentElement?.classList.contains("sr-only")).toBe(true)
    expect(rendered.container.querySelector(".text-2xl")).toBeNull()
    expect(rendered.container.querySelector('[data-testid="page-content"]')).not.toBeNull()
  })

  it("automatically keeps newly added PocketHost routes compact", () => {
    const rendered = show("/future-pocket-host-screen", "New management module")
    const h1 = rendered.container.querySelector("h1")
    expect(h1?.parentElement?.classList.contains("sr-only")).toBe(true)
    expect(rendered.container.querySelector(".text-2xl")).toBeNull()
  })

  it("preserves visible upstream demo headings and their normal spacing", () => {
    const rendered = show("/examples/dashboard", "Dashboard example")
    const h1 = rendered.container.querySelector("h1")
    expect(h1?.textContent).toBe("Dashboard example")
    expect(h1?.classList.contains("text-2xl")).toBe(true)
    expect(rendered.getByText("Footer")).toBeTruthy()
    expect(h1?.parentElement?.parentElement?.textContent).toContain("Descriptive subtitle")
    expect(Array.from(rendered.container.querySelectorAll("div")).some(element =>
      element.classList.contains("py-4") && element.classList.contains("md:py-6"),
    )).toBe(true)
  })
})
