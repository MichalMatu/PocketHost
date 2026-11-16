import { describe, expect, it } from "vitest"
import { formatUptime } from "@/lib/format-uptime"

describe("human-readable host uptime", () => {
  it("uses the same duration formatting on Dashboard and Host inventory", () => {
    expect(formatUptime(51 * 3600)).toBe("2d 3h")
    expect(formatUptime(0)).toBe("0s")
    expect(formatUptime(90)).toBe("1m 30s")
    expect(formatUptime(248)).toBe("4m 8s")
    expect(formatUptime(15 * 86400)).toBe("15d")
    expect(formatUptime(35 * 86400 + 4 * 3600)).toBe("1mo 5d")
    expect(formatUptime(365 * 86400 + 61 * 86400)).toBe("1y 2mo")
    expect(formatUptime(null)).toBe("Unavailable")
    expect(formatUptime(-1)).toBe("Unavailable")
  })
})
