import { z } from "zod"

export const h3ToolsSchema = z.object({
  version: z.literal(1),
  mode: z.literal("read-only"),
  tools: z.array(z.object({
    id: z.enum(["restic", "ttyd", "cloudcmd", "termux-api"]),
    purpose: z.enum(["backup", "terminal", "files", "android"]),
    state: z.enum(["detected", "not-detected", "unavailable"]),
  }).strict()).length(4),
}).strict()

export const h3FilesSchema = z.object({
  files: z.array(z.object({
    name: z.string().min(1).max(180)
      .refine(name => !name.startsWith("/") && !name.includes("\\") &&
        name.split("/").every(part => part && part !== "." && part !== ".." && !part.startsWith("."))),
    bytes: z.number().int().min(0).max(2 * 1024 * 1024),
  }).strict()).max(100),
}).strict().superRefine((data, ctx) => {
  const names = new Set(data.files.map(item => item.name.toLowerCase()))
  if (names.size !== data.files.length) ctx.addIssue({ code: "custom", message: "Duplicate assets" })
})

export type H3Tools = z.infer<typeof h3ToolsSchema>
export type H3Files = z.infer<typeof h3FilesSchema>["files"]

export function parseH3Tools(input: unknown): H3Tools {
  return h3ToolsSchema.parse(input)
}
export function parseH3Files(input: unknown): H3Files {
  return h3FilesSchema.parse(input).files
}
