import * as React from "react"
import { Button } from "@/components/ui/button"

type ShellReply = {
  action?: string
  mode?: string
  success?: boolean
  exitCode?: number
  stdout?: string
  output?: string
  error?: string
  detail?: string
}

async function runReadOrWrite(command: string): Promise<string> {
  const response = await fetch("/api/v1/shizuku/remote-shell/run", {
    method: "POST", credentials: "same-origin", cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ command }),
    signal: AbortSignal.timeout(15000),
  })
  const raw: unknown = await response.json()
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Invalid Shizuku shell response")
  const result = raw as ShellReply
  if (!response.ok || result.action !== "shell" || result.success !== true ||
      !["adb", "root"].includes(result.mode ?? "") || result.exitCode !== 0) {
    throw new Error(result.detail || result.error || "Android did not confirm the setting")
  }
  return (result.stdout ?? result.output ?? "").trim()
}

async function readBrightnessMode() {
  const raw = await runReadOrWrite("settings get system screen_brightness_mode")
  if (raw !== "0" && raw !== "1") throw new Error("Android did not return a known brightness mode")
  return raw === "0" ? "manual" as const : "automatic" as const
}

/**
 * An explicit user action is required before issuing any Android shell
 * command, including the read-only mode check. We do not silently execute
 * privileged shell commands when rendering the page.
 */
export function BrightnessModeControl({ connected, onValuesChanged }: {
  connected: boolean
  onValuesChanged: () => void
}) {
  const [mode, setMode] = React.useState<"manual" | "automatic" | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [message, setMessage] = React.useState<{ error: boolean; value: string } | null>(null)

  async function inspect() {
    if (!connected || busy) return
    setBusy(true)
    setMessage(null)
    try {
      setMode(await readBrightnessMode())
    } catch (failure) {
      setMode(null)
      setMessage({ error: true, value: failure instanceof Error ? failure.message : "Mode check failed" })
    } finally {
      setBusy(false)
    }
  }

  async function changeMode(target: "manual" | "automatic") {
    if (!connected || busy || mode === null || mode === target) return
    setBusy(true)
    setMessage(null)
    try {
      if (target === "manual") {
        // Last stored value can be 0 in adaptive mode: set a safe, visible
        // level before disabling adaptive brightness to avoid a black screen.
        await runReadOrWrite("settings put system screen_brightness 128")
      }
      await runReadOrWrite("settings put system screen_brightness_mode " + (target === "manual" ? "0" : "1"))
      const verified = await readBrightnessMode()
      if (verified !== target) throw new Error("Android did not retain the requested brightness mode")
      if (target === "manual") {
        const level = await runReadOrWrite("settings get system screen_brightness")
        if (level !== "128") throw new Error("Manual mode enabled, but brightness readback differed")
      }
      setMode(verified)
      setMessage({ error: false, value: target === "manual"
        ? "Manual mode verified; brightness stored as 128 / 255. Check the physical screen."
        : "Adaptive mode verified; Android now controls visible brightness." })
      onValuesChanged()
    } catch (failure) {
      setMode(null)
      setMessage({ error: true, value: failure instanceof Error ? failure.message : "Brightness mode change failed" })
    } finally {
      setBusy(false)
    }
  }

  return <div className="space-y-2 rounded-md border p-3">
    <p className="text-sm font-medium">Brightness control mode</p>
    <p className="min-h-5 text-sm text-muted-foreground" role="status">
      {mode === "manual" ? "Manual · slider can control the saved brightness" :
       mode === "automatic" ? "Adaptive · Android may override the slider" :
       "Mode not checked · use Check mode before changing brightness"}
    </p>
    <div className="flex flex-wrap gap-2">
      <Button type="button" size="sm" variant="outline" disabled={!connected || busy}
        onClick={() => { void inspect() }}>{busy ? "Checking…" : "Check mode"}</Button>
      {mode === "automatic" && <Button type="button" size="sm" variant="outline"
        disabled={!connected || busy} onClick={() => { void changeMode("manual") }}>
        Switch to manual · set 128 / 255
      </Button>}
      {mode === "manual" && <Button type="button" size="sm" variant="outline"
        disabled={!connected || busy} onClick={() => { void changeMode("automatic") }}>
        Restore adaptive brightness
      </Button>}
    </div>
    {message && <p role={message.error ? "alert" : "status"}
      className={message.error ? "text-destructive text-xs" : "text-muted-foreground text-xs"}>
      {message.value}
    </p>}
    <p className="text-xs text-muted-foreground">
      Mode changes are explicit Shizuku shell operations. Switching to manual first stores
      a safe 128 / 255. The browser cannot measure actual screen luminance.
    </p>
  </div>
}
