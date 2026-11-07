import { z } from "zod"

const siteId = z.string().regex(/^site-[a-f0-9]{32}$/)
const revision = z.string().regex(/^r-[a-f0-9]{32}$/)
const deployment = z.object({
  at: z.string().max(40),
  action: z.enum(["publish", "rollback"]),
  from: revision.nullable(),
  to: revision,
}).strict()

export const fleetSiteSchema = z.object({
  id: siteId,
  name: z.string().min(2).max(60),
  kind: z.literal("static-site"),
  state: z.enum(["stopped", "running", "unknown"]),
  port: z.number().int().min(1024).max(65535),
  activeRelease: revision.nullable(),
  previousRelease: revision.nullable(),
  canRollback: z.boolean(),
  pid: z.number().int().min(2).nullable(),
  startTicks: z.string().regex(/^\d+$/).max(40).nullable(),
  fileCount: z.number().int().min(0).max(100),
  bytes: z.number().int().min(0).max(8 * 1024 * 1024),
  releases: z.number().int().min(0).max(16),
  memoryBytes: z.number().int().min(0).nullable(),
  uptimeSeconds: z.number().int().min(0).nullable(),
  healthy: z.boolean().nullable(),
  history: z.array(deployment).max(25),
}).strict().superRefine((site, ctx) => {
  if (site.canRollback !== (site.previousRelease !== null)) {
    ctx.addIssue({ code: "custom", message: "Inconsistent rollback state" })
  }
  if (site.state !== "running" && (site.pid !== null || site.startTicks !== null)) {
    ctx.addIssue({ code: "custom", message: "Unverified process identity" })
  }
  if ((site.pid === null) !== (site.startTicks === null)) {
    ctx.addIssue({ code: "custom", message: "Incomplete process identity" })
  }
  if (site.state === "running" && site.activeRelease === null) {
    ctx.addIssue({ code: "custom", message: "Running site without owned release" })
  }
})

export type FleetSite = z.infer<typeof fleetSiteSchema>

export function parseFleetSites(value: unknown): FleetSite[] {
  return z.object({ sites: z.array(fleetSiteSchema).max(8) }).strict().parse(value).sites
}

export function parseFleetSite(value: unknown): FleetSite {
  return z.object({ site: fleetSiteSchema }).strict().parse(value).site
}

export function parseFleetLogs(value: unknown): string[] {
  return z.object({
    logs: z.array(z.string().max(200)).max(25),
  }).strict().parse(value).logs
}

export function parseFleetHealth(value: unknown): boolean {
  return z.object({ healthy: z.boolean() }).strict().parse(value).healthy
}
