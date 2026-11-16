import {
  Activity, Archive, Bot, Boxes, FolderOpen, Globe2, HeartPulse, GitBranch,
  History, LayoutDashboard, ListTree, Network, Package, Power,
  ScrollText, ServerCog, Settings, Smartphone, Terminal,
} from "lucide-react"
import { serviceWorkspaces } from "@/config/service-workspaces"

/**
 * PocketHost-only sidebar ordered by daily operator workflow.
 * Upstream CMS/template examples are retained at the very bottom
 * as a separate, collapsed reference group. An individual service page never
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
      { title: "Platform", url: "/settings/platform", icon: GitBranch },
      { title: "Network access", url: "/settings/network", icon: Network },
      { title: "Appearance", url: "/settings/appearance", icon: Settings },
    ],
  },
  {
    label: "Framework / CMS examples",
    items: [
      {
        title: "Demo layouts", url: "/examples/dashboard", icon: LayoutDashboard,
        items: [
          { title: "Dashboard example", url: "/examples/dashboard" },
          { title: "Dashboard 2", url: "/dashboard-2" },
          { title: "Landing page", url: "/landing" },
        ],
      },
      {
        title: "App examples", url: "/mail", icon: FolderOpen,
        items: [
          { title: "Mail", url: "/mail" },
          { title: "Tasks", url: "/tasks" },
          { title: "Chat", url: "/chat" },
          { title: "Calendar", url: "/calendar" },
        ],
      },
      {
        title: "CMS / content examples", url: "/users", icon: Globe2,
        items: [
          { title: "Users", url: "/users" },
          { title: "FAQs", url: "/faqs" },
          { title: "Pricing", url: "/pricing" },
        ],
      },
      {
        title: "Settings examples", url: "/settings/user", icon: Settings,
        items: [
          { title: "User profile", url: "/settings/user" },
          { title: "Account", url: "/settings/account" },
          { title: "Billing", url: "/settings/billing" },
          { title: "Notifications", url: "/settings/notifications" },
          { title: "Connections", url: "/settings/connections" },
        ],
      },
      {
        title: "Auth Pages", url: "/auth/sign-in", icon: ServerCog,
        items: [
          { title: "Sign in", url: "/auth/sign-in" },
          { title: "Sign in 2", url: "/auth/sign-in-2" },
          { title: "Sign in 3", url: "/auth/sign-in-3" },
          { title: "Sign up", url: "/auth/sign-up" },
          { title: "Sign up 2", url: "/auth/sign-up-2" },
          { title: "Sign up 3", url: "/auth/sign-up-3" },
          { title: "Forgot password", url: "/auth/forgot-password" },
          { title: "Forgot password 2", url: "/auth/forgot-password-2" },
          { title: "Forgot password 3", url: "/auth/forgot-password-3" },
        ],
      },
      {
        title: "Errors", url: "/errors/unauthorized", icon: Activity,
        items: [
          { title: "Unauthorized", url: "/errors/unauthorized" },
          { title: "Forbidden", url: "/errors/forbidden" },
          { title: "Not found", url: "/errors/not-found" },
          { title: "Server error", url: "/errors/internal-server-error" },
          { title: "Maintenance", url: "/errors/under-maintenance" },
        ],
      },
    ],
  },

]
