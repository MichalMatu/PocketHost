import { z } from "zod"

const availability = z.enum(["ok", "unavailable", "permission-denied"])
export const protectedServiceSchema = z.object({
  version: z.literal(1),
  mode: z.literal("read-only"),
  service: z.enum(["sshd", "mosquitto", "ilestoi-healthwatch"]),
  observedAt: z.string().datetime({ offset: true }),
  runit: z.object({
    state: z.enum(["running", "stopped", "unknown"]),
    uptimeSeconds: z.number().int().nonnegative().nullable(),
    error: z.string().max(50).nullable(),
  }).strict(),
  process: z.object({
    pid: z.number().int().positive(),
    startTicks: z.string().regex(/^\d+$/).max(40),
    rssMiB: z.number().finite().nonnegative().nullable(),
    identity: z.literal("runit-consistent-not-owned"),
  }).strict().nullable(),
  health: z.object({
    state: z.literal("unverified"),
    reason: z.literal("runit-is-not-application-health-proof"),
  }).strict(),
  config: z.object({
    state: availability,
    scope: z.enum(["direct-file-not-effective-runtime", "not-observed"]),
    settings: z.array(z.object({
      name: z.enum(["port", "password-authentication", "listener", "anonymous-access"]),
      value: z.string().regex(/^(?:\d{1,5}|yes|no|true|false)$/),
    }).strict()).max(8),
    truncated: z.boolean(),
    error: z.enum(["not-found", "not-applicable", "unsafe-config", "read-unavailable"]).nullable(),
  }).strict(),
  logs: z.object({
    state: availability,
    events: z.array(z.object({
      kind: z.enum(["started", "stopped", "failure", "connection", "health-result"]),
      timestamp: z.string().datetime({ offset: true }).nullable(),
    }).strict()).max(16),
    error: z.enum(["not-found", "unsafe-log", "read-unavailable"]).nullable(),
  }).strict(),
  lastCheck: z.object({
    state: z.literal("unverified"),
    reason: z.literal("no-independent-check-source"),
  }).strict().nullable(),
  notice: z.literal("external-protected-no-lifecycle-control"),
}).strict()
export type ProtectedServiceDiagnostic = z.infer<typeof protectedServiceSchema>
