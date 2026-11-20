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
  lines: z.array(z.object({
    kind: z.enum(["budget", "failed", "timeout", "interrupted",
      "published", "claim", "transport", "service", "other"]),
    text: z.string().min(1).max(180),
    timestamp: z.string().datetime({ offset: true }).nullable(),
  }).strict()).max(120),
  unclassifiedLines: z.number().int().nonnegative().max(120),
  truncated: z.boolean(),
  notice: z.literal("sanitized-log-tail-no-lifecycle-authority"),
  latency: z.object({
    version: z.literal(1),
    source: z.literal("termux-agent-local-task-spool"),
    mode: z.literal("event-driven"),
    state: z.enum(["ok", "missing", "unavailable", "unsafe"]),
    observedAt: z.string().datetime({ offset: true }).nullable(),
    sampleCount: z.number().int().nonnegative().max(40),
    medianSeconds: z.number().finite().min(0).max(86400).nullable(),
    p95Seconds: z.number().finite().min(0).max(86400).nullable(),
    latestSeconds: z.number().finite().min(0).max(86400).nullable(),
    alerts: z.array(z.enum([
      "uncertain-execution", "execution-timeout",
      "repeated-long-execution", "execution-regression",
    ])).max(4),
    recent: z.array(z.object({
      at: z.string().datetime({ offset: true }),
      seconds: z.number().finite().min(0).max(86400).nullable(),
      status: z.enum(["done", "failed", "unknown"]),
    }).strict()).max(10),
  }).strict().optional(),
}).strict()

export type LocalAgentLogData = z.infer<typeof localAgentLogSchema>
