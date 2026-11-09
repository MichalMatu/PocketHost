import * as React from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { RemoteShellPanel } from "@/app/shizuku/remote-shell-panel"

afterEach(() => vi.unstubAllGlobals())

describe("phone-approved browser shell request", () => {
  it("requires pairing code and command before any network submission", async () => {
    const fetchMock = vi.fn(async (...args: unknown[]) => {
      void args
      return { ok: true, status: 202, json: async () => ({
        id: "a".repeat(32), state: "pending",
      }) }
    })
    vi.stubGlobal("fetch", fetchMock)
    render(<RemoteShellPanel />)
    const user = userEvent.setup()
    const send = screen.getByRole("button", { name: "Send for approval on Samsung" })
    expect((send as HTMLButtonElement).disabled).toBe(true)
    await user.type(screen.getByLabelText("Temporary pairing code"), "0123456789")
    await user.type(screen.getByLabelText("Android shell command"), "id")
    expect((send as HTMLButtonElement).disabled).toBe(false)
    await user.click(send)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe("/api/v1/shizuku/remote-shell/submit")
    expect(init.method).toBe("POST")
    expect(JSON.parse(init.body as string)).toEqual({ code: "0123456789", command: "id" })
    expect(screen.getByText(/Awaiting approval in Companion on Samsung/)).toBeTruthy()
    expect(screen.queryByText("Android result")).toBeNull()
  })

  it("shows refusal and does not claim a shell command executed", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false, status: 403, json: async () => ({ error: "not-armed-or-unpaired" }),
    }))
    vi.stubGlobal("fetch", fetchMock)
    render(<RemoteShellPanel />)
    const user = userEvent.setup()
    await user.type(screen.getByLabelText("Temporary pairing code"), "9999999999")
    await user.type(screen.getByLabelText("Android shell command"), "id")
    await user.click(screen.getByRole("button", { name: "Send for approval on Samsung" }))
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", "not-armed-or-unpaired")
    expect(screen.queryByText("Android result")).toBeNull()
  })
})
