import { z } from "zod"

// P4 catalog is intentionally PhotoMap-specific and read-only.
// Future app management uses the generic registered runtime contract, not this shape.
export const managedPhotoMapProjectSchema = z.object({
  version: z.literal(1),
  id: z.literal("photomap-test"),
  label: z.literal("PhotoMap TEST"),
  ownership: z.enum(["none", "pockethost"]),
  importState: z.enum(["absent", "verified-copy"]),
  runtimeState: z.enum(["disabled", "unknown"]),
  release: z.string().regex(/^[a-z0-9][a-z0-9-]{1,63}$/).nullable(),
  port: z.literal(8010),
  tools: z.array(z.object({
    name: z.enum(["node", "npm", "git", "python3", "proot", "proot-distro"]),
    state: z.enum(["available", "unavailable"]),
    version: z.string().max(128).nullable(),
  }).strict()).max(6),
  lockfiles: z.array(z.object({
    path: z.string().min(1).max(256).refine((x) => !x.startsWith("/") && !x.split("/").includes("..")),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
  }).strict()).max(40),
  data: z.object({
    databaseBytes: z.number().int().nonnegative(),
    privateMediaFiles: z.number().int().nonnegative(),
    publicMediaFiles: z.number().int().nonnegative(),
  }).strict().nullable(),
  dependencies: z.object({
    prootEnvironment: z.literal("external-unfrozen"),
    isolatedRollback: z.literal(false),
  }).strict().nullable(),
  capabilities: z.object({
    startStop: z.literal(false),
    packages: z.literal(false),
    rollback: z.literal(false),
  }).strict(),
}).strict()

const legacyRuntimeEvent = z.object({
  timestamp: z.string().datetime({ offset: true }),
  instanceId: z.literal("photomap-test"),
  code: z.enum([
    "manual-start-requested",
    "manual-start-health-failed",
    "manual-stop-completed",
    "manual-stop-uncertain",
  ]),
}).strict()

export const legacyPhotoMapEventsSchema = z.object({
  state: z.enum(["ok", "unavailable"]),
  events: z.array(legacyRuntimeEvent).max(20),
}).strict().refine(
  value => value.state === "ok" || value.events.length === 0,
  "Unavailable diagnostics must not contain events",
)

export type LegacyPhotoMapEventResponse = z.infer<typeof legacyPhotoMapEventsSchema>

export function parseLegacyPhotoMapEvents(input: unknown): LegacyPhotoMapEventResponse {
  return legacyPhotoMapEventsSchema.parse(input)
}

export type ManagedPhotoMapProject = z.infer<typeof managedPhotoMapProjectSchema>
export function parseManagedPhotoMapResponse(data: unknown): ManagedPhotoMapProject {
  return z.object({ project: managedPhotoMapProjectSchema }).strict().parse(data).project
}
