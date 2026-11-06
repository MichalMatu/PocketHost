import { describe, expect, it } from "vitest"
import { parseHostSnapshot } from "@/lib/host-snapshot-schema"

const fixture = () => ({
  version: 1,
  mode: "read-only",
  platform: "termux",
  observedAt: "2026-11-07T00:00:00.000Z",
  runtime: {
    nodeVersion: "v26.4.0",
    architecture: "arm64",
    systemUptimeSeconds: 1234,
    totalMemoryMiB: 4096,
    freeMemoryMiB: 1024,
    storage: { totalMiB: 10240, availableMiB: 5120 },
  },
  services: [
    "ilestoi", "tunnel", "ssh", "mqtt", "healthwatch", "local-agent",
  ].map((id) => ({ id, label: id, ownership: "external", state: "unknown" })),
})

describe("host snapshot API contract", () => {
  it("accepts the fixed read-only Termux API shape", () => {
    expect(parseHostSnapshot(fixture()).services).toHaveLength(6)
  })

  it("rejects a forged owner and unknown service identifier", () => {
    const owner = fixture()
    owner.services[0].ownership = "pockethost"
    expect(() => parseHostSnapshot(owner)).toThrow()

    const unknown = fixture()
    unknown.services[0].id = "foreign"
    expect(() => parseHostSnapshot(unknown)).toThrow()
  })

  it("rejects duplicates, invalid memory, wrong versions and missing runtime", () => {
    const duplicate = fixture()
    duplicate.services[1].id = "ilestoi"
    expect(() => parseHostSnapshot(duplicate)).toThrow()

    const memory = fixture()
    memory.runtime.freeMemoryMiB = 5000
    expect(() => parseHostSnapshot(memory)).toThrow()

    expect(() => parseHostSnapshot({ ...fixture(), version: 2 })).toThrow()
    expect(() => parseHostSnapshot({ ...fixture(), runtime: null })).toThrow()
    expect(() => parseHostSnapshot({ ...fixture(), services: [] })).toThrow()
  })
})
