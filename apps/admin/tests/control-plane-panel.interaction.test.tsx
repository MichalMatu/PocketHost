import * as React from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { ControlPlanePanel } from "@/app/termux/control-plane-panel"
import { controlPlaneSchema } from "@/lib/control-plane-schema"

const sample = {
  version: 1, mode: "read-only", observedAt: "2026-11-13T20:00:00.000Z",
  localAgent: {
    runit: { state: "running", uptimeSeconds: 120, error: null },
    intake: "unverified", lastResult: "unverified",
  },
  pocketHost: {
    runit: { state: "running", uptimeSeconds: 120, error: null },
    watch: { state: "running", uptimeSeconds: 120, error: null },
    owner: { state: "verified", pid: 98, startTicks: "555",
      markerSha: "a".repeat(40), checkoutSha: "b".repeat(40),
      checkoutClean: true, revision: "mismatch", reason: null },
    updateReadiness: "hold-manual-review", restart: "blocked",
  },
  notice: "no-lifecycle-authority",
}
afterEach(() => vi.unstubAllGlobals())
describe("S4 Local Agent and PocketHost source panel", () => {
  it("shows source mismatch with no operation buttons", async () => {
    const fetcher = vi.fn(async () => ({ ok: true, json: async () => sample }))
    vi.stubGlobal("fetch", fetcher)
    render(<ControlPlanePanel />)
    expect(await screen.findByText("mismatch")).toBeTruthy()
    expect(screen.getByText(/Recorded startup SHA:/)).toBeTruthy()
    expect(screen.getByText(/manual review required/)).toBeTruthy()
    expect(screen.queryByRole("button", { name: /restart|start|stop/i })).toBeNull()
    expect(fetcher.mock.calls[0]?.[0]).toBe("/api/v1/termux-admin?mode=control-plane-diagnostics")
    expect(fetcher.mock.calls[0]?.[1]?.method).toBe("GET")
  })
  it("handles an unavailable API safely", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false })))
    render(<ControlPlanePanel />)
    expect(await screen.findByRole("alert")).toBeTruthy()
    expect(screen.queryByText(/PID 98/)).toBeNull()
  })
  it("rejects secret fields and invented agent health or restart grants", () => {
    expect(() => controlPlaneSchema.parse({ ...sample, token: "secret" })).toThrow()
    expect(() => controlPlaneSchema.parse({
      ...sample, localAgent: { ...sample.localAgent, intake: "healthy" },
    })).toThrow()
    expect(() => controlPlaneSchema.parse({
      ...sample, pocketHost: { ...sample.pocketHost, restart: "allowed" },
    })).toThrow()
  })
})
