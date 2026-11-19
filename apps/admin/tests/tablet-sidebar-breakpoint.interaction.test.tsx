import { renderHook } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { useIsCompactSidebar, useIsMobile } from "@/hooks/use-mobile"

afterEach(() => vi.unstubAllGlobals())

it("keeps the existing mobile breakpoint while using the tablet drawer for management navigation", () => {
  for (const [width, compact, mobile] of [
    [390, true, true],
    [767, true, true],
    [768, true, false],
    [1023, true, false],
    [1024, false, false],
    [1440, false, false],
  ] as const) {
    vi.stubGlobal("matchMedia", vi.fn((query: string) => ({
      matches: width <= Number(/max-width: (\d+)px/.exec(query)?.[1] ?? -1),
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })))
    const side = renderHook(() => useIsCompactSidebar())
    const ordinary = renderHook(() => useIsMobile())
    expect(side.result.current, `sidebar at ${width}px`).toBe(compact)
    expect(ordinary.result.current, `mobile at ${width}px`).toBe(mobile)
    side.unmount()
    ordinary.unmount()
  }
})
