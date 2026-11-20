"use client"

import { cn } from "cn"

interface LoadingSpinnerProps {
  className?: string
  size?: "sm" | "md" | "lg"
  /** Inline status indicator; the parent owns the loading area's height. */
  inline?: boolean
}

export function LoadingSpinner({
  className,
  size = "md",
  inline = false,
}: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-8 w-8",
    lg: "h-12 w-12",
  }

  return (
    <div className={cn("flex items-center justify-center", inline ? "shrink-0" : "min-h-[200px]")}>
      <div
        className={cn(
          "animate-spin rounded-full border-b-2 border-primary",
          sizeClasses[size],
          className
        )}
      />
    </div>
  )
}
