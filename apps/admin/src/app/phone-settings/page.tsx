import * as React from "react"
import { RefreshCw } from "lucide-react"
import { BaseLayout } from "@/components/layouts/base-layout"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
      try {
        const verified = parseShizukuStatus(await readSnapshot(
          "/api/v1/shizuku/status",
          AbortSignal.any([signal, AbortSignal.timeout(8000)]),
        ))
        if (signal.aborted) return
        setStatus(verified)
        if (!verified.connected || !verified.authorized) {
          setError("Shizuku Companion is disconnected or not authorized.")
          return
        }
        // Existing typed snapshot includes settings; future Companion versions can
        // expose a smaller settings-only endpoint without changing these controls.
        const snapshot = parseShizukuSystem(await readSnapshot(
          "/api/v1/shizuku/system",
          AbortSignal.any([signal, AbortSignal.timeout(15000)]),
        ))
        if (!signal.aborted) setSystem(snapshot)
      } catch {
        if (!signal.aborted) setError("Could not verify Android settings. Last successful values remain visible.")
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

  function refreshValues() {
    setLoading(true)
    setError(null)
    setRefreshKey(key => key + 1)
  }

  return (
    <BaseLayout title="Phone Settings" description="Android display controls through the authorized Shizuku Companion">
      <div className="space-y-5 px-4 pb-8 lg:px-6">
        <div className="flex min-h-10 flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{loading ? "Checking Shizuku" : connected ? "Shizuku authorized" : "Shizuku unavailable"}</Badge>
            {sample && <Badge variant="outline">Checked {new Date(sample).toLocaleTimeString()}</Badge>}
            {system?.settings.airplaneMode != null && <Badge variant="outline">Airplane mode: {system.settings.airplaneMode ? "On" : "Off"}</Badge>}
          </div>
          <Button size="sm" variant="outline" disabled={loading} onClick={refreshValues}>
            <RefreshCw className={loading ? "size-4 animate-spin" : "size-4"} /> Refresh
          </Button>
        </div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <Card>
          <CardHeader>
            <CardTitle>Display & screen</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 lg:grid-cols-2">
              <section className="space-y-3 rounded-lg border p-4">
                <h3 className="font-medium">Brightness</h3>
                <BrightnessModeControl connected={connected} onValuesChanged={refreshValues} />
                <p className="min-h-5 text-sm text-muted-foreground">Current: <span className="font-medium tabular-nums">
                  {currentBrightness == null ? "Unavailable" : currentBrightness + " / 255"}
                </span></p>
                <label className="block text-sm" htmlFor="android-brightness">Requested brightness: {selectedBrightness} / 255</label>
                <input id="android-brightness" aria-label="Set screen brightness" type="range" min={0} max={255} step={1}
                  className="w-full accent-foreground" disabled={!connected} value={selectedBrightness}
                  onChange={event => setBrightnessDraft(event.target.value)} />
                {brightnessDraft !== "" && connected &&
                  <AndroidActionButton action="brightness" value={brightnessDraft}
                    onSuccess={refreshValues}>Save brightness</AndroidActionButton>}
                <p className="text-xs text-muted-foreground">
                  Check the mode above. Adaptive brightness can override saved levels.
                  The native bridge reports stored values, not physical screen luminance.
                </p>
              </section>
              <section className="space-y-3 rounded-lg border p-4">
                <h3 className="font-medium">Screen timeout</h3>
                <p className="min-h-5 text-sm text-muted-foreground">Current: {timeoutLabel(currentTimeout)}</p>
                <label htmlFor="android-timeout" className="block text-sm">New timeout</label>
                <select id="android-timeout" aria-label="Set screen timeout"
                  className="bg-background w-full rounded-md border px-3 py-2 text-sm"
                  value={timeoutDraft} disabled={!connected}
                  onChange={event => setTimeoutDraft(event.target.value)}>
                  <option value="">Choose a timeout</option>
                  {timeoutOptions.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
                {timeoutDraft !== "" && connected &&
                  <AndroidActionButton action="timeout" value={timeoutDraft}
                    onSuccess={refreshValues}>Save timeout</AndroidActionButton>}

              </section>
            </div>
          </CardContent>
        </Card>

      </div>
    </BaseLayout>
  )
}
