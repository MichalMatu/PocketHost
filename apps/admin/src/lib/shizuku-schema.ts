import { z } from "zod"

/** Runtime data only from a future local Android companion endpoint. */
const capability = z.object({
  id: z.string().min(1).max(90),
  title: z.string().min(1).max(100),
  available: z.boolean(),
  description: z.string().max(220),
}).strict()

export const shizukuStatusSchema = z.object({
  version: z.literal(1),
  source: z.literal("android-companion"),
  connected: z.boolean(),
  authorized: z.boolean(),
  mode: z.enum(["adb", "root", "none"]),
  observedAt: z.string().datetime({ offset: true }),
  cpuPercent: z.number().finite().min(0).max(100).nullable(),
  visibleProcesses: z.number().int().nonnegative().nullable(),
  capabilities: z.array(capability).max(96),
}).strict()
export type ShizukuStatus = z.infer<typeof shizukuStatusSchema>
export function parseShizukuStatus(value: unknown): ShizukuStatus {
  return shizukuStatusSchema.parse(value)
}
