import { z } from "zod"

const service = z.object({
  state: z.enum(["running","stopped","unavailable"]),
  pid: z.number().int().positive().nullable(),
  uptimeSeconds: z.number().int().nonnegative().nullable(),
}).strict()
export const localAgentOperationsSchema = z.object({
  version: z.literal(1),
  observedAt: z.string().datetime({offset: true}),
  agent: service.extend({
    sourceSha: z.string().regex(/^[a-f0-9]{40}$/).nullable(),
    supportsPause: z.boolean(),
  }),
  ssh: service.extend({
    listen: z.enum(["open","closed","unverified"]),
    address: z.literal("192.168.0.16"),
    port: z.literal(8022),
  }),
  intake: z.enum(["active","paused","emergency-stop","unverified"]),
  current: z.array(z.object({
    id: z.string().min(1).max(200),
    since: z.string().datetime({offset:true}).nullable(),
  }).strict()).max(12),
  recent: z.array(z.object({
    id: z.string().min(1).max(200),
    status: z.enum(["done","failed","unknown"]),
    at: z.string().datetime({offset:true}),
  }).strict()).max(24),
  claims: z.number().int().nonnegative().nullable(),
  results: z.number().int().nonnegative().nullable(),
  remoteQueue: z.literal("not-checked"),
}).strict()
export type LocalAgentOperationsData = z.infer<typeof localAgentOperationsSchema>
export type AgentAction =
  "agent-start" | "agent-stop" | "agent-pause" | "agent-resume" |
  "ssh-start" | "ssh-stop" | "ssh-restart"
