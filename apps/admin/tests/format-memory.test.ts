import { describe, expect, it } from "vitest"
import { formatMemory } from "@/lib/format-memory"

describe("memory presentation", () => {
  it("formats large MiB values as readable binary GiB without false decimal GB labels", () => {
    expect(formatMemory(2500)).toBe("2.4 GiB")
    expect(formatMemory(120076)).toBe("117.3 GiB")
    expect(formatMemory(512)).toBe("512 MiB")
    expect(formatMemory(-10)).toBe("Unavailable")
  })
})
