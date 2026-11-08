import * as React from "react"
import {
  Activity, AlertTriangle, Archive, Bot, Calendar, CheckSquare, FolderOpen, Globe2, HelpCircle, History, LayoutDashboard, LayoutTemplate,
  Mail, MessageCircle, Network, Package, ScrollText, ServerCog, Settings,
  Shield, Terminal, Users,
} from "lucide-react"
import { Link } from "react-router-dom"
import { Logo } from "@/components/logo"
import { NavMain } from "@/components/nav-main"
import {
  Sidebar, SidebarContent, SidebarHeader, SidebarMenu,
  SidebarMenuButton, SidebarMenuItem,
} from "@/components/ui/sidebar"

/** System management is primary; hosting and AI are separate capabilities. */
export const navGroups = [
  {
    label: "System",
    items: [
      { title: "Dashboard", url: "/system", icon: LayoutDashboard },
      { title: "Monitoring", url: "/observability", icon: Activity },
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
      { title: "Deployments", url: "/deployments", icon: History },
      { title: "Hosting overview", url: "/host", icon: ServerCog },
      { title: "Demo project", url: "/owned-site", icon: Globe2 },
      { title: "Managed projects", url: "/managed-projects", icon: ServerCog },
      { title: "Network access", url: "/settings/network", icon: Network },
    ],
  },
  {
    label: "Automation",
    items: [{ title: "Agents & API", url: "/agents", icon: Bot }],
  },
  {
    label: "Platform",
    items: [
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
          { title: "Dashboard 1", url: "/dashboard" },
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

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link to="/system" />}>
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Logo size={24} className="text-current" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">PocketHost</span>
                <span className="truncate text-xs">Termux Management</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        {navGroups.map(group => <NavMain key={group.label} label={group.label} items={group.items} />)}
      </SidebarContent>
    </Sidebar>
  )
}
