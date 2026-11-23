export type HistoryRange = "1h" | "24h" | "7d"

export function historyTime(value: string | number, range: HistoryRange, detailed = false) {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return "Time unavailable"
  if (range === "1h") return detailed
    ? date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" })
    : date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
  return date.toLocaleString(undefined, {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  })
}

