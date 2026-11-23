import * as React from "react"
import { render, screen } from "@testing-library/react"
import { createMemoryRouter, RouterProvider } from "react-router-dom"
import { expect, it } from "vitest"
import { RootFallback, RootLayout, RouteLoadError } from "@/components/router/root-layout"

it("shows the PocketHost loading fallback before a route is ready", () => {
  render(<RootFallback />)
  expect(screen.getByText("Loading page…")).toBeTruthy()
  expect(screen.queryByRole("alert")).toBeNull()
})

it("renders the selected page through the root route layout", async () => {
  const router = createMemoryRouter([{
    path: "/",
    element: <RootLayout />,
    errorElement: <RouteLoadError />,
    children: [{ index: true, element: <h1>Owned dashboard</h1> }],
  }], { initialEntries: ["/"] })
  render(<RouterProvider router={router} />)
  expect(await screen.findByRole("heading", { name: "Owned dashboard" })).toBeTruthy()
  expect(screen.queryByRole("alert")).toBeNull()
})

it("offers dashboard navigation when a lazy route fails to load", async () => {
  const router = createMemoryRouter([{
    path: "/",
    element: <RootLayout />,
    errorElement: <RouteLoadError />,
    children: [{
      index: true,
      loader: () => { throw new Error("Page chunk unavailable") },
      element: <h1>Unreachable page</h1>,
    }],
  }], { initialEntries: ["/"] })
  render(<RouterProvider router={router} />)
  expect((await screen.findByRole("alert")).textContent).toContain("Page could not be loaded")
  expect(screen.getByRole("button", { name: "Retry page" })).toBeTruthy()
  expect(screen.getByRole("link", { name: "Dashboard" }).getAttribute("href")).toBe("/dashboard")
  expect(screen.queryByRole("heading", { name: "Unreachable page" })).toBeNull()
})
