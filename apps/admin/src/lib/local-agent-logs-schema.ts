import { z } from "zod"

export const localAgentLogSchema = z.object({
  version: z.literal(1),
  mode: z.literal("read-only"),
  observedAt: z.string().datetime({ offset: true }),
  source: z.literal("private-runit-svlogd"),
  state: z.enum(["ok", "missing", "unavailable", "unsafe-log"]),
  events: z.array(z.object({
    kind: z.enum(["budget", "failed", "timeout", "interrupted",
      "published", "claim", "transport", "service"]),
    message: z.enum([
      "Task stopped by execution budget",
      "Agent reported an error or failed task",
      "Agent operation timed out",
      "Operation stopped or execution became uncertain",
      "Result publication activity",
      "Task claim activity",
      "Git transport activity",
      "Agent service activity",
    ]),
    timestamp: z.string().datetime({ offset: true }).nullable(),
  }).strict()).max(30),
  unclassifiedLines: z.number().int().nonnegative().max(80),
  truncated: z.boolean(),
  notice: z.literal("sanitized-events-only-no-lifecycle-authority"),
}).strict()

export type LocalAgentLogData = z.infer<typeof localAgentLogSchema>
