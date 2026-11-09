import * as React from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

vi.mock("@/components/layouts/base-layout", () => ({
  BaseLayout: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}))

import ManagedProjectsPage from "@/app/managed-projects/page"

const time = "2026-11-09T12:00:00.000Z"
const legacyProject = {
  version: 1, id: "photomap-test", label: "PhotoMap TEST",
  ownership: "none", importState: "absent", runtimeState: "disabled",
  release: null, port: 8010, tools: [], lockfiles: [],
  data: null, dependencies: null,
  capabilities: { startStop: false, packages: false, rollback: false },
}

function mount(eventResult: unknown) {
  const mock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const endpoint = String(input)
    if (endpoint === "/api/v1/managed-photomap")
      return { ok: true, json: async () => ({ project: legacyProject }) }
    if (endpoint === "/api/v1/owned-site/project")
      return { ok: false, status: 404, json: async () => ({ error: "disabled" }) }
    if (endpoint === "/api/v1/managed-photomap/events") {
      expect(init?.method).toBe("GET")
      return { ok: true, json: async () => eventResult }
    }
    return { ok: false, status: 404, json: async () => ({}) }
  })
  vi.stubGlobal("fetch", mock)
  render(<ManagedProjectsPage />)
  return mock
}

afterEach(() => vi.unstubAllGlobals())

describe("M0 legacy PhotoMap diagnostics are separate from system monitoring", () => {
  it("reads only sanitized scoped event codes when explicitly requested", async () => {
    const user = userEvent.setup()
    const calls = mount({
      state: "ok",
      events: [{ timestamp: time, instanceId: "photomap-test", code: "manual-stop-completed" }],
    })
    await user.click(await screen.findByRole("button", { name: "Inspect events" }))
    await screen.findByText("manual-stop-completed")
    expect(calls.mock.calls.some(call => String(call[0]) === "/api/v1/managed-photomap/events")).toBe(true)
    expect(calls.mock.calls.some(call => String(call[0]) === "/api/v1/observability")).toBe(false)
    expect(calls.mock.calls.every(call => (call[1]?.method ?? "GET") === "GET")).toBe(true)
    expect(screen.queryByRole("button", { name: /Start|Stop|Restart/ })).toBeNull()
  })

  it("rejects forged events instead of displaying raw legacy log content", async () => {
    const user = userEvent.setup()
    mount({
      state: "ok",
      events: [{
        timestamp: time, instanceId: "foreign-project",
        code: "secret=LEAK", raw: "DO_NOT_LEAK",
      }],
    })
    await user.click(await screen.findByRole("button", { name: "Inspect events" }))
    await screen.findByRole("alert")
    expect(screen.queryByText("DO_NOT_LEAK")).toBeNull()
    expect(screen.queryByText("secret=LEAK")).toBeNull()
  })
})
