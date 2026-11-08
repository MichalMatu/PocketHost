import * as React from "react"
import { Link } from "react-router-dom"
import { Logo } from "@/components/logo"
import { NavMain } from "@/components/nav-main"
import { navGroups } from "@/config/navigation"
import {
  Sidebar, SidebarContent, SidebarHeader, SidebarMenu,
  SidebarMenuButton, SidebarMenuItem,
} from "@/components/ui/sidebar"

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
