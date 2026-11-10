import { z } from "zod"
import { hostSnapshotSchema } from "@/lib/host-snapshot-schema"

const stamp = z.string().datetime({ offset: true })
const state = z.enum(["ok", "stale", "unavailable", "permission-denied"])
const reading = <T extends z.ZodTypeAny>(value: T) =>
  z.union([
    z.object({ state: z.literal("ok"), value, observedAt: stamp }).strict(),
    z.object({
      state: z.enum(["stale", "unavailable", "permission-denied"]),
      value: z.null(),
      observedAt: stamp,
    }).strict(),
  ])
const count = z.number().int().nonnegative()
const cpu = z.number().finite().min(0).max(100)
const process = z.object({
  name: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._+:-]{0,23}$/).nullable(),
  pid: count.positive(),
  ppid: count,
  startTicks: z.string().regex(/^\d+$/).max(40),
  cpuTicks: count,
  rssMiB: z.number().nonnegative().finite().nullable(),
  ownership: z.enum(["self", "unverified"]),
}).strict()
const pkg = z.object({
  name: z.string().regex(/^@?[a-zA-Z0-9][a-zA-Z0-9._+-]{0,60}(?:\/[a-zA-Z0-9][a-zA-Z0-9._+-]{0,60})?$/),
  version: z.string().min(1).max(100),
  ecosystem: z.enum(["termux", "node", "python"]),
}).strict()
const event = z.object({
  timestamp: stamp,
  instanceId: z.string().regex(/^[a-z][a-z0-9-]{1,63}$/),
  code: z.string().regex(/^[a-z][a-z0-9-]{1,63}$/),
}).strict()

export const observabilitySnapshotSchema = z.object({
  version: z.literal(1),
  mode: z.literal("read-only"),
  observedAt: stamp,
  host: hostSnapshotSchema,
  metrics: z.object({
    cpuPercent: reading(cpu),
    batteryPercent: reading(cpu),
    network: reading(z.object({ rxBytes: count, txBytes: count }).strict()),
  }).strict(),
  processes: z.object({
    state,
    observedAt: stamp,
    partial: z.literal(true),
    truncated: z.boolean(),
    processes: z.array(process).max(96),
  }).strict(),
  packages: z.object({
    state,
    observedAt: stamp,
    installed: z.array(pkg).max(60),
    truncated: z.boolean(),
    updates: z.object({
      state: z.enum(["unknown", "cached-unverified"]),
      candidates: z.array(z.string().regex(/^[a-z0-9+.-]{1,81}$/)).max(24),
    }).strict(),
  }).strict(),
  diagnostics: z.object({ state, events: z.array(event).max(20) }).strict(),
  history: z.array(z.object({
    observedAt: stamp,
    cpuPercent: cpu.nullable(),
    freeMemoryMiB: count,
  }).strict()).max(36),
  alerts: z.array(z.string().min(1).max(120)).max(12),
}).strict()

export type ObservabilitySnapshot = z.infer<typeof observabilitySnapshotSchema>
export function parseObservabilitySnapshot(data: unknown): ObservabilitySnapshot {
  return observabilitySnapshotSchema.parse(data)
}
