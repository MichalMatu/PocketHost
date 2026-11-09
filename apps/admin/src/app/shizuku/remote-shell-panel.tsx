import * as React from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

type ShellResponse = {
  action?: string
  mode?: "adb" | "root"
  success?: boolean
  output?: string
  error?: string
  detail?: string
}

async function runOnSamsung(command: string): Promise<ShellResponse> {
  const response = await fetch("/api/v1/shizuku/remote-shell/run", {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ command }),
    signal: AbortSignal.timeout(25000),
  })
  const payload: unknown = await response.json()
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Invalid Android shell response")
  }
  const result = payload as ShellResponse
  if (!response.ok) throw new Error(result.detail ?? result.error ?? "Android shell failed")
  if (result.success !== true || result.action !== "shell" || typeof result.output !== "string") {
    throw new Error("Android shell did not confirm execution")
  }
  return result
}

export function RemoteShellPanel() {
  const [command, setCommand] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  const [result, setResult] = React.useState("")
  const [mode, setMode] = React.useState<string | null>(null)
  const [error, setError] = React.useState("")
  const [history, setHistory] = React.useState<Array<{ command: string; output: string }>>([])

  async function run() {
    if (!command.trim() || command.length > 240 || busy) return
    setBusy(true)
    setError("")
    setResult("")
    try {
      const response = await runOnSamsung(command)
      const output = response.output ?? ""
      setResult(output)
      setMode(response.mode ?? null)
      setHistory(current => [{ command, output }, ...current].slice(0, 5))
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Android shell unavailable")
    } finally {
      setBusy(false)
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
        <label className="text-sm font-medium" htmlFor="remote-shell-command">
          Android shell command
        </label>
        <textarea id="remote-shell-command" value={command} maxLength={240} rows={3}
          onChange={event => setCommand(event.target.value)}
          disabled={busy}
          className="border-input bg-background focus-visible:ring-ring w-full rounded-md border px-3 py-2 font-mono text-sm focus-visible:outline-none focus-visible:ring-2"
          placeholder="id" spellCheck={false} />
        <p className="text-muted-foreground text-xs">{command.length}/240 characters</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" onClick={() => void run()}
          disabled={busy || !command.trim()}>
          {busy ? "Running…" : "Run on Samsung"}
        </Button>
        <span role="status" aria-live="polite" className="text-muted-foreground text-sm">
          {busy ? "Executing with Shizuku…" : mode ? "Last execution: " + mode.toUpperCase() :
            "Direct shell ready when Shizuku is connected"}
        </span>
      </div>
      {error && <p role="alert" className="text-destructive text-sm">{error}</p>}
      {result && <div className="space-y-1">
        <p className="text-sm font-medium">Android output</p>
        <pre className="bg-muted max-h-72 overflow-auto rounded-md p-3 font-mono text-xs whitespace-pre-wrap break-all">{result}</pre>
      </div>}
      {history.length > 0 && <div className="space-y-2">
        <p className="text-sm font-medium">Recent commands (this tab)</p>
        {history.map((item, index) => <div key={index} className="rounded-md border p-2 text-xs">
          <code className="block break-all">{item.command}</code>
          <span className="text-muted-foreground whitespace-pre-wrap break-all">
            {item.output.slice(0, 160)}
          </span>
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
