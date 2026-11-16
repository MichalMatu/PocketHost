import { afterEach, describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import HostingPage from "@/app/hosting/page"

afterEach(() => vi.unstubAllGlobals())

describe("Hosting selection", () => {
  it("distinguishes enabled static hosting from disabled Node hosting", async () => {
    const requests = vi.fn(async (url: string) => ({
      ok: url === "/api/v1/sites",
      status: url === "/api/v1/sites" ? 200 : 404,
      json: async () => ({ sites: [] }),
    }))
    vi.stubGlobal("fetch", requests)
    render(<MemoryRouter><HostingPage /></MemoryRouter>)
    expect(await screen.findByText("Static hosting: Enabled · 0 hosted")).toBeTruthy()
    expect(await screen.findByText("Node hosting: Not enabled on this panel")).toBeTruthy()
    expect(screen.getByRole("link", { name: "Manage static websites" }).getAttribute("href"))
      .toBe("/sites")
    expect(screen.getByRole("link", { name: "Inspect Node.js projects" }).getAttribute("href"))
      .toBe("/projects")
    expect(requests.mock.calls.every(call => call[1]?.method !== "POST")).toBe(true)
  })

  it("does not claim availability when an inventory cannot be trusted", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true, status: 200,
      json: async () => ({ sites: [{ id: "foreign", kind: "static-site" }] }),
    })))
    render(<MemoryRouter><HostingPage /></MemoryRouter>)
    expect(await screen.findByText("Static hosting: Status unavailable")).toBeTruthy()
  })
})
