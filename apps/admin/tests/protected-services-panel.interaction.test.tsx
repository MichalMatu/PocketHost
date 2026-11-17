import * as React from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { ProtectedServicePanels } from "@/app/termux/protected-services-panel"
import { protectedServiceSchema } from "@/lib/protected-service-schema"

const make = (service: string) => ({
  version: 1, mode: "read-only", service,
  observedAt: "2026-11-13T18:00:00.000Z",
  runit: { state: "running", uptimeSeconds: 200, error: null },
  process: { pid: 98, startTicks: "555", rssMiB: 4,
    identity: "runit-consistent-not-owned" },
  health: { state: "unverified", reason: "runit-is-not-application-health-proof" },
  config: { state: "ok", scope: "direct-file-not-effective-runtime",
    settings: service === "sshd" ? [{ name: "port", value: "8022" }] : [],
    truncated: false, error: null },
  logs: { state: "ok", events: [{ kind: "connection", timestamp: null }], error: null },
  notice: "external-protected-no-lifecycle-control",
})
afterEach(() => vi.unstubAllGlobals())
describe("SSH and Mosquitto diagnostic cards", () => {
  it("shows independent read-only results with no lifecycle controls", async () => {
    const fetcher = vi.fn(async (url: string) => ({
      ok: true,
      json: async () => make(
        url.includes("ssh-diagnostics") ? "sshd" : "mosquitto"),
    }))
    vi.stubGlobal("fetch", fetcher)
    render(<ProtectedServicePanels />)
    await screen.findByText("port: 8022")
    expect(screen.getAllByText(/PID 98/)).toHaveLength(2)
    expect(screen.queryByRole("button", { name: /restart|stop|start/i })).toBeNull()
    expect(fetcher.mock.calls).toHaveLength(2)
    expect(fetcher.mock.calls.every(call => call[1]?.method === "GET")).toBe(true)
  })
  it("isolates a missing service and rejects mismatched service payload", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => ({
      ok: true,
      json: async () => make(url.includes("mqtt-") ? "sshd" : "sshd"),
    })))
    render(<ProtectedServicePanels />)
    await screen.findByText(/Mosquitto \/ MQTT diagnostics unavailable/)
    expect(screen.getByText("port: 8022")).toBeTruthy()
    expect(screen.queryByText("token=secret")).toBeNull()
  })
  it("schema refuses raw config/log secrets and fictional health assertions", () => {
    expect(() => protectedServiceSchema.parse({ ...make("sshd"), credentials: "secret" })).toThrow()
    expect(() => protectedServiceSchema.parse({
      ...make("mosquitto"), health: { state: "healthy" },
    })).toThrow()
    expect(() => protectedServiceSchema.parse({
      ...make("sshd"), config: { ...make("sshd").config, raw: "password x" },
    })).toThrow()
  })
})
