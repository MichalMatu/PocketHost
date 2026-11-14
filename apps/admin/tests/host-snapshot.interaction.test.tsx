import { describe, expect, it } from "vitest"
import { parseHostSnapshot } from "@/lib/host-snapshot-schema"

const fixture = () => ({
  version: 1,
  mode: "read-only",
  platform: "termux",
  observedAt: "2026-11-14T20:00:00.000Z",
  runtime: {
    nodeVersion: "v24.22.3",
    architecture: "arm64",
    systemUptimeSeconds: 1234,
    totalMemoryMiB: 4096,
    freeMemoryMiB: 1024,
    storage: { totalMiB: 10240, availableMiB: 5120 },
  },
  services: [
    { id: "ssh-server", label: "ssh-server", ownership: "external", state: "stopped" },
    { id: "pockethost-example", label: "pockethost-example", ownership: "external", state: "running" },
  ],
})

describe("generic host snapshot API contract", () => {
  it("accepts a dynamic service inventory, including an empty host", () => {
    expect(parseHostSnapshot(fixture()).services).toHaveLength(2)
    expect(parseHostSnapshot({ ...fixture(), services: [] }).services).toHaveLength(0)
  })

  it("rejects forged ownership and path-like service identifiers", () => {
    const owner = fixture()
    owner.services[0].ownership = "pockethost"
    expect(() => parseHostSnapshot(owner)).toThrow()

    const unsafe = fixture()
    unsafe.services[0].id = "../foreign"
    expect(() => parseHostSnapshot(unsafe)).toThrow()
  })

  it("rejects duplicates, invalid memory, versions and missing runtime", () => {
    const duplicate = fixture()
    duplicate.services[1].id = "ssh-server"
    expect(() => parseHostSnapshot(duplicate)).toThrow()

    const memory = fixture()
    memory.runtime.freeMemoryMiB = 5000
    expect(() => parseHostSnapshot(memory)).toThrow()

    expect(() => parseHostSnapshot({ ...fixture(), version: 2 })).toThrow()
    expect(() => parseHostSnapshot({ ...fixture(), runtime: null })).toThrow()
  })
})
