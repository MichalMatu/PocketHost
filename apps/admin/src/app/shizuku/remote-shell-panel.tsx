import * as React from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

type ShellResponse = {
  action?: string
  mode?: "adb" | "root"
  success?: boolean
  output?: string
  stdout?: string
  stderr?: string
  exitCode?: number
  durationMs?: number
  error?: string
  detail?: string
}

type ShellEntry = {
  command: string
  output: string
  stdout: string
  stderr: string
  exitCode: number | null
  durationMs: number | null
  mode: string
  success: boolean
}

async function runOnSamsung(command: string): Promise<ShellResponse> {
  const response = await fetch("/api/v1/shizuku/remote-shell/run", {
    method: "POST", credentials: "same-origin", cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ command }),
    signal: AbortSignal.timeout(25000),
  })
  const payload: unknown = await response.json()
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Invalid Android shell response")
  }
  const result = payload as ShellResponse
  // A nonzero shell exit is an actual executed command, not a transport error.
  if (result.action === "shell" && ["adb", "root"].includes(result.mode ?? "") &&
      typeof result.output === "string" && typeof result.success === "boolean") {
    return result
  }
  if (!response.ok) throw new Error(result.detail ?? result.error ?? "Android shell failed")
  throw new Error("Android shell did not confirm execution")
}

async function copyText(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }
  // Chrome private HTTP LAN is not a secure context for Clipboard API.
  const area = document.createElement("textarea")
  area.value = text
  area.setAttribute("readonly", "true")
  area.style.position = "fixed"
  area.style.left = "-9999px"
  document.body.appendChild(area)
  area.select()
  try {
    if (!document.execCommand("copy")) throw new Error("Copy not supported by this browser")
  } finally {
    area.remove()
  }
}

export function RemoteShellPanel() {
  const [command, setCommand] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  const [result, setResult] = React.useState<ShellEntry | null>(null)
  const [error, setError] = React.useState("")
  const [copyNotice, setCopyNotice] = React.useState("")
  const [history, setHistory] = React.useState<ShellEntry[]>([])

  async function run(typed = command) {
    if (!typed.trim() || typed.length > 240 || busy) return
    setBusy(true)
    setError("")
    setCopyNotice("")
    setResult(null)
    setCommand(typed)
    try {
      const response = await runOnSamsung(typed)
      const entry: ShellEntry = {
        command: typed,
        output: response.output ?? "",
        stdout: response.stdout ?? response.output ?? "",
        stderr: response.stderr ?? "",
        exitCode: typeof response.exitCode === "number" ? response.exitCode : null,
        durationMs: typeof response.durationMs === "number" ? response.durationMs : null,
        mode: response.mode ?? "unknown",
        success: response.success === true,
      }
      setResult(entry)
      setHistory(current => [entry, ...current].slice(0, 10))
      if (!entry.success) setError("Android shell exited with code " + (entry.exitCode ?? "unknown"))
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Android shell unavailable")
    } finally {
      setBusy(false)
    }
  }

  async function copy(value: string) {
    try {
      await copyText(value)
      setCopyNotice("Copied to clipboard")
    } catch (failure) {
      setCopyNotice(failure instanceof Error ? failure.message : "Copy unavailable")
    }
  }

  return <Card>
    <CardHeader>
      <CardTitle>Advanced Shizuku shell</CardTitle>
      <CardDescription>
        Run Android shell commands directly from this private-LAN browser.
        No pairing code or secondary phone confirmation. Commands execute
        with the Android UID actually granted by Shizuku (ADB or root).
      </CardDescription>
    </CardHeader>
    <CardContent className="space-y-4">
      <div className="space-y-1">
        <label className="text-sm font-medium" htmlFor="remote-shell-command">Android shell command</label>
        <textarea id="remote-shell-command" value={command} maxLength={240} rows={3}
          onChange={event => setCommand(event.target.value)} disabled={busy}
          className="border-input bg-background focus-visible:ring-ring w-full rounded-md border px-3 py-2 font-mono text-sm focus-visible:outline-none focus-visible:ring-2"
          placeholder="id" spellCheck={false} />
        <p className="text-muted-foreground text-xs">{command.length}/240 characters</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" onClick={() => void run()} disabled={busy || !command.trim()}>
          {busy ? "Running…" : "Run on Samsung"}
        </Button>
        <span role="status" aria-live="polite" className="text-muted-foreground text-sm">
          {busy ? "Executing with Shizuku…" : result ? "Last execution: " + result.mode.toUpperCase() :
            "Direct shell ready when Shizuku is connected"}
        </span>
      </div>
      {error && <p role="alert" className="text-destructive text-sm">{error}</p>}
      {copyNotice && <p role="status" className="text-muted-foreground text-sm">{copyNotice}</p>}
      {result && (
        <div className="space-y-3 rounded-lg border p-3">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <strong>{result.success ? "Completed" : "Command failed"}</strong>
            <span>Exit: {result.exitCode ?? "Unavailable"}</span>
            <span>Duration: {result.durationMs == null ? "Unavailable" : result.durationMs + " ms"}</span>
            <Button size="sm" variant="outline" onClick={() => void copy(result.output)}>Copy output</Button>
          </div>
          <div>
            <p className="text-sm font-medium">Android output</p>
            <pre className="bg-muted max-h-72 overflow-auto rounded-md p-3 font-mono text-xs whitespace-pre-wrap break-all">{result.output || "(no output)"}</pre>
          </div>
          <div>
            <p className="text-sm font-medium">stdout</p>
            <pre className="bg-muted max-h-48 overflow-auto rounded-md p-3 font-mono text-xs whitespace-pre-wrap break-all">{result.stdout || "(empty)"}</pre>
          </div>
          <div>
            <p className="text-sm font-medium">stderr</p>
            <pre className="bg-muted max-h-48 overflow-auto rounded-md p-3 font-mono text-xs whitespace-pre-wrap break-all">{result.stderr || "(empty)"}</pre>
          </div>
        </div>
      )}
      {history.length > 0 && <div className="space-y-2">
        <p className="text-sm font-medium">Recent commands (this tab)</p>
        {history.map((item, index) => <div key={index}
          className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2 text-xs">
          <div className="min-w-0 flex-1">
            <code className="block break-all">{item.command}</code>
            <span className="text-muted-foreground">
              {item.success ? "OK" : "Failed"} · Exit {item.exitCode ?? "unknown"}
              {item.durationMs != null ? " · " + item.durationMs + " ms" : ""}
            </span>
          </div>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => void run(item.command)}>Run again</Button>
        </div>)}
      </div>}
      <p className="text-muted-foreground text-xs">
        DEV private LAN only. This HTTP endpoint has no user authentication or TLS.
        Anyone with access to this LAN origin could submit shell commands.
        Do not enter secrets. Security hardening is planned as a later stage.
      </p>
    </CardContent>
  </Card>
}
