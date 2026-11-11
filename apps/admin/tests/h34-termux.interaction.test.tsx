import { afterEach, describe, expect, it, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { TermuxFileExplorer } from "@/app/termux/full-files"
import { TermuxTerminalPanel } from "@/app/termux/terminal-panel"
import { FullTermuxBackups } from "@/app/termux/system-backups"
import { AgentApiPanel } from "@/app/termux/agent-panel"

afterEach(() => vi.unstubAllGlobals())

describe("H3.4 full Termux administration", () => {
  it("browses real named roots and saves a text file with typed intent", async () => {
    const user = userEvent.setup()
    const calls = vi.fn(async (url: string, opts?: RequestInit) => {
      if (opts?.method === "POST")
        return { ok: true, json: async () => ({ changed: true }) }
      if (url.includes("mode=file-roots"))
        return { ok: true, json: async () => ({ roots: [
          { id: "home", available: true }, { id: "prefix", available: true },
          { id: "shared", available: false },
        ] }) }
      return { ok: true, json: async () => ({
        path: "", entries: [{ name: "note.md", kind: "file", bytes: 8 }], truncated: false,
      }) }
    })
    vi.stubGlobal("fetch", calls)
    vi.stubGlobal("confirm", vi.fn(() => true))
    render(<TermuxFileExplorer />)
    await screen.findByText(/note.md \(8 B\)/)
    await user.type(screen.getByLabelText("Termux file source"), "new.md")
    await user.click(screen.getByRole("button", { name: "New / Edit text file" }))
    await user.type(screen.getByLabelText("Termux text editor"), "Hello Termux")
    await user.click(screen.getByRole("button", { name: "Save text" }))
    await screen.findByText("save completed")
    const posts = calls.mock.calls.filter(call => call[1]?.method === "POST")
    expect(posts).toHaveLength(1)
    expect(JSON.parse(String(posts[0]![1]?.body))).toMatchObject({
      action: "full-file", name: "save", root: "home", path: "new.md", content: "Hello Termux",
    })
  })
  it("keeps the current directory when Refresh reloads file inventory", async () => {
    const user = userEvent.setup()
    const calls = vi.fn(async (url: string) => url.includes("file-roots")
      ? { ok: true, json: async () => ({ roots: [{ id: "home", available: true }] }) }
      : { ok: true, json: async () => ({
        path: "", entries: [{ name: "note.md", kind: "file", bytes: 8 }], truncated: false,
      }) })
    vi.stubGlobal("fetch", calls)
    const view = render(<TermuxFileExplorer />)
    await screen.findByText(/note.md \(8 B\)/)
    await user.click(screen.getByRole("button", { name: "Workspace" }))
    await waitFor(() => expect(calls.mock.calls.filter(call =>
      call[0].includes("Projects%2FPocketHost-H3-Workspace"))).toHaveLength(1))
    view.rerender(<TermuxFileExplorer refreshToken={1} />)
    await waitFor(() => expect(calls.mock.calls.filter(call =>
      call[0].includes("Projects%2FPocketHost-H3-Workspace"))).toHaveLength(2))
  })

  it("does not mistake a successful save followed by failed listing for a failed save", async () => {
    const user = userEvent.setup()
    let saved = false
    const calls = vi.fn(async (url: string, options?: RequestInit) => {
      if (options?.method === "POST") {
        saved = true
        return { ok: true, json: async () => ({ changed: true }) }
      }
      if (url.includes("file-roots")) return { ok: true, json: async () => ({ roots: [{ id: "home", available: true }] }) }
      if (saved) return { ok: false }
      return { ok: true, json: async () => ({
        path: "", entries: [{ name: "note.txt", kind: "file", bytes: 8 }], truncated: false,
      }) }
    })
    vi.stubGlobal("fetch", calls); vi.stubGlobal("confirm", vi.fn(() => true))
    render(<TermuxFileExplorer />)
    await screen.findByText(/note.txt \(8 B\)/)
    await user.type(screen.getByLabelText("Termux file source"), "new.txt")
    await user.click(screen.getByRole("button", { name: "New / Edit text file" }))
    await user.type(screen.getByLabelText("Termux text editor"), "test")
    await user.click(screen.getByRole("button", { name: "Save text" }))
    await screen.findByText("save completed")
    expect(screen.getByRole("alert").textContent).toContain("directory refresh failed")
    expect(calls.mock.calls.filter(call => call[1]?.method === "POST")).toHaveLength(1)
  })

  it("clears stale editor text when switching the file path", async () => {
    const user = userEvent.setup()
    const posts: Record<string, unknown>[] = []
    vi.stubGlobal("fetch", vi.fn(async (url: string, options?: RequestInit) => {
      if (options?.method === "POST") {
        const payload = JSON.parse(String(options.body)) as Record<string, unknown>
        posts.push(payload)
        return { ok: true, json: async () =>
          payload.name === "read" ? { content: "Previous file text" } : { changed: true } }
      }
      if (url.includes("mode=file-roots")) return { ok: true, json: async () => ({
        roots: [{ id: "home", available: true }, { id: "prefix", available: true }],
      }) }
      return { ok: true, json: async () => ({
        path: "", entries: [{ name: "old.txt", kind: "file", bytes: 18 }], truncated: false,
      }) }
    }))
    vi.stubGlobal("confirm", vi.fn(() => true))
    render(<TermuxFileExplorer />)
    await screen.findByText(/old.txt \(18 B\)/)
    await user.click(screen.getByRole("button", { name: "Edit" }))
    expect((screen.getByLabelText("Termux text editor") as HTMLTextAreaElement).value)
      .toBe("Previous file text")
    const source = screen.getByLabelText("Termux file source")
    await user.clear(source)
    await user.type(source, "new.txt")
    expect(screen.queryByLabelText("Termux text editor")).toBeNull()
    await user.click(screen.getByRole("button", { name: "New / Edit text file" }))
    expect((screen.getByLabelText("Termux text editor") as HTMLTextAreaElement).value)
      .toBe("")
    await user.type(screen.getByLabelText("Termux text editor"), "New file text")
    await user.click(screen.getByRole("button", { name: "Save text" }))
    expect(posts.find(item => item.name === "save")).toMatchObject({
      action: "full-file", root: "home", path: "new.txt", content: "New file text",
    })
  })
  it("starts one ttyd session only on click, no password and no autostart", async () => {
    const user = userEvent.setup()
    const calls = vi.fn(async (url: string, options?: RequestInit) => {
      expect(url).toContain("/api/v1/termux-admin")
      const started = options?.method === "POST"
      return { ok: true, json: async () => ({
        terminal: started ? { running: true, url: "/terminal/" } : { running: false, url: null },
      }) }
    })
    vi.stubGlobal("fetch", calls)
    vi.stubGlobal("confirm", vi.fn(() => true))
    render(<TermuxTerminalPanel />)
    await screen.findByText("Stopped")
    expect(screen.queryByTitle("PocketHost interactive Termux shell")).toBeNull()
    await user.click(screen.getByRole("button", { name: "Start terminal" }))
    await screen.findByText("Session active")
    const shell = screen.getByTitle("PocketHost interactive Termux shell") as HTMLIFrameElement
    expect(shell.getAttribute("src")).toBe("/terminal/")
    expect(calls.mock.calls.filter(call => call[1]?.method === "POST")).toHaveLength(1)
    expect(screen.queryByLabelText(/password/i)).toBeNull()
  })
  it("runs selected full-home encrypted backup through fixed Restic API", async () => {
    const user = userEvent.setup()
    let initialized = false
    const calls = vi.fn(async (url: string, options?: RequestInit) => {
      if (options?.method === "POST") {
        initialized = true
        return { ok: true, json: async () => ({ result: { exit: 0, output: "fixture" } }) }
      }
      if (url.includes("system-snapshots")) return { ok: true, json: async () => ({ snapshots: [] }) }
      return { ok: true, json: async () => ({
        restic: { initialized, repositoryPresent: initialized, keyPresent: initialized },
      }) }
    })
    vi.stubGlobal("fetch", calls)
    vi.stubGlobal("confirm", vi.fn(() => true))
    render(<FullTermuxBackups detected />)
    await screen.findByText("Not initialized")
    await user.click(screen.getByRole("button", { name: "Create full backup" }))
    await screen.findByText("Restic backup completed")
    const post = calls.mock.calls.find(call => call[1]?.method === "POST")!
    expect(JSON.parse(String(post[1]?.body))).toEqual({
      action: "restic-system", name: "backup", root: "home",
    })
  })
  it("exposes copyable typed Local Agent contract without requiring login", async () => {
    const calls = vi.fn(async (url: string) => ({
      ok: url.includes("agent-capabilities"), json: async () => ({
        version: 1, loginRequired: false, transport: "local-http",
        actions: ["package-preview", "full-file", "restic-system"],
        path: "/api/v1/termux-admin", headers: {},
      }),
    }))
    vi.stubGlobal("fetch", calls)
    render(<AgentApiPanel />)
    await screen.findByText(/Registered actions/)
    expect(screen.getByText(/Local Agent host-command client request/)).toBeTruthy()
    expect(screen.getByText(/local-http/)).toBeTruthy()
  })
})
