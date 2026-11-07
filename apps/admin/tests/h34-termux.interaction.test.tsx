import { afterEach, describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
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
