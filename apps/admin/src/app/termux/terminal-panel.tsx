import * as React from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

const api = "/api/v1/termux-admin"
type Status = { running: boolean; url: string | null }

function parseStatus(value: unknown): Status {
  if (!value || typeof value !== "object" || !("terminal" in value)) {
    throw new Error("Invalid terminal status")
  }
  const terminal = value.terminal
  if (!terminal || typeof terminal !== "object" || !("running" in terminal) ||
    !("url" in terminal) || typeof terminal.running !== "boolean" ||
    (terminal.running ? terminal.url !== "/terminal/" : terminal.url !== null)) {
    throw new Error("Invalid terminal status")
  }
  return terminal as Status
}

async function read(): Promise<Status> {
  const response = await fetch(api + "?mode=terminal-status", {
    credentials: "same-origin", cache: "no-store",
  })
  if (!response.ok) throw new Error("Terminal status unavailable")
  return parseStatus(await response.json() as unknown)
}

async function command(name: "start" | "stop"): Promise<Status> {
  const response = await fetch(api, {
    method: "POST", credentials: "same-origin",
    headers: { "Content-Type": "application/json", "X-PocketHost-Intent": "termux-admin" },
    body: JSON.stringify({ action: "terminal", name }),
  })
  if (!response.ok) throw new Error("Terminal command failed")
  return parseStatus(await response.json() as unknown)
}

export function TermuxTerminalPanel({
  detected, detectionError = false, refreshToken = 0,
}: { detected?: boolean; detectionError?: boolean; refreshToken?: number }) {
  const [status, setStatus] = React.useState<Status | null>(null)
  const [error, setError] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  React.useEffect(() => {
    let mounted = true
    void read().then(result => {
      if (mounted) { setStatus(result); setError("") }
    }).catch(() => {
      if (mounted) setError("Terminal status unavailable. Refresh to check the session.")
    })
    return () => { mounted = false }
  }, [refreshToken])

  const run = async (name: "start" | "stop") => {
    if (busy || !status || (name === "start" && (detected !== true || status.running)) ||
      (name === "stop" && !status.running) || !window.confirm(name === "start"
        ? "Open an interactive Termux shell for this trusted LAN session? Commands have your Termux user's permissions."
        : "End this PocketHost-owned ttyd session?")) return
    setBusy(true); setError("")
    try {
      setStatus(await command(name))
    } catch {
      setError("Terminal result unconfirmed. Refresh to verify the session before retrying.")
      void read().then(setStatus).catch(() => undefined)
    } finally {
      setBusy(false)
    }
  }

  const running = status?.running === true && status.url === "/terminal/"
  return <section className="space-y-4 rounded-md border p-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className="font-medium">Interactive Termux terminal</h3>
      <Badge variant="outline">{error ? "Status unverified" :
        status ? running ? "Terminal running" : "Stopped" : "Checking status"}</Badge>
    </div>
    <p className="text-xs text-muted-foreground">
      Private LAN only. Shell commands have your Termux user's permissions. One browser client at a time.
    </p>
    {detectionError && <p role="alert" className="text-sm text-destructive">
      Terminal availability could not be checked. Refresh to retry.
    </p>}
    {detected === false && !detectionError && !running && <p className="text-sm">
      ttyd is not installed. Install it in Packages before opening a terminal.
    </p>}
    <div className="flex flex-wrap gap-2">
      {running
        ? <Button variant="outline" disabled={busy} onClick={() => void run("stop")}>
          Stop terminal
        </Button>
        : <Button disabled={busy || !status || detected !== true} onClick={() => void run("start")}>
          Start terminal
        </Button>}
    </div>
    {running ? <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        The terminal appears automatically while ttyd is running. Leaving this page can disconnect the single-client session.
      </p>
      <iframe title="PocketHost interactive Termux shell" src="/terminal/" loading="eager"
        className="h-[520px] w-full rounded-md border bg-black"
        referrerPolicy="same-origin"
      />
    </div> : status && <p className="rounded-md border p-4 text-sm text-muted-foreground">
      Terminal stopped. Start a session to open the shell here.
    </p>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </section>
}
