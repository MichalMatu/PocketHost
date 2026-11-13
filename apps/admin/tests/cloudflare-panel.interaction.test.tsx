import * as React from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { CloudflareTunnelPanel } from "@/app/termux/cloudflare-panel"
import { cloudflareTunnelSchema } from "@/lib/cloudflare-tunnel-schema"

const sample = {
  version: 1, mode: "read-only", service: "cloudflared",
  observedAt: "2026-11-13T18:00:00.000Z",
  runit: { state: "running", uptimeSeconds: 90, error: null },
  process: { pid: 98, startTicks: "555", rssMiB: 5,
    identity: "runit-consistent-not-owned" },
  config: { state: "ok", tunnelDeclared: true, credentialsFileDeclared: true,
    ingress: [{ hostname: "site.example.com", backend: "http" }], truncated: false, error: null },
  connections: { state: "unverified", reason: "runit-is-not-tunnel-connection-proof",
    lastEvent: "registered" },
  logs: { state: "ok", events: [{ kind: "registered", timestamp: null }], error: null },
  notice: "external-protected-no-lifecycle-control",
}
afterEach(() => vi.unstubAllGlobals())
describe("Cloudflare Tunnel protected read-only panel", () => {
  it("shows real observed state and sanitized route without controls", async () => {
    const fetcher = vi.fn(async () => ({ ok: true, json: async () => sample }))
    vi.stubGlobal("fetch", fetcher)
    render(<CloudflareTunnelPanel />)
    await screen.findByText("site.example.com")
    expect(screen.getByText(/PID 98/)).toBeTruthy()
    expect(screen.getByText(/Unverified · last log event: registered/)).toBeTruthy()
    expect(screen.queryByRole("button", { name: /restart/i })).toBeNull()
    expect(fetcher.mock.calls[0]?.[0]).toBe("/api/v1/termux-admin?mode=cloudflare-diagnostics")
    expect(fetcher.mock.calls[0]?.[1]?.method).toBe("GET")
  })
  it("makes unavailable observations explicit", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false })))
    render(<CloudflareTunnelPanel />)
    await screen.findByRole("alert")
    expect(screen.queryByText("site.example.com")).toBeNull()
  })
  it("rejects secret fields and fictional connected assertions", () => {
    expect(() => cloudflareTunnelSchema.parse({ ...sample, token: "secret" })).toThrow()
    expect(() => cloudflareTunnelSchema.parse({ ...sample,
      connections: { ...sample.connections, state: "connected" } })).toThrow()
  })
})
