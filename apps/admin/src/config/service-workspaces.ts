import {
  Bot, Cloud, Radio, Shield,
} from "lucide-react"

/** Generic host capabilities, never a catalog of the owner's hosted apps.
 * Dynamically discovered services are rendered through the runit inventory.
 * A page is a read-only view, not a claim of process ownership.
 */
export const serviceWorkspaces = [
  {
    id: "local-agent", kind: "independent",
    title: "Local Agent", url: "/local-agent",
    description: "Dedicated Termux Local Agent supervisor and sanitized logs",
    icon: Bot,
  },
  {
    id: "cloudflare", kind: "diagnostic",
    title: "Cloudflare Tunnel", url: "/services/cloudflare",
    description: "Tunnel state and sanitized configuration",
    icon: Cloud,
  },
  {
    id: "ssh", kind: "diagnostic",
    title: "SSH", url: "/services/ssh",
    description: "Dedicated A8 SSH controls, terminal, profiles and protected sshd diagnostics",
    icon: Shield,
  },
  {
    id: "mqtt", kind: "diagnostic",
    title: "Mosquitto MQTT", url: "/services/mqtt",
    description: "Protected broker diagnostics",
    icon: Radio,
  },
] as const

export type DiagnosticServiceId = Extract<
  (typeof serviceWorkspaces)[number],
  { kind: "diagnostic" }
>["id"]

export const diagnosticServices = serviceWorkspaces.filter(
  (item): item is Extract<(typeof serviceWorkspaces)[number], { kind: "diagnostic" }> =>
    item.kind === "diagnostic",
)
