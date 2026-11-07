import { afterEach, describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { PackageActions, WorkspaceManager, SiteServiceActions, WorkspaceBackupActions, RunitServiceActions, PackageCatalog, ResticActions } from "@/app/termux/admin-actions"

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
    const fetchMock = vi.fn(async (_url: string, options?: RequestInit) => {
      void _url
      void options
      return {
        ok: true, json: async () => ({
          operation: "install", result: { exit: 0, output: "fixture install complete" },
        }),
      }
    })
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
      ok: url.length > 0, json: async () => options?.method === "POST" ?
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
    const fetchMock = vi.fn(async (_url: string, _options?: RequestInit) => {
      void _url
      void _options
      return { ok: true, json: async () => ({}) }
    })
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

describe("H3 additional native-tool integrations", () => {
  it("previews apt changes without a confirmation or mutation", async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn(async (_url: string, _options?: RequestInit) => {
      void _url
      void _options
      return {
        ok: true,
        json: async () => ({ operation: "install", result: { exit: 0, output: "Simulated changes" } }),
      }
    })
    const confirm = vi.fn(() => true)
    vi.stubGlobal("fetch", fetchMock)
    vi.stubGlobal("confirm", confirm)
    render(<PackageActions />)
    await user.type(screen.getByLabelText("Package name"), "git")
    await user.click(screen.getByRole("button", { name: "Preview install" }))
    await screen.findByText("Simulated changes")
    const payload = JSON.parse(String(fetchMock.mock.calls[0]![1]?.body))
    expect(payload).toEqual({ action: "package-preview", name: "install", path: "git" })
    expect(confirm).not.toHaveBeenCalled()
  })
  it("reports snapshot verification independently from restore", async () => {
    const user = userEvent.setup()
    const name = "snapshot-20261107-aaaaaaaaaaaa"
    const fetchMock = vi.fn(async (_url: string, options?: RequestInit) => ({
      ok: _url.length > 0,
      json: async () => options?.method === "POST"
        ? { verification: { name, state: "verified", files: 2 } }
        : { snapshots: [{ name, createdAt: "2026-11-07T13:00:00.000Z", files: 2 }] },
    }))
    vi.stubGlobal("fetch", fetchMock)
    vi.stubGlobal("confirm", vi.fn(() => true))
    render(<WorkspaceBackupActions />)
    await user.click(await screen.findByRole("button", { name: "Verify" }))
    await screen.findByText(/Snapshot integrity: verified/)
    const posted = fetchMock.mock.calls.find(call => call[1]?.method === "POST")!
    expect(JSON.parse(String(posted[1]?.body))).toEqual({ action: "snapshot", name: "verify", path: name })
  })
})

describe("H3 runit service registration UI", () => {
  it("registers only explicitly selected non-protected services, then starts them", async () => {
    const user = userEvent.setup()
    let registered = false
    const requests = vi.fn(async (url: string, options?: RequestInit) => {
      expect(url).toContain("/api/v1/termux-admin")
      if (options?.method === "POST") {
        const body = JSON.parse(String(options.body))
        expect(body.action).toBe("service")
        expect(body.path).toBe("site-worker")
        registered = true
        return { ok: true, json: async () => ({ changed: true }) }
      }
      return { ok: true, json: async () => ({ services: [
        { name: "wreckscanner", registered: false, protected: true, state: "running" },
        { name: "site-worker", registered, protected: false, state: "stopped" },
      ] }) }
    })
    vi.stubGlobal("fetch", requests)
    vi.stubGlobal("confirm", vi.fn(() => true))
    render(<RunitServiceActions />)
    await screen.findByText("site-worker")
    expect(screen.getByText("wreckscanner")).toBeTruthy()
    expect(screen.getByText("Protected")).toBeTruthy()
    await user.click(screen.getByRole("button", { name: "Register" }))
    await screen.findByText("Registered")
    await user.click(screen.getByRole("button", { name: "Start" }))
    await screen.findByText(/start completed/)
    const operations = requests.mock.calls.filter((call: [string, RequestInit?]) => call[1]?.method === "POST")
      .map((call: [string, RequestInit?]) => JSON.parse(String(call[1]?.body)))
    expect(operations.map((operation: { name: string }) => operation.name)).toEqual(["register", "start"])
    expect(operations.every((operation: { path: string }) => operation.path === "site-worker")).toBe(true)
  })
})

describe("H3 complete Termux software catalog", () => {
  it("loads dpkg inventory and searches available apt packages with no writes", async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn(async (url: string, options?: RequestInit) => {
      expect(options?.method).toBe("GET")
      return { ok: true, json: async () => url.includes("mode=packages")
        ? { packages: [{ name: "curl", version: "8.1" }], truncated: false }
        : { query: "restic", packages: [{ name: "restic", description: "Encrypted backups" }], truncated: false } }
    })
    vi.stubGlobal("fetch", fetchMock)
    render(<PackageCatalog />)
    await user.click(screen.getByRole("button", { name: "Load installed Termux packages" }))
    await screen.findByText("curl")
    await user.type(screen.getByLabelText("Search available Termux software"), "restic")
    await user.click(screen.getByRole("button", { name: "Search catalog" }))
    await screen.findByText("Encrypted backups")
    expect(fetchMock.mock.calls).toHaveLength(2)
    expect(fetchMock.mock.calls.every(call => call[1]?.method === "GET")).toBe(true)
  })
})

describe("H3 native encrypted Restic backup UI", () => {
  it("backs up owned workspace through the typed endpoint without a password form", async () => {
    const user = userEvent.setup()
    let initialized = false
    const calls = vi.fn(async (url: string, opts?: RequestInit) => {
      if (opts?.method === "POST") {
        const payload = JSON.parse(String(opts.body))
        expect(payload).toEqual({ action: "restic", name: "backup" })
        initialized = true
        return { ok: true, json: async () => ({ result: { exit: 0, output: "mock done" } }) }
      }
      if (url.includes("mode=restic-snapshots"))
        return { ok: true, json: async () => ({ snapshots: [] }) }
      return { ok: true, json: async () => ({
        restic: { initialized, repositoryPresent: initialized, keyPresent: initialized },
      }) }
    })
    vi.stubGlobal("fetch", calls)
    vi.stubGlobal("confirm", vi.fn(() => true))
    render(<ResticActions detected />)
    await screen.findByText("Repository not initialized")
    await user.click(screen.getByRole("button", { name: "Create Restic backup" }))
    await screen.findByText("Restic backup completed")
    expect(calls.mock.calls.some(call => call[1]?.method === "POST")).toBe(true)
    expect(screen.queryByLabelText(/password/i)).toBeNull()
  })
  it("makes missing Restic installation explicit without issuing commands", () => {
    const calls = vi.fn(async () => ({ ok: true, json: async () => ({}) }))
    vi.stubGlobal("fetch", calls)
    render(<ResticActions detected={false} />)
    expect(screen.getByText(/Restic executable not detected/)).toBeTruthy()
    expect(calls).not.toHaveBeenCalled()
  })
})
