import { z } from "zod"

const interfaceSchema = z.object({
  name: z.string().min(1),
  address: z.ipv4(),
}).strict()

const statusSchema = z.object({
  version: z.literal(1),
  mode: z.literal("manual"),
  enabled: z.boolean(),
  bind: z.string().nullable(),
  interfaces: z.array(interfaceSchema),
  adminUrl: z.string().nullable(),
  siteUrl: z.string().nullable(),
}).strict()

export type NetworkAccessStatus = z.infer<typeof statusSchema>

export function parseNetworkAccessStatus(data: unknown): NetworkAccessStatus {
  return statusSchema.parse(data)
}
