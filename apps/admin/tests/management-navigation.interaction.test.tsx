import * as React from "react"
import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { expect, it, vi } from "vitest"
import { navGroups } from "@/config/navigation"
import { routes } from "@/config/routes"
import { CommandSearch } from "@/components/command-search"

it("keeps product search and sidebar synchronized with every active management route", async () => {
  const active = navGroups.flatMap(group => group.items)
  const paths = active.map(item => item.url)
  expect(new Set(paths).size).toBe(paths.length)
  expect(active).toHaveLength(17)
  expect(navGroups.some(group => group.label === "Examples")).toBe(false)
  for (const path of paths) {
    expect(path.startsWith("/")).toBe(true)
    expect(routes.some(route => route.path === path), path).toBe(true)
  }
  expect(routes.some(route => route.path === "/examples/dashboard")).toBe(true)
  const onOpenChange = vi.fn()
  render(<MemoryRouter><CommandSearch open onOpenChange={onOpenChange} /></MemoryRouter>)
  expect(await screen.findByText("File Manager")).toBeTruthy()
  expect(screen.getByText("Android & Shizuku")).toBeTruthy()
  expect(screen.getByText("Project logs")).toBeTruthy()
  expect(screen.queryByText("Dashboard 2")).toBeNull()
  expect(screen.queryByText("Sign In 1")).toBeNull()
})
