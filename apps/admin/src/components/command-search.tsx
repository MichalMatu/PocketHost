"use client"

import { useNavigate } from "react-router-dom"
import { Search } from "lucide-react"
import { navGroups } from "@/config/navigation"
import { Button } from "@/components/ui/button"
import {
  Command, CommandDialog, CommandEmpty, CommandGroup,
  CommandInput, CommandItem, CommandList,
} from "@/components/ui/command"
import { Kbd } from "@/components/ui/kbd"

interface CommandSearchProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Only real PocketHost pages, shared with the sidebar. Template routes remain direct-URL only. */
const groups = navGroups.map(group => ({
  label: group.label,
  items: group.items.filter(item => item.url.startsWith("/") && !item.items),
})).filter(group => group.items.length > 0)

export function CommandSearch({ open, onOpenChange }: CommandSearchProps) {
  const navigate = useNavigate()
  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}
      title="PocketHost search" description="Search active PocketHost pages"
      className="sm:max-w-[640px]">
      <Command>
        <CommandInput placeholder="Find a PocketHost page…" autoFocus />
        <CommandList className="max-h-[400px]">
          <CommandEmpty>No matching PocketHost page.</CommandEmpty>
          {groups.map(group => <CommandGroup key={group.label} heading={group.label}>
            {group.items.map(item => {
              const Icon = item.icon
              return <CommandItem key={item.url} value={item.title}
                onSelect={() => { navigate(item.url); onOpenChange(false) }}>
                {Icon && <Icon aria-hidden="true" />}
                {item.title}
              </CommandItem>
            })}
          </CommandGroup>)}
        </CommandList>
      </Command>
    </CommandDialog>
  )
}

export function SearchTrigger({ onClick }: { onClick: () => void }) {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onClick}
      className="relative w-full justify-start font-normal text-muted-foreground sm:pr-12 md:w-36 lg:w-56"
    >
      <Search data-icon="inline-start" />
      Search...
      <Kbd className="absolute top-1/2 right-1.5 hidden -translate-y-1/2 sm:inline-flex">
        ⌘K
      </Kbd>
    </Button>
  )
}
