import { z } from "zod"

const interfaceSchema = z.object({
  name: z.string().min(1),
  address: z.ipv4(),
}).strict()

// GET /api/v1/network-access includes owned gateway health; POST enable/disable
// intentionally returns the smaller status-only receipt. Validate both shapes.
const timestampSchema = z.string().max(64).refine(
  value => Number.isFinite(Date.parse(value)), "Invalid gateway observation timestamp",
).nullable()

const gatewayHealthSchema = z.object({
  state: z.enum([
    "unknown", "disabled", "paused", "healthy", "unhealthy",
    "interface-missing", "recovering", "awaiting-interface",
  ]),
  checkedAt: timestampSchema,
  recoveredAt: timestampSchema,
  consecutiveFailures: z.number().int().nonnegative(),
  recoveryCount: z.number().int().nonnegative(),
  nextRecoveryAt: timestampSchema,
  lastError: z.string().max(120).nullable(),
  startupFailures: z.number().int().nonnegative(),
  nextStartAttemptAt: timestampSchema,
}).strict()

const statusSchema = z.object({
  version: z.literal(1),
  mode: z.enum(["manual", "auto"]),
  enabled: z.boolean(),
  bind: z.string().nullable(),
  interfaces: z.array(interfaceSchema),
  adminUrl: z.string().nullable(),
  siteUrl: z.string().nullable(),
  health: gatewayHealthSchema.optional(),
}).strict()

export type NetworkAccessStatus = z.infer<typeof statusSchema>

export function parseNetworkAccessStatus(data: unknown): NetworkAccessStatus {
  return statusSchema.parse(data)
}
