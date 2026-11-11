import { afterEach, describe, expect, it, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { TermuxFileExplorer } from "@/app/termux/full-files"
import { TermuxTerminalPanel } from "@/app/termux/terminal-panel"
import { FullTermuxBackups } from "@/app/termux/system-backups"
import { AgentApiPanel } from "@/app/termux/agent-panel"

afterEach(() => vi.unstubAllGlobals())

describe("Termux filesystem and administration", () => {
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
    const calls = vi.fn(async (url: string) => {
      if (url.includes("mode=file-roots"))
        return { ok: true, json: async () => ({ roots: [{ id: "home", available: true }] }) }
      const params = new URL(url, "http://localhost").searchParams
      return { ok: true, json: async () => ({
        path: params.get("path") ?? "",
        entries: params.get("root") === "home" && params.get("path") === ""
          ? [{ name: "Projects", kind: "directory", bytes: 0 }]
          : params.get("path") === "Projects"
            ? [{ name: "source.md", kind: "file", bytes: 8 }] : [],
        truncated: false,
      }) }
    })
    vi.stubGlobal("fetch", calls)
    const view = render(<TermuxFileExplorer />)
    await user.click(await screen.findByRole("button", { name: "Projects" }))
    expect(await screen.findByRole("button", { name: "Open file source.md" })).toBeTruthy()
    const requestsAtProject = () => calls.mock.calls.filter(call =>
      new URL(call[0], "http://localhost").searchParams.get("path") === "Projects").length
    const before = requestsAtProject()
    view.rerender(<TermuxFileExplorer refreshToken={1} />)
    await waitFor(() => expect(requestsAtProject()).toBeGreaterThan(before))
    expect(screen.getByRole("button", { name: "Open file source.md" })).toBeTruthy()
  })

  it("shows readable locations and hides shortcuts absent or inaccessible on device", async () => {
    const user = userEvent.setup()
    const calls = vi.fn(async (url: string) => {
      if (url.includes("mode=file-roots"))
        return { ok: true, json: async () => ({ roots: [
          { id: "home", available: true },
          { id: "prefix", available: true },
          { id: "shared", available: true },
        ] }) }
      const params = new URL(url, "http://localhost").searchParams
      const root = params.get("root")
      const path = params.get("path")
      if (root === "shared" && path === "Download") return { ok: false }
      const entries = path === "" && root === "home"
        ? [{ name: "Projects", kind: "directory", bytes: 0 }]
        : path === "" && root === "shared"
          ? [{ name: "Download", kind: "directory", bytes: 0 },
            { name: "Documents", kind: "directory", bytes: 0 }] : []
      return { ok: true, json: async () => ({ path, entries, truncated: false }) }
    })
    vi.stubGlobal("fetch", calls)
    render(<TermuxFileExplorer />)
    const select = screen.getByRole("combobox", { name: "Location" }) as HTMLSelectElement
    expect(Array.from(select.options).map(option => option.textContent)).toEqual([
      "Termux Home", "Termux System", "Phone Storage",
    ])
    expect(screen.queryByRole("button", { name: "Workspace" })).toBeNull()
    expect(await screen.findByRole("button", { name: "Projects" })).toBeTruthy()
    expect(await screen.findByRole("button", { name: "Documents" })).toBeTruthy()
    expect(screen.queryByRole("button", { name: "Downloads" })).toBeNull()
    await user.click(screen.getByRole("button", { name: "Documents" }))
    await waitFor(() => expect(calls.mock.calls.some(call =>
      new URL(call[0], "http://localhost").searchParams.get("path") === "Documents" &&
      new URL(call[0], "http://localhost").searchParams.get("root") === "shared")).toBe(true))
    expect(select.value).toBe("shared")
    expect(screen.getByRole("button", { name: "Phone Storage" })).toBeTruthy()
  })

  it("does not manufacture shortcuts for files, links, or missing roots", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.includes("mode=file-roots"))
        return { ok: true, json: async () => ({ roots: [
          { id: "home", available: true }, { id: "shared", available: false },
        ] }) }
      const params = new URL(url, "http://localhost").searchParams
      if (params.get("root") === "shared") return { ok: false }
      return { ok: true, json: async () => ({
        path: "", entries: [{ name: "Projects", kind: "link", bytes: 0 }],
        truncated: false,
      }) }
    }))
    render(<TermuxFileExplorer />)
    await screen.findByText(/Projects \(link\)/)
    await waitFor(() => expect(screen.queryByRole("navigation", { name: "Quick locations" })).toBeNull())
    expect(screen.queryByRole("button", { name: "Projects" })).toBeNull()
    expect(screen.queryByRole("button", { name: "Downloads" })).toBeNull()
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
    await user.click(screen.getByRole("button", { name: "Open file old.txt" }))
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
  it("opens folders by row click and navigates with breadcrumbs", async () => {
    const user = userEvent.setup()
    const calls = vi.fn(async (url: string) => url.includes("mode=file-roots")
      ? { ok: true, json: async () => ({ roots: [{ id: "home", available: true }] }) }
      : { ok: true, json: async () => ({
        path: "", entries: url.includes("path=docs")
          ? [{ name: "readme.md", kind: "file", bytes: 5 }]
          : [{ name: "docs", kind: "directory", bytes: 0 }],
        truncated: false,
      }) })
    vi.stubGlobal("fetch", calls)
    render(<TermuxFileExplorer />)
    await user.click(await screen.findByRole("button", { name: "Open folder docs" }))
    expect(await screen.findByRole("button", { name: "Open file readme.md" })).toBeTruthy()
    await user.click(screen.getByRole("button", { name: "home" }))
    expect(await screen.findByRole("button", { name: "Open folder docs" })).toBeTruthy()
    expect(screen.queryByRole("button", { name: "Open" })).toBeNull()
  })

  it("stages copy through the file menu and uses the destination path unchanged", async () => {
    const user = userEvent.setup()
    const posts: Record<string, unknown>[] = []
    vi.stubGlobal("fetch", vi.fn(async (url: string, options?: RequestInit) => {
      if (options?.method === "POST") {
        posts.push(JSON.parse(String(options.body)) as Record<string, unknown>)
        return { ok: true, json: async () => ({ changed: true }) }
      }
      if (url.includes("mode=file-roots"))
        return { ok: true, json: async () => ({ roots: [{ id: "home", available: true }] }) }
      return { ok: true, json: async () => ({
        path: "", entries: [{ name: "memo.txt", kind: "file", bytes: 3 }], truncated: false,
      }) }
    }))
    vi.stubGlobal("confirm", vi.fn(() => true))
    render(<TermuxFileExplorer />)
    await user.click(await screen.findByRole("button", { name: "Actions for memo.txt" }))
    await user.click(await screen.findByRole("menuitem", { name: "Copy to…" }))
    expect(posts).toHaveLength(0)
    await user.type(screen.getByLabelText("Termux destination"), "archive/memo.txt")
    await user.click(screen.getByRole("button", { name: "Copy" }))
    await screen.findByText("copy completed")
    expect(posts).toHaveLength(1)
    expect(posts[0]).toMatchObject({
      action: "full-file", name: "copy", root: "home",
      path: "memo.txt", destination: "archive/memo.txt",
    })
  })

  it("requires two confirmations for folder-tree deletion and never opens links", async () => {
    const user = userEvent.setup()
    const posts = vi.fn()
    vi.stubGlobal("confirm", vi.fn().mockReturnValueOnce(true).mockReturnValueOnce(false))
    vi.stubGlobal("fetch", vi.fn(async (url: string, options?: RequestInit) => {
      if (options?.method === "POST") posts(options)
      if (url.includes("mode=file-roots"))
        return { ok: true, json: async () => ({ roots: [{ id: "home", available: true }] }) }
      return { ok: true, json: async () => ({
        path: "", entries: [
          { name: "docs", kind: "directory", bytes: 0 },
          { name: "unsafe-link", kind: "link", bytes: 0 },
        ], truncated: false,
      }) }
    }))
    render(<TermuxFileExplorer />)
    expect(await screen.findByRole("button", { name: "Open folder docs" })).toBeTruthy()
    expect(screen.queryByRole("button", { name: "Open file unsafe-link" })).toBeNull()
    await user.click(screen.getByRole("button", { name: "Actions for docs" }))
    await user.click(await screen.findByRole("menuitem", { name: "Delete folder tree" }))
    expect(window.confirm).toHaveBeenCalledTimes(2)
    expect(posts).not.toHaveBeenCalled()
  })

  it("starts a ttyd session only on click and renders one automatically visible shell", async () => {
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
    render(<TermuxTerminalPanel detected />)
    await screen.findByText("Stopped")
    expect(screen.queryByTitle("PocketHost interactive Termux shell")).toBeNull()
    await user.click(screen.getByRole("button", { name: "Start terminal" }))
    await screen.findByText("Terminal running")
    const shell = screen.getByTitle("PocketHost interactive Termux shell") as HTMLIFrameElement
    expect(shell.getAttribute("src")).toBe("/terminal/")
    expect(calls.mock.calls.filter(call => call[1]?.method === "POST")).toHaveLength(1)
    expect(screen.queryByRole("button", { name: /Show terminal|Hide terminal/ })).toBeNull()
    expect(screen.queryByRole("button", { name: "Start terminal" })).toBeNull()
    expect(screen.getByRole("button", { name: "Stop terminal" })).toBeTruthy()
    expect(screen.queryByLabelText(/password/i)).toBeNull()
  })

  it("restores an already-running terminal on mount without starting another shell", async () => {
    const user = userEvent.setup()
    const calls = vi.fn(async (_url: string, options?: RequestInit) => {
      if (options?.method === "POST") return {
        ok: true, json: async () => ({ terminal: { running: false, url: null } }),
      }
      return { ok: true, json: async () => ({ terminal: { running: true, url: "/terminal/" } }) }
    })
    vi.stubGlobal("fetch", calls)
    vi.stubGlobal("confirm", vi.fn(() => true))
    render(<TermuxTerminalPanel detected={false} />)
    expect(await screen.findByTitle("PocketHost interactive Termux shell")).toBeTruthy()
    expect(screen.getByText("Terminal running")).toBeTruthy()
    expect(screen.getByRole("button", { name: "Stop terminal" })).toBeTruthy()
    expect(screen.queryByText(/ttyd is not installed/)).toBeNull()
    expect(calls.mock.calls.filter(call => call[1]?.method === "POST")).toHaveLength(0)
    await user.click(screen.getByRole("button", { name: "Stop terminal" }))
    await screen.findByText("Stopped")
    expect(screen.queryByTitle("PocketHost interactive Termux shell")).toBeNull()
    expect(calls.mock.calls.filter(call => call[1]?.method === "POST")).toHaveLength(1)
  })

  it("does not invent a missing ttyd installation while tool detection is pending", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true, json: async () => ({ terminal: { running: false, url: null } }),
    })))
    render(<TermuxTerminalPanel />)
    await screen.findByText("Stopped")
    expect(screen.queryByText(/ttyd is not installed/)).toBeNull()
    expect(screen.getByRole("button", { name: "Start terminal" }).hasAttribute("disabled")).toBe(true)
  })

  it("refuses a conflicting running status without mounting a phantom terminal", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true, json: async () => ({ terminal: { running: true, url: null } }),
    })))
    render(<TermuxTerminalPanel detected />)
    await screen.findByRole("alert")
    expect(screen.queryByTitle("PocketHost interactive Termux shell")).toBeNull()
    expect(screen.getByText("Status unverified")).toBeTruthy()
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
