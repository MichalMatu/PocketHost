import * as React from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

const api = "/api/v1/termux-admin"
type Status = { running: boolean; url: string | null }
async function read(): Promise<Status> {
  const response = await fetch(api + "?mode=terminal-status", { credentials: "same-origin", cache: "no-store" })
  if (!response.ok) throw new Error("Terminal status unavailable")
  const result = await response.json() as { terminal: Status }
  if (typeof result.terminal?.running !== "boolean" ||
    ![null, "/terminal/"].includes(result.terminal.url)) throw new Error("Invalid terminal status")
  return result.terminal
}
async function command(name: "start" | "stop"): Promise<Status> {
  const response = await fetch(api, {
    method: "POST", credentials: "same-origin",
    headers: { "Content-Type": "application/json", "X-PocketHost-Intent": "termux-admin" },
    body: JSON.stringify({ action: "terminal", name }),
  })
  if (!response.ok) throw new Error("Terminal command failed")
  const result = await response.json() as { terminal: Status }
  return result.terminal
}
export function TermuxTerminalPanel({ detected = true, refreshToken = 0 }: { detected?: boolean; refreshToken?: number }) {
  const [status, setStatus] = React.useState<Status | null>(null)
  const [error, setError] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  const [visible, setVisible] = React.useState(false)
  React.useEffect(() => {
    let mounted = true
    void read().then(result => { if (mounted) setStatus(result) })
      .catch(() => { if (mounted) setError("Terminal status unavailable.") })
    return () => { mounted = false }
  }, [refreshToken])
  const run = async (name: "start" | "stop") => {
    if (busy || !detected || !window.confirm(name === "start"
      ? "Open an interactive Termux shell for this trusted LAN session? Commands have your Termux user's permissions."
      : "End this PocketHost-owned ttyd session?")) return
    setBusy(true); setError("")
    try {
      setVisible(false)
      const state = await command(name)
      setStatus(state)
      setVisible(name === "start" && state.running)
    } catch {
      setError("Terminal result unconfirmed. Verify session status before retrying.")
      void read().then(setStatus).catch(() => undefined)
    }
    finally { setBusy(false) }
  }
  return <section className="space-y-4 rounded-md border p-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className="font-medium">Interactive Termux terminal</h3>
      <Badge variant="outline">{status ? status.running ? "Session active" : "Stopped" : "Status unknown"}</Badge>
    </div>
    <p className="text-xs text-muted-foreground">Interactive Termux shell · private LAN only.</p>
    {!detected && <p className="text-sm">ttyd is not installed. Install it in Packages before opening the terminal.</p>}
    <div className="flex flex-wrap gap-2">
      <Button disabled={!detected || busy || !status || status.running} onClick={() => void run("start")}>Start terminal</Button>
      <Button variant="outline" disabled={busy || !status?.running} onClick={() => void run("stop")}>Stop terminal</Button>
      <Button variant="outline" disabled={busy || !status?.running} onClick={() => setVisible(prev => !prev)}>
        {visible ? "Hide terminal" : "Show terminal"}
      </Button>

    </div>
    {visible && status?.running && <iframe
      title="PocketHost interactive Termux shell" src="/terminal/" loading="eager"
      className="h-[520px] w-full rounded-md border bg-black"
      referrerPolicy="same-origin"
    />}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </section>
}
