import * as React from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import LocalAgentPage from "@/app/local-agent/page"
import { localAgentLogSchema } from "@/lib/local-agent-logs-schema"

vi.mock("@/components/layouts/base-layout", () => ({
  BaseLayout: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}))
vi.mock("@/app/termux/control-plane-panel", () => ({
  ControlPlanePanel: () => <section>Control plane diagnostics</section>,
}))

const sample = {
  version: 1, mode: "read-only", observedAt: "2026-11-13T20:48:00.000Z",
  source: "private-runit-svlogd", state: "ok",
  events: [{ kind: "budget", message: "Task stopped by execution budget",
    timestamp: "2026-11-13T20:45:00.000Z" }],
  unclassifiedLines: 1, truncated: false,
  notice: "sanitized-events-only-no-lifecycle-authority",
}
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

describe("read-only Local Agent menu page", () => {
  it("renders safe event summaries and supports a GET-only refresh", async () => {
    const getter = vi.fn(async () => ({ ok: true, json: async () => sample }))
    vi.stubGlobal("fetch", getter)
    render(<LocalAgentPage />)
    expect(await screen.findByText(/Task stopped by execution budget/)).toBeTruthy()
    expect(screen.getByText(/Control plane diagnostics/)).toBeTruthy()
    expect(screen.queryByRole("button", { name: /restart|stop agent/i })).toBeNull()
    const user = userEvent.setup()
    await user.click(screen.getByRole("button", { name: "Refresh diagnostics and logs" }))
    await waitFor(() => expect(getter).toHaveBeenCalledTimes(2))
    expect(getter.mock.calls.every(call =>
      call[0] === "/api/v1/termux-admin?mode=local-agent-logs" &&
      call[1]?.method === "GET")).toBe(true)
  })
  it("polls sanitized events every 5s, and pause stops automatic reads", async () => {
    const getter = vi.fn(async () => ({ ok: true, json: async () => sample }))
    vi.stubGlobal("fetch", getter)
    render(<LocalAgentPage />)
    await screen.findByText(/Task stopped by execution budget/)
    expect(getter).toHaveBeenCalledTimes(1)
    vi.useFakeTimers()
    await act(async () => { await vi.advanceTimersByTimeAsync(5000) })
    expect(getter).toHaveBeenCalledTimes(2)
    fireEvent.click(screen.getByRole("button", { name: "Pause live" }))
    await act(async () => { await vi.advanceTimersByTimeAsync(10000) })
    const afterPause = getter.mock.calls.length
    await act(async () => { await vi.advanceTimersByTimeAsync(10000) })
    expect(getter).toHaveBeenCalledTimes(afterPause)
    expect(screen.getByText("Live paused")).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Resume live" }))
    const afterResume = getter.mock.calls.length
    await act(async () => { await vi.advanceTimersByTimeAsync(5000) })
    expect(getter.mock.calls.length).toBeGreaterThan(afterResume)
    expect(getter.mock.calls.every(call => call[1]?.method === "GET")).toBe(true)
  })
  it("rejects forged raw log fields or commands", () => {
    expect(() => localAgentLogSchema.parse({ ...sample, token: "secret" })).toThrow()
    expect(() => localAgentLogSchema.parse({
      ...sample, events: [{ ...sample.events[0], raw: "secret" }],
    })).toThrow()
    expect(() => localAgentLogSchema.parse({
      ...sample, events: [{ ...sample.events[0], message: "secret" }],
    })).toThrow()
  })
  it("fails safely when log endpoint is unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false })))
    render(<LocalAgentPage />)
    expect(await screen.findByRole("alert")).toBeTruthy()
    expect(screen.queryByText(/Task stopped by execution budget/)).toBeNull()
  })
})
