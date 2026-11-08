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


export const shizukuAppsSchema = z.object({
  version: z.literal(1),
  source: z.literal("android-companion"),
  connected: z.literal(true),
  authorized: z.literal(true),
  mode: z.enum(["adb", "root"]),
  observedAt: z.string().datetime({ offset: true }),
  packages: z.array(z.object({
    packageName: z.string().regex(/^[A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)+$/).max(200),
    system: z.boolean(),
  }).strict()).max(512),
  truncated: z.boolean(),
}).strict()
export type ShizukuApps = z.infer<typeof shizukuAppsSchema>
export function parseShizukuApps(value: unknown): ShizukuApps {
  const parsed = shizukuAppsSchema.parse(value)
  if (new Set(parsed.packages.map(p => p.packageName)).size !== parsed.packages.length) {
    throw new Error("duplicate-android-package")
  }
  return parsed
}
