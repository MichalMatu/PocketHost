import * as React from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import LocalAgentPage from "@/app/local-agent/page"
import { formatAgentDuration } from "@/lib/local-agent-time"
import { localAgentLogSchema } from "@/lib/local-agent-logs-schema"

vi.mock("@/components/layouts/base-layout", () => ({
  BaseLayout: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}))
vi.mock("@/app/termux/control-plane-panel", () => ({
  ControlPlanePanel: () => <section>Advanced control plane diagnostics</section>,
}))

const controlPlane = {
  version: 1, mode: "read-only", observedAt: "2026-11-20T12:00:00.000Z",
  localAgent: {
    runit: { state: "running", uptimeSeconds: 589815, error: null },
    intake: "stop-absent", claims: 383, spooled: 383,
    unspooledClaims: 0, orphanSpools: 0, lastResult: "done",
    lastResultAt: "2026-11-20T11:55:00.000Z", publication: "not-checked",
  },
  pocketHost: {
    runit: { state: "running", uptimeSeconds: 100, error: null },
    watch: { state: "running", uptimeSeconds: 100, error: null },
    owner: { state: "unverified", pid: null, startTicks: null,
      markerSha: null, gatewaySha: null, markerAgreement: "unverified",
      checkoutSha: null, checkoutClean: null, revision: "unverified",
      revisionEvidence: { state: "unavailable", changedFiles: null, areas: null },
      reason: "unavailable",
    },
    updateReadiness: "hold-manual-review", restart: "blocked",
  },
  notice: "no-lifecycle-authority",
}
const logs = {
  version: 1, mode: "read-only", observedAt: "2026-11-20T12:00:00.000Z",
  source: "private-runit-svlogd", state: "ok",
  events: [{ kind: "budget", message: "Task stopped by execution budget",
    timestamp: "2026-11-20T11:59:00.000Z" }],
  unclassifiedLines: 79, truncated: true,
  notice: "sanitized-events-only-no-lifecycle-authority",
}
function mockFetch() {
  return vi.fn(async (url: string) => ({
    ok: true,
    json: async () => url.includes("mode=control-plane-diagnostics") ? controlPlane : logs,
  }))
}
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

describe("Local Agent read-only overview", () => {
  it("summarizes actual local data without pretending Git publication is verified", async () => {
    const fetcher = mockFetch()
    vi.stubGlobal("fetch", fetcher)
    render(<LocalAgentPage />)
    expect(await screen.findByText("Runit running")).toBeTruthy()
    expect(screen.getByText("383")).toBeTruthy()
    expect(screen.getByText("6 d 19 h 50 min 15 s")).toBeTruthy()
    expect(screen.getByText("agent-control")).toBeTruthy()
    expect(screen.getByText(/Not checked by panel/)).toBeTruthy()
    expect(screen.getByText(/Current task:/)).toBeTruthy()
    expect(screen.queryByRole("button", { name: /Stop agent|Start agent|Restart agent/i })).toBeNull()
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2))
    expect(fetcher.mock.calls.every(call => call[1]?.method === "GET")).toBe(true)
    expect(fetcher.mock.calls.every(call => !call[0].includes("token"))).toBe(true)
  })

  it("shows a sanitized console with filtering; no raw command or fake terminal", async () => {
    vi.stubGlobal("fetch", mockFetch())
    render(<LocalAgentPage />)
    fireEvent.click(screen.getByRole("tab", { name: "Live console" }))
    expect(await screen.findByText("Task stopped by execution budget")).toBeTruthy()
    expect(screen.getByText(/79 unrecognized lines/)).toBeTruthy()
    expect(screen.getByText(/not a shell terminal/)).toBeTruthy()
    fireEvent.change(screen.getByLabelText("Filter Agent events"), { target: { value: "transport" } })
    expect(screen.getByText("No classified events match this view.")).toBeTruthy()
    expect(screen.queryByText("Task stopped by execution budget")).toBeNull()
  })

  it("polls event summaries every five seconds, not service state; pause is browser-only", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] })
    const fetcher = mockFetch()
    vi.stubGlobal("fetch", fetcher)
    render(<LocalAgentPage />)
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2))
    await act(async () => { await vi.advanceTimersByTimeAsync(5000) })
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(3))
    expect(fetcher.mock.calls.filter(call =>
      call[0].includes("mode=control-plane-diagnostics"))).toHaveLength(1)
    fireEvent.click(screen.getByRole("button", { name: "Pause event updates" }))
    await act(async () => { await vi.advanceTimersByTimeAsync(10000) })
    const pausedAt = fetcher.mock.calls.length
    await act(async () => { await vi.advanceTimersByTimeAsync(10000) })
    expect(fetcher).toHaveBeenCalledTimes(pausedAt)
    expect(screen.getByText("Event updates paused")).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Resume event updates" }))
    await act(async () => { await vi.advanceTimersByTimeAsync(5000) })
    expect(fetcher.mock.calls.length).toBeGreaterThan(pausedAt)
    expect(fetcher.mock.calls.every(call => call[1]?.method === "GET")).toBe(true)
  })

  it("refreshes both read-only sources and hides advanced details until requested", async () => {
    const fetcher = mockFetch()
    vi.stubGlobal("fetch", fetcher)
    render(<LocalAgentPage />)
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2))
    const user = userEvent.setup()
    await user.click(screen.getByRole("button", { name: "Refresh" }))
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(4))
    await user.click(screen.getByRole("tab", { name: "Diagnostics" }))
    expect(screen.queryByText("Advanced control plane diagnostics")).toBeNull()
    await user.click(screen.getByRole("button", { name: "Show technical details" }))
    expect(screen.getByText("Advanced control plane diagnostics")).toBeTruthy()
  })

  it("does not infer healthy execution from missing timing history", async () => {
    vi.stubGlobal("fetch", mockFetch())
    render(<LocalAgentPage />)
    fireEvent.click(screen.getByRole("tab", { name: "Tasks & activity" }))
    expect(await screen.findByText(/Timing history is not available/)).toBeTruthy()
    expect(screen.queryByText(/No active duration alerts/)).toBeNull()
  })

  it("shows available aggregate timings and alerts without task identifiers", async () => {
    const withLatency = {
      ...logs,
      latency: {
        version: 1, source: "termux-agent-local-task-spool", mode: "event-driven",
        state: "ok", observedAt: "2026-11-20T12:00:00.000Z", sampleCount: 6,
        medianSeconds: 21, p95Seconds: 420, latestSeconds: 420,
        alerts: ["repeated-long-execution", "execution-timeout"],
        recent: [{ at: "2026-11-20T12:00:00.000Z", seconds: 420, status: "failed" }],
      },
    }
    const fetcher = vi.fn(async (url: string) => ({
      ok: true, json: async () => url.includes("mode=control-plane-diagnostics")
        ? controlPlane : withLatency,
    }))
    vi.stubGlobal("fetch", fetcher)
    render(<LocalAgentPage />)
    fireEvent.click(screen.getByRole("tab", { name: "Tasks & activity" }))
    expect(await screen.findByText(/Performance attention required/)).toBeTruthy()
    expect(screen.getAllByText("7 min").length).toBeGreaterThan(1)
    expect(screen.getByText(/Three of the last five/)).toBeTruthy()
    expect(screen.getByText(/exceeded its execution time budget/)).toBeTruthy()
    expect(JSON.stringify(withLatency)).not.toContain("secret-command")
  })

  it("handles errors with explicit unknown status and never suggests successful publication", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false })))
    render(<LocalAgentPage />)
    expect(await screen.findByRole("alert")).toBeTruthy()
    expect(screen.getByText("Not verified")).toBeTruthy()
    expect(screen.getByText("Not checked by panel")).toBeTruthy()
  })
})

describe("sanitized data contracts and duration formatting", () => {
  it("formats elapsed seconds without misrepresenting exact calendar months", () => {
    expect(formatAgentDuration(589815)).toBe("6 d 19 h 50 min 15 s")
    expect(formatAgentDuration(420)).toBe("7 min")
    expect(formatAgentDuration(null)).toBe("Not measured")
    expect(formatAgentDuration(31 * 86400)).toContain("≈")
  })
  it("rejects forged raw logs, secrets or commands", () => {
    expect(() => localAgentLogSchema.parse({ ...logs, token: "secret" })).toThrow()
    expect(() => localAgentLogSchema.parse({ ...logs,
      events: [{ ...logs.events[0], raw: "secret" }],
    })).toThrow()
    expect(() => localAgentLogSchema.parse({ ...logs,
      events: [{ ...logs.events[0], message: "secret" }],
    })).toThrow()
    expect(() => localAgentLogSchema.parse({ ...logs, latency: {
      version: 1, source: "termux-agent-local-task-spool", mode: "event-driven",
      state: "ok", observedAt: "2026-11-20T12:00:00.000Z", sampleCount: 1,
      medianSeconds: 12, p95Seconds: 12, latestSeconds: 12, alerts: ["restart-agent"],
      recent: [{ at: "2026-11-20T12:00:00.000Z", seconds: 12, status: "done" }],
    } })).toThrow()
  })
})
