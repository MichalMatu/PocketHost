import * as React from "react"
import { afterEach, expect, it, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router-dom"

vi.mock("@/components/layouts/base-layout", () => ({
  BaseLayout: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}))

import ServiceDetailPage from "@/app/services/service-detail-page"

afterEach(() => vi.unstubAllGlobals())

const services = [
  ["ilestoi", "ilestoi-diagnostics"],
  ["healthwatch", "healthwatch-diagnostics"],
  ["cloudflare", "cloudflare-diagnostics"],
  ["ssh", "ssh-diagnostics"],
  ["mqtt", "mqtt-diagnostics"],
] as const

it.each(services)("only requests the %s service diagnostics", async (service, mode) => {
  const fetchMock = vi.fn(async (_input: RequestInfo | URL, _options?: RequestInit) => ({
    ok: false, status: 503,
  }))
  vi.stubGlobal("fetch", fetchMock)
  render(<MemoryRouter initialEntries={["/services/" + service]}>
    <Routes><Route path="/services/:serviceId" element={<ServiceDetailPage />} /></Routes>
  </MemoryRouter>)
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
  expect(String(fetchMock.mock.calls[0]?.[0])).toBe("/api/v1/termux-admin?mode=" + mode)
  expect(screen.getAllByText("Protected · read-only").length).toBeGreaterThan(0)
  expect(screen.getByRole("link", { name: "All services" }).getAttribute("href")).toBe("/services")
  expect(fetchMock.mock.calls.every(call => (call[1]?.method ?? "GET") === "GET")).toBe(true)
})

it("unknown service slugs never trigger a host request", () => {
  const fetchMock = vi.fn()
  vi.stubGlobal("fetch", fetchMock)
  render(<MemoryRouter initialEntries={["/services/not-owned"]}>
    <Routes><Route path="/services/:serviceId" element={<ServiceDetailPage />} /></Routes>
  </MemoryRouter>)
  expect(screen.getByText(/Unknown service. No diagnostics were requested/)).toBeTruthy()
  expect(fetchMock).not.toHaveBeenCalled()
})
