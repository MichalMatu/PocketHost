import {
  Activity, Archive, Bot, FolderOpen, Globe2, History, LayoutDashboard,
  Network, Package, ScrollText, ServerCog, Settings, Smartphone, Terminal,
} from "lucide-react"

/** System management is primary; hosting and AI are separate capabilities. */
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
      { title: "Services", url: "/services", icon: ServerCog },
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
]
