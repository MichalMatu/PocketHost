/**
 * Host API uptime is elapsed seconds. 365-day years and 30-day months are
 * approximate duration units, not calendar dates; keep two nonzero units
 * so summary cards remain readable on mobile.
 */
export function formatUptime(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return "Unavailable"
  let remaining = Math.floor(seconds)
  const units = [
    { size: 365 * 86400, suffix: "y" },
    { size: 30 * 86400, suffix: "mo" },
    { size: 86400, suffix: "d" },
    { size: 3600, suffix: "h" },
    { size: 60, suffix: "m" },
    { size: 1, suffix: "s" },
  ]
  const parts: string[] = []
  for (const unit of units) {
    const value = Math.floor(remaining / unit.size)
    if (value > 0) parts.push(value + unit.suffix)
    remaining %= unit.size
    if (parts.length === 2) break
  }
  return parts.join(" ") || "0s"
}
