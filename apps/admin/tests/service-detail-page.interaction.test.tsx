import * as React from "react"
import { afterEach, expect, it, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router-dom"

vi.mock("@/components/layouts/base-layout", () => ({
  BaseLayout: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}))

import ServiceDetailPage from "@/app/services/service-detail-page"
import { LocalAgentOperationsPanel } from "@/app/local-agent/operations-panel"
import { SSHConnectionsPanel } from "@/app/local-agent/ssh-connections-panel"

afterEach(() => vi.unstubAllGlobals())

const services = [
  ["cloudflare", "cloudflare-diagnostics"],
  ["ssh", "ssh-diagnostics"],
  ["mqtt", "mqtt-diagnostics"],
] as const

it.each(services)("only requests the %s service diagnostics", async (service, mode) => {
  const fetchMock = vi.fn(async (_input: RequestInfo | URL, _options?: RequestInit) => {
    void _input
    void _options
    return { ok: false, status: 503 }
  })
  vi.stubGlobal("fetch", fetchMock)
  render(<MemoryRouter initialEntries={["/services/" + service]}>
    <Routes><Route path="/services/:serviceId" element={<ServiceDetailPage />} /></Routes>
  </MemoryRouter>)
  await waitFor(() => expect(fetchMock.mock.calls.some(call =>
    String(call[0]).includes("/api/v1/termux-admin?mode=" + mode))).toBe(true))
  expect(screen.getAllByText("Protected · read-only").length).toBeGreaterThan(0)
  expect(screen.getByRole("link", { name: "All services" }).getAttribute("href")).toBe("/services")
  expect(screen.getByRole("link", { name: "All services" }).classList.contains("min-h-11")).toBe(true)
  expect(fetchMock.mock.calls.every(call => (call[1]?.method ?? "GET") === "GET")).toBe(true)
})

it.each(["external-service", "unknown-service", "not-owned"])("retired or unknown service %s never triggers a host request", service => {
  const fetchMock = vi.fn()
  vi.stubGlobal("fetch", fetchMock)
  render(<MemoryRouter initialEntries={["/services/" + service]}>
    <Routes><Route path="/services/:serviceId" element={<ServiceDetailPage />} /></Routes>
  </MemoryRouter>)
  expect(screen.getByText(/Unknown service. No diagnostics were requested/)).toBeTruthy()
  expect(fetchMock).not.toHaveBeenCalled()
})

it("uses standard SSH action sizes without issuing service or profile mutations", async () => {
  const operationData = {
    version: 1, observedAt: "2026-11-27T02:00:00.000Z",
    agent: { state: "running", pid: 100, uptimeSeconds: 60, sourceSha: null, supportsPause: true },
    ssh: { state: "running", pid: 101, uptimeSeconds: 60, listen: "open", address: "192.168.0.16", port: 8022 },
    intake: "active", current: [], recent: [], claims: 0, results: 0, remoteQueue: "not-checked",
  }
  const fetchMock = vi.fn(async (input: RequestInfo | URL, options?: RequestInit) => {
    expect(options?.method ?? "GET").toBe("GET")
    return { ok: true, json: async () => String(input).includes("mode=ssh-connections")
      ? { connections: [], activeSession: null, terminal: { running: false, url: null } }
      : operationData }
  })
  vi.stubGlobal("fetch", fetchMock)
  render(<MemoryRouter>
    <LocalAgentOperationsPanel refreshToken={0} scope="ssh" />
    <SSHConnectionsPanel />
  </MemoryRouter>)
  const restart = await screen.findByRole("button", { name: "Restart SSH" })
  expect(restart.classList.contains("h-8")).toBe(true)
  expect(screen.getByRole("button", { name: "Stop SSH" }).classList.contains("h-8")).toBe(true)
  expect(screen.getByRole("link", { name: "Open interactive terminal" }).classList.contains("h-8")).toBe(true)
  const add = screen.getByRole("button", { name: "Add connection" })
  expect(add.classList.contains("h-8")).toBe(true)
  expect((add as HTMLButtonElement).disabled).toBe(true)
  expect(fetchMock.mock.calls.every(call => (call[1]?.method ?? "GET") === "GET")).toBe(true)
})
