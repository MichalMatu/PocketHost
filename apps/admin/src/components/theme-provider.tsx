"use client"

import * as React from "react"
import { ThemeProviderContext } from "@/contexts/theme-context"

type Theme = "dark" | "light" | "system"

type ThemeProviderProps = {
  children: React.ReactNode
  defaultTheme?: Theme
  storageKey?: string
}

export function ThemeProvider({
  children,
  defaultTheme = "system",
  storageKey = "vite-ui-theme",
  ...props
}: ThemeProviderProps) {
  const [theme, setTheme] = React.useState<Theme>(
    () => (localStorage.getItem(storageKey) as Theme) || defaultTheme
  )

  React.useEffect(() => {
    const root = window.document.documentElement
    const systemPreference = window.matchMedia("(prefers-color-scheme: dark)")

    const applySelectedMode = () => {
      root.classList.remove("light", "dark")
      root.classList.add(
        theme === "system"
          ? systemPreference.matches
            ? "dark"
            : "light"
          : theme
      )
    }

    applySelectedMode()
    if (theme === "system") {
      systemPreference.addEventListener("change", applySelectedMode)
      return () => systemPreference.removeEventListener("change", applySelectedMode)
    }
  }, [theme])

  const value = {
    theme,
    setTheme: (theme: Theme) => {
      localStorage.setItem(storageKey, theme)
      setTheme(theme)
    },
  }

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  )
}
