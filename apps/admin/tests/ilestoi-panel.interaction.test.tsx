import * as React from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { IleStoiDiagnosticPanel } from "@/app/termux/ilestoi-panel"
import { ileStoiDiagnosticSchema } from "@/lib/ilestoi-diagnostic-schema"

const sample = {
  version: 1, mode: "read-only", service: "wreckscanner",
  observedAt: "2026-11-13T17:00:00.000Z",
  runit: { state: "running", uptimeSeconds: 42, error: null },
  process: { pid: 43, startTicks: "555", name: "node", rssMiB: 2.5,
    memoryState: "ok", identity: "runit-consistent-not-owned" },
  health: { state: "measured", target: "127.0.0.1:8001",
    attribution: "http-route-not-process-attested",
    live: { state: "ok", statusCode: 200, error: null },
    ready: { state: "ok", statusCode: 200, error: null } },
  logs: { state: "ok", lines: ["HTTP failed; token=[redacted]"], error: null },
  notice: "external-protected-no-lifecycle-control",
}
afterEach(() => vi.unstubAllGlobals())
describe("IleStoi protected service panel", () => {
  it("shows read-only observed values without lifecycle controls", async () => {
    const fetcher = vi.fn(async () => ({ ok: true, json: async () => sample }))
    vi.stubGlobal("fetch", fetcher)
    render(<IleStoiDiagnosticPanel />)
    await screen.findByText("PID 43 · node")
    expect(screen.getByText("2.5 MiB")).toBeTruthy()
    expect(screen.getByText("42 seconds")).toBeTruthy()
    expect(screen.getByText(/Verified IleStoi routes/)).toBeTruthy()
    expect(screen.getByText(/Liveness: ok/)).toBeTruthy()
    expect(screen.getByText(/Readiness: ok/)).toBeTruthy()
    expect(screen.queryByRole("button", { name: "Stop" })).toBeNull()
    expect(fetcher.mock.calls[0]?.[0]).toBe("/api/v1/termux-admin?mode=ilestoi-diagnostics")
    expect(fetcher.mock.calls[0]?.[1]?.method).toBe("GET")
  })
  it("shows unavailable state when a host observation fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false })))
    render(<IleStoiDiagnosticPanel />)
    await screen.findByRole("alert")
    expect(screen.queryByText("PID 43 · node")).toBeNull()
  })
  it("rejects extra data fields and missing identity", () => {
    expect(() => ileStoiDiagnosticSchema.parse({ ...sample, secret: "never" })).toThrow()
    expect(() => ileStoiDiagnosticSchema.parse({ ...sample,
      process: { ...sample.process, identity: "owner" } })).toThrow()
  })
})
