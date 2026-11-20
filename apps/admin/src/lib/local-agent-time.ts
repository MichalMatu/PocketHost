/** Display durations without suggesting that month and year lengths are exact. */
export function formatAgentDuration(value: number | null): string {
  if (value === null || !Number.isFinite(value) || value < 0) return "Not measured"
  let seconds = Math.floor(value)
  const approximate = seconds >= 30 * 86400
  const units = [
    ["yr", 365 * 86400],
    ["mo", 30 * 86400],
    ["d", 86400],
    ["h", 3600],
    ["min", 60],
    ["s", 1],
  ] as const
  const parts: string[] = []
  for (const [name, unit] of units) {
    const amount = Math.floor(seconds / unit)
    if (amount > 0 || (name === "s" && parts.length === 0)) {
      parts.push(amount + " " + name)
      seconds -= amount * unit
    }
  }
  return (approximate ? "≈ " : "") + parts.join(" ")
}

export function formatAgentTime(value: string | null | undefined): string {
  if (!value) return "Not recorded"
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? "Invalid timestamp" : date.toLocaleString()
}
