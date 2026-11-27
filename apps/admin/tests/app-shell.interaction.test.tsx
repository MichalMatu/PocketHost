import { render, screen } from "@testing-library/react"
import { expect, it, vi } from "vitest"

vi.mock("@/config/routes", () => ({
  routes: [{ path: "*", element: <h1>App shell fixture</h1> }],
}))
vi.mock("@/utils/analytics", () => ({ initGTM: vi.fn() }))

import App from "../src/App"

it("uses the shared font utility without an inline font override", async () => {
  const { container } = render(<App />)
  const heading = await screen.findByRole("heading", {
    name: "App shell fixture",
  })
  const shell = container.firstElementChild as HTMLElement
  expect(shell.contains(heading)).toBe(true)
  expect(shell.classList.contains("font-sans")).toBe(true)
  expect(shell.classList.contains("antialiased")).toBe(true)
  expect(shell.style.fontFamily).toBe("")
})
