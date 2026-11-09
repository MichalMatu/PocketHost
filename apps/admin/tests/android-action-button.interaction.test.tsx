import * as React from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { AndroidActionButton } from "@/app/shizuku/android-action-button"

afterEach(() => vi.unstubAllGlobals())

describe("direct Android actions from browser", () => {
  it("dispatches an exact selected action and shows actual Shizuku output", async () => {
    const fetcher = vi.fn(async () => ({
      ok: true, status: 200, json: async () => ({
        action: "launch", mode: "adb", success: true, output: "Events injected: 1", durationMs: 23,
      }),
    }))
    vi.stubGlobal("fetch", fetcher)
    const applied = vi.fn()
    render(<AndroidActionButton action="launch" target="com.example.app" onSuccess={applied}>Launch</AndroidActionButton>)
    await userEvent.setup().click(screen.getByRole("button", { name: "Launch" }))
    expect(await screen.findByText(/Events injected: 1/)).toBeTruthy()
    expect(applied).toHaveBeenCalledOnce()
    const [url, options] = fetcher.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe("/api/v1/shizuku/action/run")
    expect(options.method).toBe("POST")
    expect(JSON.parse(options.body as string)).toEqual({ action: "launch", target: "com.example.app", value: "" })
  })

  it("does not report success after Android refuses a permission mutation", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: false, status: 502, json: async () => ({
        error: "android-shell-refused", detail: "Permission denied by Android",
      }),
    })))
    const applied = vi.fn()
    render(<AndroidActionButton action="grant" target="com.example.app"
      value="android.permission.CAMERA" onSuccess={applied}>Grant</AndroidActionButton>)
    await userEvent.setup().click(screen.getByRole("button", { name: "Grant" }))
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", "Permission denied by Android")
    expect(applied).not.toHaveBeenCalled()
  })
})
