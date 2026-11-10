import {
  Activity, AlertTriangle, Archive, Bot, FolderOpen, Globe2, HelpCircle, History, LayoutDashboard, LayoutTemplate,
  Mail, Network, Package, ScrollText, ServerCog, Settings,
  Shield, Smartphone, Terminal,
} from "lucide-react"

/** System management is primary; hosting and AI are separate capabilities. */
export const navGroups = [
  {
    label: "System",
    items: [
      { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
      { title: "Monitoring", url: "/observability", icon: Activity },
      { title: "Observed host inventory", url: "/host", icon: ServerCog },
      { title: "Android & Shizuku", url: "/shizuku", icon: Smartphone },
      { title: "Phone Settings", url: "/phone-settings", icon: Settings },
      { title: "Packages & Software", url: "/packages", icon: Package },
      { title: "File Manager", url: "/files", icon: FolderOpen },
      { title: "Services & Processes", url: "/services", icon: ServerCog },
      { title: "Terminal", url: "/terminal", icon: Terminal },
      { title: "Backups & Recovery", url: "/backups", icon: Archive },
    ],
  },
  {
    label: "Hosting",
    items: [
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
      { title: "Logs & Diagnostics", url: "/runtime-logs", icon: ScrollText },
      { title: "Appearance", url: "/settings/appearance", icon: Settings },
    ],
  },
  {
    label: "Examples",
    items: [
      {
        title: "Dashboard examples", url: "#", icon: LayoutTemplate,
        items: [
          { title: "Framework dashboard", url: "/examples/dashboard" },
          { title: "Dashboard 2", url: "/dashboard-2" },
        ],
      },
      {
        title: "Template apps", url: "#", icon: Mail,
        items: [
          { title: "Mail", url: "/mail" },
          { title: "Tasks", url: "/tasks" },
          { title: "Chat", url: "/chat" },
          { title: "Calendar", url: "/calendar" },
          { title: "Users", url: "/users" },
        ],
      },
      {
        title: "Template pages", url: "#", icon: HelpCircle,
        items: [
          { title: "Landing", url: "/landing" },
          { title: "FAQs", url: "/faqs" },
          { title: "Pricing", url: "/pricing" },
          { title: "User settings", url: "/settings/user" },
          { title: "Account settings", url: "/settings/account" },
          { title: "Billing", url: "/settings/billing" },
          { title: "Notifications", url: "/settings/notifications" },
          { title: "Connections", url: "/settings/connections" },
        ],
      },
      {
        title: "Auth Pages", url: "#", icon: Shield,
        items: [
          { title: "Sign In 1", url: "/auth/sign-in" },
          { title: "Sign In 2", url: "/auth/sign-in-2" },
          { title: "Sign In 3", url: "/auth/sign-in-3" },
          { title: "Sign Up 1", url: "/auth/sign-up" },
          { title: "Sign Up 2", url: "/auth/sign-up-2" },
          { title: "Sign Up 3", url: "/auth/sign-up-3" },
          { title: "Forgot Password 1", url: "/auth/forgot-password" },
          { title: "Forgot Password 2", url: "/auth/forgot-password-2" },
          { title: "Forgot Password 3", url: "/auth/forgot-password-3" },
        ],
      },
      {
        title: "Errors", url: "#", icon: AlertTriangle,
        items: [
          { title: "Unauthorized", url: "/errors/unauthorized" },
          { title: "Forbidden", url: "/errors/forbidden" },
          { title: "Not Found", url: "/errors/not-found" },
          { title: "Internal Server Error", url: "/errors/internal-server-error" },
          { title: "Under Maintenance", url: "/errors/under-maintenance" },
        ],
      },
    ],
  },
]
