import { describe, expect, it } from "vitest"
import { parseNetworkAccessStatus } from "@/lib/network-access-schema"

const basic = {
  version: 1 as const,
  mode: "auto" as const,
  enabled: true,
  bind: "192.168.0.16",
  interfaces: [{ name: "wlan0", address: "192.168.0.16" }],
  adminUrl: "http://192.168.0.16:18878/",
  siteUrl: "http://192.168.0.16:18879/",
}

describe("LAN status wire shapes", () => {
  it("accepts owned gateway GET health without discarding the observation", () => {
    const value = parseNetworkAccessStatus({
      ...basic,
      health: {
        state: "healthy",
        checkedAt: "2026-11-16T21:45:00.000Z",
        recoveredAt: null,
        consecutiveFailures: 0,
        recoveryCount: 0,
        nextRecoveryAt: null,
        lastError: null,
        startupFailures: 0,
        nextStartAttemptAt: null,
      },
    })
    expect(value.health?.state).toBe("healthy")
    expect(value.enabled).toBe(true)
  })

  it("also accepts the smaller POST change receipt", () => {
    expect(parseNetworkAccessStatus(basic).health).toBeUndefined()
  })

  it("rejects malformed health instead of showing trusted controls", () => {
    expect(() => parseNetworkAccessStatus({
      ...basic, health: { state: "healthy" },
    })).toThrow()
  })
})
