import { afterEach, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { TrafficPanel } from "@/components/traffic-panel"

const id = "site-" + "a".repeat(32)
const node = "node-" + "b".repeat(32)
const at = 1764000000000
const response = (projectId: string, range: "24h" | "7d", current = true) => ({
  projectId, state: "available", current, persistedAt: at + 1000,
  summary: { range, from: at - (range === "24h" ? 23 : 167) * 3600000,
    observedAt: at + 2000, startedAt: at, lastAt: at + 1000,
    requests: 3, bytes: 128, rps: current ? .05 : null,
    statuses: [[200, 2], [404, 1]], topPaths: [["/health", 2], ["/missing", 1]], otherPaths: 0,
    history: [{ at, requests: 3, bytes: 128 }],
  },
})
afterEach(() => vi.unstubAllGlobals())

it("loads only after opening, displays real snapshot and changes range", async () => {
  const fetchMock = vi.fn(async (url: string) => ({
    ok: true, json: async () => response(id, url.endsWith("7d") ? "7d" : "24h"),
  }))
  vi.stubGlobal("fetch", fetchMock)
  const user = userEvent.setup()
  render(<TrafficPanel projectId={id} kind="static" />)
  expect(fetchMock).not.toHaveBeenCalled()
  await user.click(screen.getByRole("button", { name: "Show traffic" }))
  expect(await screen.findByText("128 B")).toBeTruthy()
  expect(screen.getByText("0.05")).toBeTruthy()
  expect(screen.getByText("/missing")).toBeTruthy()
  expect(screen.getByRole("img", { name: "HTTP requests per hour" })).toBeTruthy()
  await user.click(screen.getByRole("button", { name: "7d" }))
  await screen.findByText("128 B")
  expect(fetchMock.mock.calls.at(-1)?.[0]).toBe("/api/v1/sites/" + id + "/traffic?range=7d")
})

it("shows missing and foreign snapshots without inventing zero traffic", async () => {
  const fetchMock = vi.fn()
    .mockResolvedValueOnce({ ok: true, json: async () => ({ projectId: node, state: "missing" }) })
    .mockResolvedValueOnce({ ok: true, json: async () => response(id, "24h") })
    .mockResolvedValueOnce({ ok: true, json: async () => response(node, "24h", false) })
  vi.stubGlobal("fetch", fetchMock)
  const user = userEvent.setup()
  render(<TrafficPanel projectId={node} kind="node" />)
  await user.click(screen.getByRole("button", { name: "Show traffic" }))
  await screen.findByText(/No collector snapshot/)
  expect(screen.queryByText("RPS (60 s)")).toBeNull()
  await user.click(screen.getByRole("button", { name: "Refresh traffic" }))
  await screen.findByRole("alert")
  expect(screen.queryByText("0.05")).toBeNull()
  await user.click(screen.getByRole("button", { name: "Refresh traffic" }))
  await screen.findByText("Not measured")
  expect(screen.getByText(/Historical snapshot/)).toBeTruthy()
})
