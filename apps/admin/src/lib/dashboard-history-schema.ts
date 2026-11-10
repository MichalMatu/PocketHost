import { z } from "zod"

const nonnegative = z.number().finite().nonnegative()
const event = z.object({
  observedAt: z.string().datetime({ offset: true }),
  code: z.enum([
    "service-unavailable", "service-restored",
    "internet-down", "internet-restored", "dns-down", "dns-restored",
    "bridge-down", "bridge-restored", "system-rebooted",
    "battery-low", "battery-recovered", "storage-low", "storage-recovered",
    "collector-started", "owned-release-published", "owned-release-rolled-back",
    "owned-backup-created", "owned-backup-restored", "owned-service-restarted",
  ]),
  service: z.enum(["ilestoi", "tunnel", "ssh", "mqtt", "healthwatch", "local-agent"]).nullable(),
}).strict()
const serviceStates = z.record(
  z.enum(["ilestoi", "tunnel", "ssh", "mqtt", "healthwatch", "local-agent"]),
  z.enum(["running", "stopped", "unknown"]),
)
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
  batteryPercent: z.number().min(0).max(100).nullable().optional(),
  batteryCharging: z.boolean().nullable().optional(),
  batteryTempC: z.number().min(-30).max(100).nullable().optional(),
  dnsMs: nonnegative.nullable().optional(),
  dnsFailed: z.boolean().nullable().optional(),
  storageUsedPercent: z.number().min(0).max(100).nullable().optional(),
  serviceStates: serviceStates.nullable().optional(),
  networkRxBytes: z.number().int().nonnegative().safe().nullable().optional(),
  networkTxBytes: z.number().int().nonnegative().safe().nullable().optional(),
  networkObservedAt: z.string().datetime({ offset: true }).nullable().optional(),
}).strict()

const history = z.object({
  version: z.literal(1),
  source: z.literal("pockethost-collector"),
  state: z.enum(["ok", "unavailable"]),
  intervalSeconds: z.literal(60),
  retentionHours: z.union([z.literal(24), z.literal(168)]),
  samples: z.array(point).max(1608),
  events: z.array(event).max(280).optional(),
}).strict()

export type DashboardHistory = z.infer<typeof history>
export type DashboardHistoryPoint = z.infer<typeof point>
export type DashboardHistoryEvent = z.infer<typeof event>
export function parseDashboardHistory(value: unknown): DashboardHistory {
  return history.parse(value)
}
