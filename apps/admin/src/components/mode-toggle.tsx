"use client"

import { Check, Layout, Monitor, Moon, Palette, RotateCcw, Sun } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useTheme } from "@/hooks/use-theme"
import { useCircularTransition } from "@/hooks/use-circular-transition"
import "./theme-customizer/circular-transition.css"

export type AppearanceTab = "theme" | "layout"

interface ModeToggleProps {
  variant?: "outline" | "ghost" | "default"
  onCustomize?: (tab: AppearanceTab) => void
  onResetAppearance?: () => void
}

/** One header entry for theme mode, presets, layout and reset. */
export function ModeToggle({
  variant = "outline",
  onCustomize,
  onResetAppearance,
}: ModeToggleProps) {
  const { theme, setTheme } = useTheme()
  const { toggleTheme } = useCircularTransition()

  // Upstream landing route still uses the original quick switch with a variant.
  // The admin header supplies the callbacks and gets the complete appearance menu.
  if (!onCustomize || !onResetAppearance) {
    return (
      <Button
        variant={variant}
        size="icon"
        onClick={toggleTheme}
        aria-label="Switch color mode"
        className="cursor-pointer mode-toggle-button relative overflow-hidden"
      >
        {theme === "dark" ? (
          <Sun className="size-[1.2rem]" />
        ) : (
          <Moon className="size-[1.2rem]" />
        )}
      </Button>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant={variant}
            size="icon"
            className="cursor-pointer"
            aria-label="Appearance settings"
            title="Appearance settings"
          />
        }
      >
        {theme === "dark" ? (
          <Moon className="size-[1.2rem]" />
        ) : theme === "light" ? (
          <Sun className="size-[1.2rem]" />
        ) : (
          <Monitor className="size-[1.2rem]" />
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-52">
        <DropdownMenuLabel>Appearance</DropdownMenuLabel>
        <DropdownMenuItem onClick={() => setTheme("light")}>
          <Sun />
          Light
          {theme === "light" && <Check className="ml-auto" />}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")}>
          <Moon />
          Dark
          {theme === "dark" && <Check className="ml-auto" />}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("system")}>
          <Monitor />
          System
          {theme === "system" && <Check className="ml-auto" />}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => onCustomize("theme")}>
          <Palette />
          Colors & themes
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onCustomize("layout")}>
          <Layout />
          Panel layout
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onResetAppearance}>
          <RotateCcw />
          Reset appearance
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
