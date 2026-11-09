import * as React from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { RemoteShellPanel } from "@/app/shizuku/remote-shell-panel"

afterEach(() => vi.unstubAllGlobals())

describe("direct Shizuku shell from private-LAN browser", () => {
  it("executes the exact typed command on Run without pairing or phone approval", async () => {
    const fetchMock = vi.fn()
    fetchMock.mockResolvedValue({
      ok: true, status: 200, json: async () => ({
        action: "shell", success: true, mode: "adb", output: "uid=2000(shell)",
      }),
    })
    vi.stubGlobal("fetch", fetchMock)
    render(<RemoteShellPanel />)
    const user = userEvent.setup()
    const run = screen.getByRole("button", { name: "Run on Samsung" })
    expect((run as HTMLButtonElement).disabled).toBe(true)
    expect(screen.queryByLabelText("Temporary pairing code")).toBeNull()
    await user.type(screen.getByLabelText("Android shell command"), "id")
    await user.click(run)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe("/api/v1/shizuku/remote-shell/run")
    expect(init.method).toBe("POST")
    expect(JSON.parse(init.body as string)).toEqual({ command: "id" })
    expect((await screen.findAllByText("uid=2000(shell)")).length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText(/Last execution: ADB/)).toBeTruthy()
  })

  it("shows native refusals without pretending shell execution succeeded", async () => {
    const fetchMock = vi.fn()
    fetchMock.mockResolvedValue({
      ok: false, status: 502, json: async () => ({
        error: "android-shell-refused", detail: "Android refused operation",
      }),
    })
    vi.stubGlobal("fetch", fetchMock)
    render(<RemoteShellPanel />)
    const user = userEvent.setup()
    await user.type(screen.getByLabelText("Android shell command"), "id")
    await user.click(screen.getByRole("button", { name: "Run on Samsung" }))
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", "Android refused operation")
    expect(screen.queryByText("Android output")).toBeNull()
  })
})
