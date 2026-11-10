import { z } from "zod"

const schema = z.object({
  version: z.literal(1),
  source: z.literal("termux"),
  method: z.literal("tcp-handshake"),
  target: z.literal("1.1.1.1:443"),
  observedAt: z.string().datetime({ offset: true }),
  state: z.enum(["reachable", "unreachable"]),
  latencyMs: z.number().finite().nonnegative().nullable(),
}).strict().refine(value => (value.state === "reachable") === (value.latencyMs !== null), {
  message: "Latency only when TCP handshake succeeds",
})

export type InternetConnectivity = z.infer<typeof schema>
export function parseInternetConnectivity(value: unknown): InternetConnectivity {
  return schema.parse(value)
}
