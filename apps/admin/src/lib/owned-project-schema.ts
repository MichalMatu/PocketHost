import { z } from "zod"

const demoVersion = z.union([z.literal(1), z.literal(2)])
export const deploymentSchema = z.object({
  at: z.string().max(40),
  action: z.enum(["create", "publish", "rollback"]),
  from: demoVersion.nullable(),
  to: demoVersion,
}).strict()

export const ownedProjectSchema = z.object({
  id: z.literal("pockethost-demo"),
  name: z.literal("PocketHost Demo"),
  description: z.string().max(180),
  type: z.literal("static-html"),
  dataDirectory: z.literal("PocketHost-OwnedSites/pockethost-demo"),
  state: z.enum(["absent", "stopped", "running", "unknown"]),
  port: z.number().int().min(1024).max(65535),
  url: z.string().max(100),
  contentVersion: demoVersion.nullable(),
  previousVersion: demoVersion.nullable(),
  pid: z.number().int().min(2).nullable(),
  startTicks: z.string().regex(/^\d+$/).max(40).nullable(),
  history: z.array(deploymentSchema).max(25),
}).strict().superRefine((project, ctx) => {
  if (project.url !== `http://127.0.0.1:${project.port}/`) {
    ctx.addIssue({ code: "custom", message: "Expected a fixed local-only address" })
  }
  if (project.state !== "running" && (project.pid !== null || project.startTicks !== null)) {
    ctx.addIssue({ code: "custom", message: "Unverified process must not expose a PID" })
  }
  if ((project.pid === null) !== (project.startTicks === null)) {
    ctx.addIssue({ code: "custom", message: "Incomplete process identity" })
  }
})

export type OwnedProject = z.infer<typeof ownedProjectSchema>

export function parseOwnedProject(value: unknown): OwnedProject {
  return z.object({ project: ownedProjectSchema }).strict().parse(value).project
}

export function parseOwnedHealth(value: unknown): boolean {
  return z.object({ healthy: z.boolean() }).strict().parse(value).healthy
}
