import { z } from "zod"

const version = z.union([z.literal(1), z.literal(2)])
export const ownedSiteSchema = z.object({
  version: z.literal(1),
  id: z.literal("pockethost-demo"),
  ownership: z.enum(["pockethost", "none"]),
  state: z.enum(["absent", "stopped", "running", "unknown"]),
  port: z.number().int().min(1024).max(65535),
  url: z.string().max(100),
  contentVersion: version.nullable(),
  previousVersion: version.nullable(),
  canRollback: z.boolean(),
}).strict().superRefine((site, ctx) => {
  if (
    ![
      `http://127.0.0.1:${site.port}/`,
      `http://127.0.0.1:${site.port}`,
    ].includes(site.url)
  ) {
    ctx.addIssue({ code: "custom", message: "Invalid loopback demo URL" })
  }
  if (site.ownership === "none" && site.state !== "absent") {
    ctx.addIssue({ code: "custom", message: "Unowned runtime cannot be running" })
  }
  if (site.canRollback !== (site.previousVersion !== null)) {
    ctx.addIssue({ code: "custom", message: "Inconsistent rollback flag" })
  }
})

export const ownedSiteStateSchema = z.object({
  enabled: z.boolean(),
  site: ownedSiteSchema.nullable(),
}).strict()

export const ownedSiteLogsSchema = z.object({
  logs: z.array(z.string().max(300)).max(80),
}).strict()

export type OwnedSiteStateResponse = z.infer<typeof ownedSiteStateSchema>
export function parseOwnedSiteState(data: unknown): OwnedSiteStateResponse {
  return ownedSiteStateSchema.parse(data)
}
export function parseOwnedSiteLogs(data: unknown): string[] {
  return ownedSiteLogsSchema.parse(data).logs.slice(-25)
}
