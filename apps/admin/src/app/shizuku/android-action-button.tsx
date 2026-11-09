import * as React from "react"
import { Button } from "@/components/ui/button"

export type AndroidAction = "launch" | "force-stop" | "enable" | "disable" | "uninstall" |
  "grant" | "revoke" | "process-stop" | "service-start" | "service-stop" | "brightness" | "timeout"

type ActionResponse = {
  success?: boolean
  action?: string
  mode?: string
  output?: string
  error?: string
  detail?: string
  durationMs?: number
}
export async function runAndroidAction(action: AndroidAction, target: string, value: string): Promise<ActionResponse> {
  const response = await fetch("/api/v1/shizuku/action/run", {
    method: "POST", credentials: "same-origin", cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, target, value }),
    signal: AbortSignal.timeout(25000),
  })
  const body: unknown = await response.json()
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("Malformed Android action result")
  const result = body as ActionResponse
  if (!response.ok) throw new Error(result.detail || result.error || "Android action failed")
  if (result.success !== true || result.action !== action || !["adb", "root"].includes(result.mode ?? "")) {
    throw new Error("Android did not confirm this operation")
  }
  return result
}

export function AndroidActionButton({ action, target = "", value = "", children, onSuccess }: {
  action: AndroidAction
  target?: string
  value?: string
  children: React.ReactNode
  onSuccess?: () => void
}) {
  const [busy, setBusy] = React.useState(false)
  const [feedback, setFeedback] = React.useState<{ ok: boolean; text: string } | null>(null)
  async function run() {
    if (busy) return
    setBusy(true)
    setFeedback(null)
    try {
      const result = await runAndroidAction(action, target, value)
      setFeedback({
        ok: true, text: (result.mode ?? "Android").toUpperCase() + ": " +
          (result.output?.trim().slice(0, 180) || "Completed") +
          (typeof result.durationMs === "number" ? " · " + result.durationMs + " ms" : ""),
      })
      onSuccess?.()
    } catch (failure) {
      setFeedback({ ok: false, text: failure instanceof Error ? failure.message : "Android operation failed" })
    } finally {
      setBusy(false)
    }
  }
  return <span className="inline-flex min-w-0 flex-wrap items-center gap-2">
    <Button type="button" size="sm" variant="outline" onClick={() => { void run() }} disabled={busy}>
      {busy ? "Running…" : children}
    </Button>
    {feedback && <span role={feedback.ok ? "status" : "alert"}
      className={feedback.ok ? "text-muted-foreground text-xs break-all" : "text-destructive text-xs break-all"}>
      {feedback.text}
    </span>}
  </span>
}
