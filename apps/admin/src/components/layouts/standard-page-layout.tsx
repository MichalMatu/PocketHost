import type { ReactNode } from "react"

import { BaseLayout } from "@/components/layouts/base-layout"

// Preserve the existing 40px touch target on narrow screens for card actions.
export const pageActionClass = "max-md:min-h-10"

/** Cards-first body; accessible page name and route-owned refresh live in the shell. */
export function StandardPageLayout({ title, onRefresh, refreshDisabled, children }: {
  title: string
  onRefresh?: () => void
  refreshDisabled?: boolean
  children: ReactNode
}) {
  return (
    <BaseLayout title={title} composition="standard"
      onRefresh={onRefresh} refreshDisabled={refreshDisabled}>
      {children}
    </BaseLayout>
  )
}
