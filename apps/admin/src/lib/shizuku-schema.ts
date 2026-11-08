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
    label: z.string().max(120),
    enabled: z.boolean().nullable(),
  }).strict()).max(1024),
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


/** Device-wide source readings from the native foreground Shizuku bridge. */
const nullableNonnegative = z.number().finite().nonnegative().nullable()
export const shizukuSystemSchema = z.object({
  version: z.literal(1),
  source: z.literal("android-companion"),
  connected: z.literal(true),
  authorized: z.literal(true),
  mode: z.enum(["adb", "root"]),
  observedAt: z.string().datetime({ offset: true }),
  processes: z.array(z.object({
    pid: z.number().int().positive(),
    name: z.string().min(1).max(160),
    user: z.string().max(48),
    rssKb: z.number().int().nonnegative().nullable(),
    cpuPercent: z.number().finite().min(0).max(100).nullable(),
  }).strict()).max(1200),
  processesTruncated: z.boolean(),
  processError: z.string().max(120).optional(),
  power: z.object({
    batteryLevel: z.number().int().min(0).max(100).nullable(),
    batteryTemperatureC: nullableNonnegative,
    charging: z.boolean().nullable(),
    chargingState: z.enum(["charging", "discharging", "full", "not-charging", "unknown"]).optional(),
    powerConnected: z.boolean().nullable().optional(),
    memoryTotalKb: z.number().int().nonnegative().nullable(),
    memoryAvailableKb: z.number().int().nonnegative().nullable(),
  }).strict(),
  settings: z.object({
    brightness: z.number().int().min(0).max(255).nullable(),
    airplaneMode: z.boolean().nullable(),
  }).strict(),
  services: z.object({
    names: z.array(z.string().max(300)).max(256),
    truncated: z.boolean(),
    error: z.string().max(120).optional(),
  }).strict(),
}).strict()

export type ShizukuSystem = z.infer<typeof shizukuSystemSchema>
export function parseShizukuSystem(value: unknown): ShizukuSystem {
  const parsed = shizukuSystemSchema.parse(value)
  if (new Set(parsed.processes.map(p => p.pid)).size !== parsed.processes.length) {
    throw new Error("duplicate-android-process")
  }
  return parsed
}


export const shizukuAppSchema = z.object({
  version: z.literal(1),
  source: z.literal("android-companion"),
  packageName: z.string().regex(/^[A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)+$/).max(200),
  label: z.string().max(120),
  versionName: z.string().max(120),
  versionCode: z.number().int().nonnegative(),
  targetSdk: z.number().int().min(0).max(100),
  enabled: z.boolean(),
  system: z.boolean(),
  permissions: z.array(z.object({
    name: z.string().regex(/^[A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)+$/).max(200),
    granted: z.boolean(),
  }).strict()).max(96),
  iconPng: z.string().max(65000).regex(/^[A-Za-z0-9+/]+={0,2}$/).optional(),
}).strict()
export type ShizukuApp = z.infer<typeof shizukuAppSchema>
export function parseShizukuApp(value: unknown): ShizukuApp {
  const app = shizukuAppSchema.parse(value)
  if (new Set(app.permissions.map(p => p.name)).size !== app.permissions.length) {
    throw new Error("duplicate-android-permission")
  }
  return app
}
