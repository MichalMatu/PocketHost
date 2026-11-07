import { describe, expect, it } from "vitest"
import { parseOwnedHealth, parseOwnedProject } from "@/lib/owned-project-schema"

const fixture = () => ({
  project: {
    id: "pockethost-demo",
    name: "PocketHost Demo",
    description: "Owned demo test application",
    type: "static-html",
    dataDirectory: "PocketHost-OwnedSites/pockethost-demo",
    state: "running",
    port: 18787,
    url: "http://127.0.0.1:18787/",
    contentVersion: 2,
    previousVersion: 1,
    pid: 9123,
    startTicks: "401209",
    history: [
      { at: "2026-11-07T05:00:00.000Z", action: "publish", from: 1, to: 2 },
    ],
  },
})

describe("H1 owned project validation", () => {
  it("accepts a verified owned project and exact demo HTTP identity", () => {
    const project = parseOwnedProject(fixture())
    expect(project.id).toBe("pockethost-demo")
    expect(project.history[0].action).toBe("publish")
    expect(parseOwnedHealth({ healthy: true })).toBe(true)
    expect(parseOwnedHealth({ healthy: false })).toBe(false)
  })

  it("rejects process ownership inferred from an external project", () => {
    const forged = fixture()
    forged.project.id = "photomap-test"
    expect(() => parseOwnedProject(forged)).toThrow()
    const port = fixture()
    port.project.url = "http://127.0.0.1:8010/"
    expect(() => parseOwnedProject(port)).toThrow()
    expect(() => parseOwnedProject({ ...fixture(), shell: "rm -rf" })).toThrow()
  })

  it("requires complete and numeric PID/start-ticks for a running projection", () => {
    const bad = fixture()
    bad.project.startTicks = "unknown"
    expect(() => parseOwnedProject(bad)).toThrow()
    const stopped = fixture()
    stopped.project.state = "stopped"
    expect(() => parseOwnedProject(stopped)).toThrow()
    stopped.project.pid = null as unknown as number
    stopped.project.startTicks = null as unknown as string
    expect(parseOwnedProject(stopped).state).toBe("stopped")
  })

  it("caps history and rejects unknown actions or unsafe host paths", () => {
    const unbounded = fixture()
    unbounded.project.history = Array(26).fill(unbounded.project.history[0])
    expect(() => parseOwnedProject(unbounded)).toThrow()
    const wrong = fixture()
    wrong.project.history[0].action = "remove"
    expect(() => parseOwnedProject(wrong)).toThrow()
    const path = fixture()
    path.project.dataDirectory = "../../outside"
    expect(() => parseOwnedProject(path)).toThrow()
    expect(() => parseOwnedHealth({ healthy: true, privateKey: "x" })).toThrow()
  })
})
