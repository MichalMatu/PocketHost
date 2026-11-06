import { z } from "zod"

// The host API is read-only and serves only a fixed external-service allowlist.
const nonnegativeInt = z.number().int().nonnegative()
const storage = z.object({
  totalMiB: nonnegativeInt,
  availableMiB: nonnegativeInt,
}).strict().refine((value) => value.availableMiB <= value.totalMiB)

const service = z.object({
  id: z.enum(["ilestoi", "tunnel", "ssh", "mqtt", "healthwatch", "local-agent"]),
  label: z.string().min(1).max(100),
  ownership: z.literal("external"),
  state: z.enum(["running", "stopped", "unknown"]),
}).strict()

export const hostSnapshotSchema = z.object({
  version: z.literal(1),
  mode: z.literal("read-only"),
  platform: z.literal("termux"),
  observedAt: z.string().min(1).max(64),
  runtime: z.object({
    nodeVersion: z.string().min(1).max(80),
    architecture: z.string().min(1).max(80),
    systemUptimeSeconds: nonnegativeInt,
    totalMemoryMiB: nonnegativeInt,
    freeMemoryMiB: nonnegativeInt,
    storage: storage.nullable(),
  }).strict().refine((value) => value.freeMemoryMiB <= value.totalMemoryMiB),
  services: z.array(service).length(6).refine((items) =>
    new Set(items.map((item) => item.id)).size === items.length
  ),
}).strict()

export type HostSnapshot = z.infer<typeof hostSnapshotSchema>

export function parseHostSnapshot(payload: unknown): HostSnapshot {
  return hostSnapshotSchema.parse(payload)
}
