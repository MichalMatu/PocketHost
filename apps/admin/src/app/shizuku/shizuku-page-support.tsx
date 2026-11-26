import { AppWindow, Cpu, Settings2, Terminal, Activity, Search, ExternalLink } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import type { ShizukuStatus } from "@/lib/shizuku-schema"
import type { Section } from "./shizuku-page-data"

const sections = [
  { id: "applications", label: "Apps & permissions", icon: AppWindow },
  { id: "processes", label: "Android processes", icon: Cpu },
  { id: "services", label: "Android services", icon: Settings2 },
  { id: "shell", label: "Android shell", icon: Terminal },
  { id: "diagnostics", label: "Diagnostics", icon: Activity },
] as const

/** Shared visual treatment for every Shizuku search field. */
export function SearchField({
  label, placeholder, value, onChange,
}: {
  label: string
  placeholder: string
  value: string
  onChange: (value: string) => void
}) {
  return <div className="relative min-w-0 flex-1">
    <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
    <Input aria-label={label} className="pl-9" placeholder={placeholder}
      value={value} onChange={event => onChange(event.target.value)} />
  </div>
}

export function LastSample({ observedAt }: { observedAt?: string }) {
  return <Badge variant="outline">
    {observedAt ? "Checked " + new Date(observedAt).toLocaleTimeString() : "No verified sample"}
  </Badge>
}

export function ShizukuNavigation({ section, onChange }: {
  section: Section
  onChange: (next: Section) => void
}) {
  return <div className="flex gap-2 overflow-x-auto pb-2" role="tablist" aria-label="Android modules">
          {sections.map((item, index) => {
            const Icon = item.icon
            return <Button key={item.id} id={"android-tab-" + item.id} role="tab"
              aria-controls="android-module-panel" aria-selected={section === item.id}
              tabIndex={section === item.id ? 0 : -1}
              className="shrink-0 whitespace-nowrap"
              variant={section === item.id ? "default" : "outline"}
              onKeyDown={event => {
                if (!["ArrowRight", "ArrowLeft", "Home", "End"].includes(event.key)) return
                event.preventDefault()
                const next = event.key === "Home" ? 0 :
                  event.key === "End" ? sections.length - 1 :
                    (index + (event.key === "ArrowRight" ? 1 : -1) + sections.length) % sections.length
                onChange(sections[next].id)
                document.getElementById("android-tab-" + sections[next].id)?.focus()
              }}
              onClick={() => onChange(item.id)}>
              <Icon className="size-4" />{item.label}
            </Button>
          })}
        </div>
}

export function ShizukuBridgeWarning({ status, reason }: {
  status: ShizukuStatus | null
  reason: string
}) {
  return <Card>
            <CardHeader><CardTitle>{!status ? "Android bridge unavailable" : !status.connected ? "Connect Shizuku" : "Authorize Companion"}</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>{reason}</p>
              <p>Install or start Shizuku and PocketHost Companion as needed, authorize access, then use Refresh. The browser cannot verify whether either app is installed.</p>
              <span>
              <a className={buttonVariants({ variant: "link", className: "underline" })}
                href="https://shizuku.rikka.app/guide/setup/" target="_blank" rel="noreferrer">
                Setup guide <ExternalLink className="size-3" />
              </a>
              </span>
            </CardContent>
          </Card>
}
