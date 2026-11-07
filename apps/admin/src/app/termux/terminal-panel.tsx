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
export function TermuxTerminalPanel() {
  const [status, setStatus] = React.useState<Status | null>(null)
  const [error, setError] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  const [visible, setVisible] = React.useState(false)
  React.useEffect(() => {
    let mounted = true
    void read().then(result => { if (mounted) setStatus(result) })
      .catch(() => { if (mounted) setError("Terminal status unavailable.") })
    return () => { mounted = false }
  }, [])
  const run = async (name: "start" | "stop") => {
    if (busy || !window.confirm(name === "start"
      ? "Open an interactive Termux shell for this trusted LAN session? Commands have your Termux user's permissions."
      : "End this PocketHost-owned ttyd session?")) return
    setBusy(true); setError("")
    try {
      setVisible(false)
      const state = await command(name)
      setStatus(state)
      setVisible(name === "start" && state.running)
    } catch { setError("Terminal could not start or stop. Check ttyd installation and port ownership.") }
    finally { setBusy(false) }
  }
  return <section className="space-y-4 rounded-md border p-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className="font-medium">Interactive Termux terminal</h3>
      <Badge variant="outline">{status?.running ? "Session active" : "Stopped"}</Badge>
    </div>
    <p className="text-sm text-muted-foreground">
      Uses the installed ttyd and its xterm.js UI. Exactly one writable shell session,
      launched manually on 127.0.0.1, through the existing private LAN gateway.
      No password prompt, persistent service or public listener.
    </p>
    <div className="flex flex-wrap gap-2">
      <Button disabled={busy || status?.running === true} onClick={() => void run("start")}>Start terminal</Button>
      <Button variant="outline" disabled={busy || !status?.running} onClick={() => void run("stop")}>Stop terminal</Button>
      <Button variant="outline" disabled={busy || !status?.running} onClick={() => setVisible(prev => !prev)}>
        {visible ? "Hide terminal" : "Show terminal"}
      </Button>
      <Button variant="outline" disabled={busy} onClick={() => void read().then(setStatus).catch(() => setError("Status unavailable"))}>
        Refresh
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
