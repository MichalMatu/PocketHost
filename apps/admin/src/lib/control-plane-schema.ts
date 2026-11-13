import { z } from "zod"

const sha = z.string().regex(/^[a-f0-9]{40}$/).nullable()
const runit = z.object({
  state: z.enum(["running", "stopped", "unknown"]),
  uptimeSeconds: z.number().int().nonnegative().nullable(),
  error: z.enum(["unavailable", "unsafe-service", "timeout"]).nullable(),
}).strict()

export const controlPlaneSchema = z.object({
  version: z.literal(1),
  mode: z.literal("read-only"),
  observedAt: z.string().datetime({ offset: true }),
  localAgent: z.object({
    runit, intake: z.literal("unverified"), lastResult: z.literal("unverified"),
  }).strict(),
  pocketHost: z.object({
    runit, watch: runit,
    owner: z.object({
      state: z.enum(["verified", "unverified"]),
      pid: z.number().int().positive().nullable(),
      startTicks: z.string().regex(/^\d{1,30}$/).nullable(),
      markerSha: sha, gatewaySha: sha,
      markerAgreement: z.enum(["match", "mismatch", "unverified"]),
      checkoutSha: sha, checkoutClean: z.boolean().nullable(),
      revision: z.enum(["match", "mismatch", "unverified"]),
      reason: z.enum(["unavailable", "invalid-owner", "untrusted-checkout",
        "invalid-process", "invalid-source"]).nullable(),
    }).strict(),
    updateReadiness: z.literal("hold-manual-review"),
    restart: z.literal("blocked"),
  }).strict(),
  notice: z.literal("no-lifecycle-authority"),
}).strict()
export type ControlPlaneDiagnostic = z.infer<typeof controlPlaneSchema>
