import * as React from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"

vi.mock("@/components/layouts/base-layout", () => ({
  BaseLayout: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}))

import NetworkAccessPage from "@/app/settings/network/page"

afterEach(() => vi.unstubAllGlobals())

const live = {
  version: 1, mode: "auto", enabled: true, bind: "192.168.0.16",
  interfaces: [{ name: "wlan0", address: "192.168.0.16" }],
  adminUrl: "http://192.168.0.16:18878/", siteUrl: null,
}
const stale = {
  ...live, mode: "manual", enabled: false, bind: null, adminUrl: null,
}

describe("Network Access manual refresh", () => {
  it("discards a superseded LAN snapshot even if its transport ignores abort", async () => {
    type Reply = { ok: boolean; json: () => Promise<unknown> }
    const replies: Array<(response: Reply) => void> = []
    const fetcher = vi.fn((url: string, options?: RequestInit) => {
      void url
      void options
      return new Promise<Reply>(resolve => { replies.push(resolve) })
    })
    vi.stubGlobal("fetch", fetcher)
    render(<NetworkAccessPage />)

    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1))
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }))
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2))
    expect(fetcher.mock.calls[0]?.[1]?.signal?.aborted).toBe(true)

    await act(async () => { replies[1]({ ok: true, json: async () => live }) })
    expect(screen.getByText("Home LAN enabled")).toBeTruthy()
    expect(screen.getByRole("button", { name: "Disable Home LAN" }).hasAttribute("disabled")).toBe(false)

    await act(async () => { replies[0]({ ok: true, json: async () => stale }) })
    expect(screen.getByText("Home LAN enabled")).toBeTruthy()
    expect(screen.queryByText("Managed gateway off")).toBeNull()
    expect(fetcher.mock.calls.every(call => (call[1]?.method ?? "GET") === "GET")).toBe(true)
  })
})
