import { z } from "zod"

const availability = z.enum(["ok", "unavailable", "permission-denied"])
export const ileStoiDiagnosticSchema = z.object({
  version: z.literal(1),
  mode: z.literal("read-only"),
  service: z.literal("wreckscanner"),
  observedAt: z.string().datetime({ offset: true }),
  runit: z.object({
    state: z.enum(["running", "stopped", "unknown"]),
    uptimeSeconds: z.number().int().nonnegative().nullable(),
    error: z.string().nullable(),
  }).strict(),
  process: z.object({
    pid: z.number().int().positive(), startTicks: z.string().regex(/^\d+$/),
    name: z.string().nullable(), rssMiB: z.number().finite().nonnegative().nullable(),
    memoryState: availability, identity: z.literal("runit-consistent-not-owned"),
  }).strict().nullable(),
  health: z.object({
    state: z.literal("unverified"), reason: z.literal("no-confirmed-local-http-route"),
  }).strict(),
  logs: z.object({
    state: availability, lines: z.array(z.string().max(200)).max(32),
    error: z.string().nullable(),
  }).strict(),
  notice: z.literal("external-protected-no-lifecycle-control"),
}).strict()
export type IleStoiDiagnostic = z.infer<typeof ileStoiDiagnosticSchema>
