"use client"

import { BaseLayout } from "@/components/layouts/base-layout"
import { Button } from "@/components/ui/button"
import { useTheme } from "@/hooks/use-theme"

const themes = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
] as const

export default function AppearanceSettings() {
  const { theme, setTheme } = useTheme()

  return (
    <BaseLayout title="Appearance" description="Choose the panel color theme">
      <div className="px-4 pb-8 lg:px-6">
        <section aria-labelledby="appearance-theme" className="space-y-4 rounded-md border p-4">
          <div className="space-y-1">
            <h2 id="appearance-theme" className="text-sm font-semibold">Color theme</h2>
            <p className="text-xs text-muted-foreground">
              Changes apply immediately and are saved in this browser.
            </p>
          </div>
          <div role="group" aria-label="Color theme" className="flex flex-wrap gap-2">
            {themes.map(option => (
              <Button key={option.value} type="button"
                variant={theme === option.value ? "default" : "outline"}
                aria-pressed={theme === option.value}
                onClick={() => setTheme(option.value)}>
                {option.label}
              </Button>
            ))}
          </div>
        </section>
      </div>
    </BaseLayout>
  )
}
