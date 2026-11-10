import { z } from "zod"

const nonnegative = z.number().finite().nonnegative()
const point = z.object({
  observedAt: z.string().datetime({ offset: true }),
  cpu: z.number().min(0).max(100).nullable(),
  ram: z.number().min(0).max(100).nullable(),
  internetMs: nonnegative.nullable(),
  internetFailed: z.boolean().nullable(),
  bridgeMs: nonnegative.nullable(),
  bridgeOnline: z.boolean().nullable(),
  servicesRunning: nonnegative.nullable(),
  servicesTotal: nonnegative.nullable(),
  storageAvailableMiB: nonnegative.nullable(),
  systemUptimeSeconds: nonnegative.nullable(),
}).strict()

const history = z.object({
  version: z.literal(1),
  source: z.literal("pockethost-collector"),
  state: z.enum(["ok", "unavailable"]),
  intervalSeconds: z.literal(60),
  retentionHours: z.literal(24),
  samples: z.array(point).max(1440),
}).strict()

export type DashboardHistory = z.infer<typeof history>
export type DashboardHistoryPoint = z.infer<typeof point>
export function parseDashboardHistory(value: unknown): DashboardHistory {
  return history.parse(value)
}
