import {
  Activity, Archive, Bot, Boxes, FolderOpen, Globe2, HeartPulse,
  History, LayoutDashboard, ListTree, Network, Package, Power,
  ScrollText, ServerCog, Settings, Smartphone, Terminal,
} from "lucide-react"
import { serviceWorkspaces } from "@/config/service-workspaces"

/**
 * PocketHost-only sidebar ordered by daily operator workflow.
 * Upstream CMS/template examples keep their routes but stay out of
 * the production navigation. An individual service page never
 * implies lifecycle ownership or authorizes adoption.
 */
export const navGroups = [
  {
    label: "Overview",
    items: [
      { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
      { title: "Monitoring", url: "/observability", icon: Activity },
      { title: "Host inventory", url: "/host", icon: ServerCog },
    ],
  },
  {
    label: "Hosting",
    items: [
      { title: "Websites", url: "/sites", icon: Globe2 },
      { title: "Projects", url: "/projects", icon: FolderOpen },
      { title: "Deployments", url: "/deployments", icon: History },
      { title: "Project logs", url: "/runtime-logs", icon: ScrollText },
    ],
  },
  {
    label: "Services",
    items: [
      { title: "Overview", url: "/services", icon: ServerCog },
      { title: "Runit services", url: "/services/runit", icon: ListTree },
      { title: "Autostart", url: "/services/autostart", icon: Power },
      { title: "Hosting workloads", url: "/services/hosting", icon: Boxes },
      { title: "Health checks", url: "/services/health", icon: HeartPulse },
      ...serviceWorkspaces.map(({ title, url, icon }) => ({ title, url, icon })),
    ],
  },
  {
    label: "System & Tools",
    items: [
      { title: "Android & Shizuku", url: "/shizuku", icon: Smartphone },
      { title: "Phone Settings", url: "/phone-settings", icon: Settings },
      { title: "Packages & Software", url: "/packages", icon: Package },
      { title: "File Manager", url: "/files", icon: FolderOpen },
      { title: "Terminal", url: "/terminal", icon: Terminal },
      { title: "Backups & Recovery", url: "/backups", icon: Archive },
    ],
  },
  {
    label: "Automation",
    items: [
      { title: "Agents & API", url: "/agents", icon: Bot },
    ],
  },
  {
    label: "Settings",
    items: [
      { title: "Network access", url: "/settings/network", icon: Network },
      { title: "Appearance", url: "/settings/appearance", icon: Settings },
    ],
  },
]
