import {
  Activity, Archive, Bot, Boxes, FolderOpen, Globe2, HeartPulse, GitBranch,
  History, LayoutDashboard, ListTree, Network, Package, Plus, Power,
  ScrollText, ServerCog, Settings, Smartphone, Terminal,
} from "lucide-react"
import { serviceWorkspaces } from "@/config/service-workspaces"

/** PocketHost operator navigation only; framework showcase pages are removed. */
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
      { title: "Hosting overview", url: "/hosting", icon: ServerCog },
      { title: "Static websites", url: "/sites", icon: Globe2 },
      { title: "Add website", url: "/sites/new", icon: Plus },
      { title: "Node.js applications", url: "/projects", icon: FolderOpen },
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
      ...serviceWorkspaces.filter(({ kind }) => kind === "diagnostic")
        .map(({ title, url, icon }) => ({ title, url, icon })),
    ],
  },
  {
    label: "Local Agent",
    items: serviceWorkspaces.filter(({ kind }) => kind === "independent")
      .map(({ title, url, icon }) => ({ title, url, icon })),
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
      { title: "Platform", url: "/settings/platform", icon: GitBranch },
      { title: "Network access", url: "/settings/network", icon: Network },
      { title: "Appearance", url: "/settings/appearance", icon: Settings },
    ],
  },
]
