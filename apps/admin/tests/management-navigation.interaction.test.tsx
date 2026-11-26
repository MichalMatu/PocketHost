import * as React from "react"
import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { expect, it, vi } from "vitest"
import { navGroups } from "@/config/navigation"
import { routes } from "@/config/routes"
import { CommandSearch } from "@/components/command-search"

it("keeps product search and sidebar synchronized with every active management route", async () => {
  const active = navGroups.flatMap(group => group.items)
  const allRoutes = routes.flatMap(route => [route, ...(route.children ?? [])])
  const paths = active.map(item => item.url)
  expect(new Set(paths).size).toBe(paths.length)
  // Local Agent is a dedicated menu item; guard uniqueness and route coverage
  // instead of a brittle fixed count when legitimate product pages are added.
  expect(active.length).toBeGreaterThanOrEqual(18)
  expect(active.filter(item => item.url === "/local-agent")).toHaveLength(1)
  expect(active.filter(item => item.url === "/services")).toHaveLength(1)
  expect(navGroups.some(group => /examples|framework/i.test(group.label))).toBe(false)
  for (const path of paths) {
    expect(path.startsWith("/")).toBe(true)
    expect(allRoutes.some(route => route.path === path), path).toBe(true)
  }
  for (const retired of [
    "/examples/dashboard", "/dashboard-2", "/landing", "/mail", "/tasks", "/chat",
    "/calendar", "/users", "/faqs", "/pricing", "/auth/sign-in", "/auth/sign-up",
    "/settings/user", "/settings/account", "/settings/billing",
    "/settings/notifications", "/settings/connections", "/errors/unauthorized",
    "/errors/forbidden", "/errors/under-maintenance",
  ]) {
    expect(allRoutes.some(route => route.path === retired), retired).toBe(false)
  }
  expect(allRoutes.some(route => route.path === "*")).toBe(true)
  const onOpenChange = vi.fn()
  render(<MemoryRouter><CommandSearch open onOpenChange={onOpenChange} /></MemoryRouter>)
  expect(await screen.findByText("File Manager")).toBeTruthy()
  expect(screen.getByText("Android & Shizuku")).toBeTruthy()
  expect(screen.getByText("Project logs")).toBeTruthy()
  expect(screen.getByText("Add website")).toBeTruthy()
  expect(screen.getByText("Add application")).toBeTruthy()
  expect(allRoutes.some(route => route.path === "/projects/:id")).toBe(true)
  expect(allRoutes.some(route => route.path === "/sites/new")).toBe(true)
  expect(allRoutes.some(route => route.path === "/sites/:id")).toBe(true)
  expect(screen.queryByText("Dashboard 2")).toBeNull()
  expect(screen.queryByText("Sign In 1")).toBeNull()
})
