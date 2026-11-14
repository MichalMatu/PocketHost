import {
  Bot, Cloud, FolderOpen, Globe2, HeartPulse, Radio, Shield,
} from "lucide-react"

/** One source for Services navigation, search, index and page metadata.
 * A page is an isolated read-only view, not a claim of process ownership.
 */
export const serviceWorkspaces = [
  {
    id: "local-agent", kind: "independent",
    title: "Local Agent", url: "/local-agent",
    description: "Dedicated Termux Local Agent supervisor and sanitized logs",
    icon: Bot,
  },
  {
    id: "ilestoi", kind: "diagnostic",
    title: "IleStoi", url: "/services/ilestoi",
    description: "Application health and redacted service logs",
    icon: Globe2,
  },
  {
    id: "healthwatch", kind: "diagnostic",
    title: "IleStoi Healthwatch", url: "/services/healthwatch",
    description: "Protected healthwatch diagnostics",
    icon: HeartPulse,
  },
  {
    id: "photomap", kind: "independent",
    title: "PhotoMap (test)", url: "/services/photomap",
    description: "Isolated read-only PhotoMap TEST inventory",
    icon: FolderOpen,
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
    description: "Protected SSH service diagnostics",
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
