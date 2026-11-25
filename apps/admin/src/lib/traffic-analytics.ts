import { z } from "zod"

const count = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)
const epoch = count.max(8640000000000000)
export type TrafficRange = "24h" | "7d"
const summary = z.object({
  range: z.enum(["24h", "7d"]),
  from: z.number().int(),
  observedAt: epoch,
  startedAt: epoch,
  lastAt: epoch,
  requests: count,
  bytes: count,
  rps: z.number().nonnegative().nullable(),
  statuses: z.array(z.tuple([z.number().int().min(100).max(599), count])).max(500),
  topPaths: z.array(z.tuple([z.string().startsWith("/").max(120), count])).max(10),
  otherPaths: count,
  history: z.array(z.object({ at: epoch, requests: count, bytes: count })).max(168),
})
const result = z.discriminatedUnion("state", [
  z.object({ projectId: z.string(), state: z.literal("missing") }),
  z.object({ projectId: z.string(), state: z.literal("unavailable") }),
  z.object({ projectId: z.string(), state: z.literal("available"), current: z.boolean(),
    persistedAt: epoch, summary }),
])
export type TrafficResult = z.infer<typeof result>
export type TrafficSummary = z.infer<typeof summary>

export function parseTrafficResult(value: unknown, projectId: string, range: TrafficRange): TrafficResult {
  const parsed = result.parse(value)
  if (parsed.projectId !== projectId) throw new Error("Unexpected traffic project")
  if (parsed.state === "available") {
    const s = parsed.summary
    if (s.range !== range || s.history.length > (range === "24h" ? 24 : 168) ||
      s.startedAt > s.lastAt || s.lastAt > parsed.persistedAt || parsed.persistedAt > s.observedAt ||
      s.history.some((b, i) => b.at < s.from || b.at > s.observedAt || b.at % 3600000 !== 0 ||
        (i > 0 && b.at <= s.history[i - 1]!.at)) ||
      s.history.reduce((total, b) => total + b.requests, 0) !== s.requests ||
      s.history.reduce((total, b) => total + b.bytes, 0) !== s.bytes ||
      s.statuses.reduce((total, [, n]) => total + n, 0) !== s.requests ||
      (!parsed.current && s.rps !== null)) throw new Error("Invalid traffic totals")
  }
  return parsed
}
