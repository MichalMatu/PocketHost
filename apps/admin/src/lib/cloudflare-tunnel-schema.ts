import { z } from "zod"

const availability = z.enum(["ok", "unavailable", "permission-denied"])
const errors = z.enum(["not-found", "unsafe-config", "read-unavailable"]).nullable()
export const cloudflareTunnelSchema = z.object({
  version: z.literal(1),
  mode: z.literal("read-only"),
  service: z.literal("cloudflared"),
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
  config: z.object({
    state: availability, tunnelDeclared: z.boolean().nullable(),
    credentialsFileDeclared: z.boolean().nullable(),
    ingress: z.array(z.object({
      hostname: z.string().regex(/^(?:\*\.)?(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/),
      backend: z.enum(["http", "https", "ssh", "tcp", "other"]),
    }).strict()).max(12),
    truncated: z.boolean(), error: errors,
  }).strict(),
  connections: z.object({
    state: z.literal("unverified"),
    reason: z.literal("runit-is-not-tunnel-connection-proof"),
    lastEvent: z.enum(["registered", "disconnected", "failure", "none"]),
  }).strict(),
  logs: z.object({
    state: availability,
    events: z.array(z.object({
      kind: z.enum(["registered", "disconnected", "failure"]),
      timestamp: z.string().datetime({ offset: true }).nullable(),
    }).strict()).max(16),
    error: z.enum(["not-found", "unsafe-log", "read-unavailable"]).nullable(),
  }).strict(),
  notice: z.literal("external-protected-no-lifecycle-control"),
}).strict()
export type CloudflareTunnelDiagnostic = z.infer<typeof cloudflareTunnelSchema>
