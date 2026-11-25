import { afterEach, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { PublicAccessPanel } from "@/components/public-access-panel"

const id = "site-" + "a".repeat(32)
const url = "https://demo.trycloudflare.com"
afterEach(() => vi.unstubAllGlobals())

it("requires explicit publication intent, shows the assigned URL and supports unpublish", async () => {
  let state = { siteId: null as string | null, state: "stopped", url: null as string | null, reason: null }
  const fetcher = vi.fn(async (path: string, init: RequestInit) => {
    if (init.method === "POST") {
      expect(init.headers).toEqual({ "X-PocketHost-Intent": "public-static" })
      state = path.endsWith("/unpublish-public") ? { ...state, state: "stopped", url: null } :
        { ...state, siteId: id, state: "url-assigned", url }
    }
    return { ok: true, json: async () => ({ publication: state }) }
  })
  vi.stubGlobal("fetch", fetcher)
  vi.stubGlobal("confirm", vi.fn(() => true))
  render(<MemoryRouter><PublicAccessPanel siteId={id} running siteName="Demo" /></MemoryRouter>)
  const details = screen.getByText("Public access · Quick Tunnel").parentElement as HTMLDetailsElement
  details.open = true
  fireEvent.click(screen.getByRole("button", { name: "Refresh publication" }))
  await screen.findByText("Not published")
  expect(fetcher.mock.calls.every(call => call[1].method === "GET")).toBe(true)
  fireEvent.click(screen.getByRole("button", { name: "Publish to Internet" }))
  expect((await screen.findByRole("link", { name: url })).getAttribute("href")).toBe(url)
  expect(screen.getByText("URL assigned · public reachability not verified")).toBeTruthy()
  fireEvent.click(screen.getByRole("button", { name: "Unpublish" }))
  await waitFor(() => expect(screen.queryByRole("link", { name: url })).toBeNull())
})

it("does not show an untrusted URL or allow publishing after an invalid read", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({
    publication: { siteId: id, state: "url-assigned", url: "https://foreign.example", reason: null },
  }) })))
  render(<MemoryRouter><PublicAccessPanel siteId={id} running /></MemoryRouter>)
  const details = screen.getByText("Public access · Quick Tunnel").parentElement as HTMLDetailsElement
  details.open = true
  fireEvent.click(screen.getByRole("button", { name: "Refresh publication" }))
  await screen.findByRole("alert")
  expect((screen.getByRole("button", { name: "Publish to Internet" }) as HTMLButtonElement).disabled).toBe(true)
})
