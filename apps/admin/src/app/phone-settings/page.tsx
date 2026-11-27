import * as React from "react"
import { ChevronDown, RefreshCw } from "lucide-react"
import { BaseLayout } from "@/components/layouts/base-layout"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AndroidActionButton } from "@/app/shizuku/android-action-button"
import { BrightnessModeControl } from "./brightness-mode-control"
import {
  parseShizukuStatus, parseShizukuSystem,
  type ShizukuStatus, type ShizukuSystem,
} from "@/lib/shizuku-schema"

const timeoutOptions = [
  { value: "15000", label: "15 seconds" },
  { value: "30000", label: "30 seconds" },
  { value: "60000", label: "1 minute" },
  { value: "120000", label: "2 minutes" },
  { value: "300000", label: "5 minutes" },
  { value: "600000", label: "10 minutes" },
  { value: "1800000", label: "30 minutes" },
  { value: "3600000", label: "60 minutes" },
]

function timeoutLabel(ms: number | null | undefined) {
  if (ms == null) return "Unavailable"
  if (ms >= 60000 && ms % 60000 === 0) return ms / 60000 + " min"
  return ms % 1000 === 0 ? ms / 1000 + " sec" : ms + " ms"
}

async function readSnapshot(url: string, signal: AbortSignal): Promise<unknown> {
  const response = await fetch(url, {
    method: "GET", cache: "no-store", credentials: "same-origin", signal,
  })
  if (!response.ok) throw new Error("HTTP " + response.status)
  return response.json() as Promise<unknown>
}

export default function PhoneSettingsPage() {
  const [status, setStatus] = React.useState<ShizukuStatus | null>(null)
  const [system, setSystem] = React.useState<ShizukuSystem | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [refreshKey, setRefreshKey] = React.useState(0)
  const [brightnessDraft, setBrightnessDraft] = React.useState("")
  const [timeoutDraft, setTimeoutDraft] = React.useState("")

  React.useEffect(() => {
    const controller = new AbortController()
    const signal = controller.signal
    const load = async () => {
      let readingSettings = false
      try {
        const verified = parseShizukuStatus(await readSnapshot(
          "/api/v1/shizuku/status",
          AbortSignal.any([signal, AbortSignal.timeout(8000)]),
        ))
        if (signal.aborted) return
        setStatus(verified)
        if (!verified.connected) {
          setError("PocketHost Companion is disconnected. Check it on the phone and refresh.")
          return
        }
        if (!verified.authorized) {
          setError("PocketHost Companion is connected but needs Shizuku authorization on the phone.")
          return
        }
        readingSettings = true
        // Existing typed snapshot includes settings; future Companion versions can
        // expose a smaller settings-only endpoint without changing these controls.
        const snapshot = parseShizukuSystem(await readSnapshot(
          "/api/v1/shizuku/system",
          AbortSignal.any([signal, AbortSignal.timeout(15000)]),
        ))
        if (!signal.aborted) setSystem(snapshot)
      } catch {
        if (!signal.aborted) setError(readingSettings
          ? "Could not read current Android display settings. Any previous values below are not verified."
          : "Could not verify the Android bridge API. This does not establish whether Shizuku is installed.")
      } finally {
        if (!signal.aborted) setLoading(false)
      }
    }
    void load()
    return () => controller.abort()
  }, [refreshKey])

  const connected = !loading && !error && status?.connected === true &&
    status.authorized === true && system != null
  const currentBrightness = system?.settings.brightness ?? null
  const currentTimeout = system?.settings.screenTimeoutMs ?? null
  const sample = system?.observedAt
  const selectedBrightness = brightnessDraft || String(currentBrightness ?? 128)
  const connectionLabel = loading ? "Checking Android bridge"
    : status === null ? "Bridge not verified"
    : !status.connected ? "Companion disconnected"
    : !status.authorized ? "Authorization required"
    : connected ? "Shizuku authorized" : "Settings not verified"
  const currentLabel = connected ? "Current" : "Last reported"

  function refreshValues() {
    setLoading(true)
    setError(null)
    setStatus(null)
    setRefreshKey(key => key + 1)
  }
  function brightnessSaved() {
    setBrightnessDraft("")
    refreshValues()
  }
  function timeoutSaved() {
    setTimeoutDraft("")
    refreshValues()
  }

  return (
    <BaseLayout title="Phone Settings" description="Android display controls through the authorized Shizuku Companion">
      <div className="space-y-5 px-4 pb-8 lg:px-6">
        <div className="flex min-h-10 flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <Badge variant="outline">{connectionLabel}</Badge>
            <Badge variant="outline">{sample
              ? (connected ? "Checked " : "Previous sample ") + new Date(sample).toLocaleTimeString()
              : "No verified sample"}</Badge>
            {system?.settings.airplaneMode != null && <Badge variant="outline">
              Airplane mode: {system.settings.airplaneMode ? "On" : "Off"}
            </Badge>}
          </div>
          <Button type="button" variant="outline" className="shrink-0"
            disabled={loading} onClick={refreshValues}>
            <RefreshCw className={loading ? "size-4 animate-spin" : "size-4"} /> Refresh
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Display & screen</CardTitle>
            <CardDescription role={error ? "alert" : "status"}
              className={error && status?.connected && status.authorized ? "min-h-5 text-destructive" : "min-h-5"}>
              {error || (loading ? "Checking the Android connection and display settings…" :
                "Brightness and screen timeout require a verified, authorized Android Companion.")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid items-stretch gap-4 lg:grid-cols-2">
              <section className="flex min-w-0 flex-col gap-4 rounded-lg border p-4">
                <div className="space-y-1">
                  <h3 className="font-medium">Brightness</h3>
                  <p className="text-xs text-muted-foreground">Adjust the stored display brightness level.</p>
                </div>
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">{currentLabel}:{" "}
                    <span className="font-medium tabular-nums text-foreground">
                      {currentBrightness == null ? "Not verified" : currentBrightness + " / 255"}
                    </span>
                  </p>
                  <label className="block text-sm" htmlFor="android-brightness">
                    Brightness to set: <span className="font-medium tabular-nums">{selectedBrightness} / 255</span>
                  </label>
                  <input id="android-brightness" aria-label="Set screen brightness"
                    type="range" min={0} max={255} step={1} value={selectedBrightness}
                    className="block h-9 w-full accent-foreground disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={!connected} onChange={event => setBrightnessDraft(event.target.value)} />
                  {brightnessDraft !== "" && connected &&
                    <AndroidActionButton action="brightness" value={brightnessDraft}
                      onSuccess={brightnessSaved}>Save brightness</AndroidActionButton>}
                </div>
                <BrightnessModeControl connected={connected} onValuesChanged={refreshValues} />
                <p className="mt-auto text-xs text-muted-foreground">
                  Adaptive brightness can override the stored level. The Companion reports
                  a saved value, not measured screen luminance.
                </p>
              </section>

              <section className="flex min-w-0 flex-col gap-4 rounded-lg border p-4">
                <div className="space-y-1">
                  <h3 className="font-medium">Screen timeout</h3>
                  <p className="text-xs text-muted-foreground">Choose how long the display stays on while idle.</p>
                </div>
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">{currentLabel}:{" "}
                    <span className="font-medium text-foreground">{currentTimeout == null
                      ? "Not verified" : timeoutLabel(currentTimeout)}</span>
                  </p>
                  <label htmlFor="android-timeout" className="block text-sm">New timeout</label>
                  <div className="relative">
                    <select id="android-timeout" aria-label="Set screen timeout"
                      className="h-9 w-full appearance-none rounded-lg border border-input bg-background px-3 pr-9 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30"
                      value={timeoutDraft} disabled={!connected}
                      onChange={event => setTimeoutDraft(event.target.value)}>
                      <option value="">Choose a timeout</option>
                      {timeoutOptions.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
                    </select>
                    <ChevronDown aria-hidden="true" className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground" />
                  </div>
                  {timeoutDraft !== "" && connected &&
                    <AndroidActionButton action="timeout" value={timeoutDraft}
                      onSuccess={timeoutSaved}>Save timeout</AndroidActionButton>}
                </div>
                <p className="mt-auto text-xs text-muted-foreground">
                  Selecting a timeout does not change the phone until you choose Save timeout.
                  Android may enforce its own limits.
                </p>
              </section>
            </div>
          </CardContent>
        </Card>
      </div>
    </BaseLayout>
  )
}
