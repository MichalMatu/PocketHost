import {
  Activity, Archive, Bot, Cloud, FolderOpen, Globe2, HeartPulse, History,
  LayoutDashboard, Network, Package, Radio, ScrollText, ServerCog, Settings,
  Shield, Smartphone, Terminal,
} from "lucide-react"

/** Individual service pages do not imply service ownership. */
export const navGroups = [
  {
    label: "System",
    items: [
      { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
      { title: "Monitoring", url: "/observability", icon: Activity },
      { title: "Android & Shizuku", url: "/shizuku", icon: Smartphone },
      { title: "Phone Settings", url: "/phone-settings", icon: Settings },
      { title: "Packages & Software", url: "/packages", icon: Package },
      { title: "File Manager", url: "/files", icon: FolderOpen },
      { title: "Terminal", url: "/terminal", icon: Terminal },
      { title: "Backups & Recovery", url: "/backups", icon: Archive },
    ],
  },
  {
    label: "Hosting",
    items: [
      { title: "Observed host inventory", url: "/host", icon: ServerCog },
      { title: "Websites", url: "/sites", icon: Globe2 },
      { title: "Projects", url: "/projects", icon: FolderOpen },
      { title: "Deployments", url: "/deployments", icon: History },
    ],
  },
  {
    label: "Automation",
    items: [{ title: "Agents & API", url: "/agents", icon: Bot }],
  },
  {
    label: "Platform",
    items: [
      { title: "Network access", url: "/settings/network", icon: Network },
      { title: "Project logs", url: "/runtime-logs", icon: ScrollText },
      { title: "Appearance", url: "/settings/appearance", icon: Settings },
    ],
  },
  {
    label: "Services",
    items: [
      { title: "All services", url: "/services", icon: ServerCog },
      { title: "Local Agent", url: "/local-agent", icon: Bot },
      { title: "IleStoi", url: "/services/ilestoi", icon: Globe2 },
      { title: "IleStoi Healthwatch", url: "/services/healthwatch", icon: HeartPulse },
      { title: "PhotoMap (test)", url: "/services/photomap", icon: FolderOpen },
      { title: "Cloudflare Tunnel", url: "/services/cloudflare", icon: Cloud },
      { title: "SSH", url: "/services/ssh", icon: Shield },
      { title: "Mosquitto MQTT", url: "/services/mqtt", icon: Radio },
    ],
  },
]
