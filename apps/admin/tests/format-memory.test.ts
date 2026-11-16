import { describe, expect, it } from "vitest"
import { formatBytes, formatMemory } from "@/lib/format-memory"

describe("memory presentation", () => {
  it("formats large MiB values as readable binary GiB without false decimal GB labels", () => {
    expect(formatMemory(2500)).toBe("2.4 GiB")
    expect(formatMemory(120076)).toBe("117.3 GiB")
    expect(formatMemory(512)).toBe("512 MiB")
    expect(formatMemory(-10)).toBe("Unavailable")
  })
})

describe("owned site byte sizes", () => {
  it("uses compact binary units and removes unnecessary .0", () => {
    expect(formatBytes(57736 * 1024)).toBe("56.4 MiB")
    expect(formatBytes(248)).toBe("248 B")
    expect(formatBytes(1024)).toBe("1 KiB")
    expect(formatBytes(1024 * 1024)).toBe("1 MiB")
    expect(formatBytes(1.25 * 1024 ** 3)).toBe("1.3 GiB")
    expect(formatBytes(null)).toBe("Unavailable")
    expect(formatBytes(-1)).toBe("Unavailable")
  })
})
