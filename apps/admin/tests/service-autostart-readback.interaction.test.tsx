import * as React from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"

vi.mock("@/components/layouts/base-layout", () => ({
  BaseLayout: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}))
vi.mock("@/app/termux/admin-actions", () => ({
  RunitServiceActions: () => null,
}))

import ServiceAutostartPage from "@/app/services/autostart-page"

afterEach(() => vi.unstubAllGlobals())

describe("Service Autostart read-only boot observation", () => {
  it("ignores an older response after a newer Refresh has succeeded", async () => {
    const replies: Array<(response: { ok: boolean; json: () => Promise<unknown> }) => void> = []
    const fetcher = vi.fn((url: string, options?: RequestInit) => {
      expect(options?.method ?? "GET").toBe("GET")
      // Agent and MQTT status are independent from boot observations.
      if (!url.includes("mode=service-boot"))
        return Promise.resolve({ ok: false, json: async () => ({}) })
      return new Promise<{ ok: boolean; json: () => Promise<unknown> }>(resolve => {
        replies.push(resolve)
      })
    })
    vi.stubGlobal("fetch", fetcher)
    render(<MemoryRouter><ServiceAutostartPage /></MemoryRouter>)

    await waitFor(() => expect(replies).toHaveLength(1))
    fireEvent.click(screen.getByRole("button", { name: "Refresh boot status" }))
    await waitFor(() => expect(replies).toHaveLength(2))
    const bootCalls = fetcher.mock.calls.filter(call =>
      String(call[0]).includes("mode=service-boot"))
    expect(bootCalls).toHaveLength(2)
    expect(bootCalls[0]?.[1]?.signal?.aborted).toBe(true)

    const observation = {
      androidPermission: "not-verified",
      rebootReadback: "not-verified",
      checkedAt: "2026-11-18T22:00:00.000Z",
    }
    await act(async () => {
      replies[1]({ ok: true, json: async () => ({
        ...observation, state: "no-scripts", scriptCount: 0, ownerExecutableCount: 0,
      }) })
    })
    expect(screen.getByText("No local Termux:Boot scripts detected.")).toBeTruthy()

    // Simulate a server/transport that still delivers the cancelled first request.
    await act(async () => {
      replies[0]({ ok: true, json: async () => ({
        ...observation, state: "scripts-present", scriptCount: 3, ownerExecutableCount: 2,
      }) })
    })
    expect(screen.getByText("No local Termux:Boot scripts detected.")).toBeTruthy()
    expect(screen.queryByText(/3 local boot script\(s\) detected/)).toBeNull()
    expect(fetcher.mock.calls.every(call => (call[1]?.method ?? "GET") === "GET")).toBe(true)
  })
})
