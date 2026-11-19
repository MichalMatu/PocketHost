import * as React from "react"

const MOBILE_BREAKPOINT = 768
const QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`

function subscribe(onChange: () => void) {
  const mql = window.matchMedia(QUERY)
  mql.addEventListener("change", onChange)
  return () => mql.removeEventListener("change", onChange)
}

export function useIsMobile() {
  return React.useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false
  )
}

/** Tablet management layouts need full-width content rather than a fixed 16rem rail. */
const SIDEBAR_COMPACT_QUERY = "(max-width: 1023px)"

function subscribeSidebar(onChange: () => void) {
  const mql = window.matchMedia(SIDEBAR_COMPACT_QUERY)
  mql.addEventListener("change", onChange)
  return () => mql.removeEventListener("change", onChange)
}

/** Sidebar-only threshold; normal mobile breakpoints remain at 768px. */
export function useIsCompactSidebar() {
  return React.useSyncExternalStore(
    subscribeSidebar,
    () => window.matchMedia(SIDEBAR_COMPACT_QUERY).matches,
    () => false
  )
}
