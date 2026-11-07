import { afterEach, describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { PackageActions, WorkspaceManager, SiteServiceActions, WorkspaceBackupActions } from "@/app/termux/admin-actions"

const site = {
  id: "site-" + "a".repeat(32), name: "Owned Test Site", state: "stopped",
  activeRelease: "r-" + "b".repeat(32), previousRelease: null, canRollback: false,
  port: 19080, fileCount: 1, bytes: 2, releases: 1, memoryBytes: null, uptimeSeconds: null,
  pid: null, startTicks: null, history: [], kind: "static-site", healthy: null,
} as const
afterEach(() => vi.unstubAllGlobals())

describe("H3 confirmed operations, no password prerequisite", () => {
  it("sends typed fixed package operation only after confirmation", async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn(async (_url: string, options?: RequestInit) => ({
      ok: true, json: async () => ({
        operation: "install", result: { exit: 0, output: "fixture install complete" },
      }),
    }))
    vi.stubGlobal("fetch", fetchMock)
    vi.stubGlobal("confirm", vi.fn(() => true))
    render(<PackageActions />)
    await user.type(screen.getByLabelText("Package name"), "git")
    await user.click(screen.getByRole("button", { name: "Install" }))
    await screen.findByText("fixture install complete")
    const sent = fetchMock.mock.calls[0]!
    expect(JSON.parse(String(sent[1]?.body))).toEqual({ action: "package", name: "install", path: "git" })
    expect((sent[1]?.headers as Record<string, string>)["X-PocketHost-Intent"]).toBe("termux-admin")
    expect(screen.queryByLabelText(/password/i)).toBeNull()
  })

  it("supports creating and saving a file in its separate workspace", async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn(async (url: string, options?: RequestInit) => ({
      ok: true, json: async () => options?.method === "POST" ?
        { changed: true } : { files: [] },
    }))
    vi.stubGlobal("fetch", fetchMock)
    vi.stubGlobal("confirm", vi.fn(() => true))
    render(<WorkspaceManager />)
    await screen.findByText("Workspace is empty.")
    await user.type(screen.getByLabelText("New workspace name"), "note.md")
    await user.click(screen.getByRole("button", { name: "New text file" }))
    await user.type(screen.getByLabelText("Workspace file editor"), "test entry")
    await user.click(screen.getByRole("button", { name: "Save file" }))
    await screen.findByText("save completed")
    const payloads = fetchMock.mock.calls.filter(call => call[1]?.method === "POST").map(call => JSON.parse(String(call[1]?.body)))
    expect(payloads).toContainEqual({ action: "file", name: "save", path: "note.md", content: "test entry" })
  })

  it("reuses existing H2 service controls with explicit verified-site identity", async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn(async (_url: string, _options?: RequestInit) => ({ ok: true, json: async () => ({}) }))
    const reload = vi.fn(async () => {})
    vi.stubGlobal("fetch", fetchMock)
    vi.stubGlobal("confirm", vi.fn(() => true))
    render(<SiteServiceActions sites={[site] as never} reload={reload} />)
    await user.click(screen.getByRole("button", { name: "Start" }))
    await screen.findByText(/start completed/)
    expect(fetchMock.mock.calls[0]![0]).toBe("/api/v1/sites/" + site.id + "/start")
    expect(fetchMock.mock.calls[0]![1]).toMatchObject({
      method: "POST", headers: { "X-PocketHost-Intent": "owned-sites" },
    })
    expect(reload).toHaveBeenCalledOnce()
  })

  it("creates and lists workspace backups without authentication prompts", async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn(async (url: string, options?: RequestInit) => ({
      ok: true, json: async () => options?.method === "POST"
        ? { snapshot: { name: "snapshot-20261107-aaaaaaaaaaaa", createdAt: "2026-11-07T13:00:00Z", files: 0 } }
        : { snapshots: [] },
    }))
    vi.stubGlobal("fetch", fetchMock)
    vi.stubGlobal("confirm", vi.fn(() => true))
    render(<WorkspaceBackupActions />)
    await user.click(screen.getByRole("button", { name: "Create snapshot" }))
    await screen.findByText(/snapshot create completed/)
    const posted = fetchMock.mock.calls.find(call => call[1]?.method === "POST")
    expect(JSON.parse(String(posted?.[1]?.body))).toEqual({ action: "snapshot", name: "create" })
  })
})
