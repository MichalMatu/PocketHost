import * as React from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

type RemoteReply = {
  id?: string
  state?: "pending" | "running" | "done" | "failed" | "denied" | "expired"
  result?: string
  error?: string
}

async function postRemote(action: "submit" | "poll", payload: object): Promise<RemoteReply> {
  const response = await fetch("/api/v1/shizuku/remote-shell/" + action, {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      "X-PocketHost-Intent": "remote-shell-request",
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10000),
  })
  const data: unknown = await response.json()
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Invalid Companion response")
  }
  const result = data as RemoteReply
  if (!response.ok) throw new Error(result.error ?? "Companion refused the request")
  return result
}

export function RemoteShellPanel() {
  const [code, setCode] = React.useState("")
  const [command, setCommand] = React.useState("")
  const [requestId, setRequestId] = React.useState<string | null>(null)
  const [requestCommand, setRequestCommand] = React.useState("")
  const [state, setState] = React.useState<string>("idle")
  const [output, setOutput] = React.useState("")
  const [error, setError] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  const [history, setHistory] = React.useState<Array<{ command: string; result: string }>>([])
  const active = state === "pending" || state === "running"

  async function submit() {
    if (!/^\d{10}$/.test(code) || !command.trim() || command.length > 240 || active || busy) return
    setBusy(true)
    setError("")
    setOutput("")
    try {
      const result = await postRemote("submit", { code, command })
      if (!result.id || !/^[a-f0-9]{32}$/.test(result.id) || result.state !== "pending") {
        throw new Error("Invalid pending request identity")
      }
      setRequestId(result.id)
      setRequestCommand(command)
      setState("pending")
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Request unavailable")
    } finally {
      setBusy(false)
    }
  }

  React.useEffect(() => {
    if (!requestId || !active) return
    let cancelled = false
    const interval = setInterval(() => {
      void postRemote("poll", { code, id: requestId })
        .then(result => {
          if (cancelled) return
          if (!result.state) throw new Error("Invalid request status")
          setState(result.state)
          if (["done", "failed", "denied", "expired"].includes(result.state)) {
            const displayed = result.result ?? result.state
            setOutput(displayed)
            setHistory(old => [{ command: requestCommand, result: displayed }, ...old].slice(0, 5))
            setRequestId(null)
          }
        })
        .catch(failure => {
          if (cancelled) return
          setError(failure instanceof Error ? failure.message : "Status unavailable")
          setState("unavailable")
          setRequestId(null)
        })
    }, 2500)
    return () => { cancelled = true; clearInterval(interval) }
  }, [active, code, requestCommand, requestId])

  return <Card>
    <CardHeader>
      <CardTitle>Remote Shizuku shell</CardTitle>
      <CardDescription>
        Type an Android shell command on this computer. Pair with a temporary code
        shown by PocketHost Companion on the Samsung; approve each exact command there.
        Commands are never executed merely by submitting this form.
      </CardDescription>
    </CardHeader>
    <CardContent className="space-y-4">
      <p className="text-muted-foreground text-sm">
        On Samsung: PocketHost Companion → Advanced shell → Enable browser shell pairing.
        Enter the displayed 10-digit code below. Pairing lasts 10 minutes and expires
        when Companion restarts. Open the same section on the phone to review requests.
      </p>
      <div className="max-w-xs space-y-1">
        <label className="text-sm font-medium" htmlFor="remote-shell-code">Temporary pairing code</label>
        <Input id="remote-shell-code" type="password" inputMode="numeric" autoComplete="off"
          maxLength={10} placeholder="10-digit phone code" value={code}
          onChange={event => setCode(event.target.value.replace(/\D/g, "").slice(0, 10))} />
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium" htmlFor="remote-shell-command">Android shell command</label>
        <textarea id="remote-shell-command" value={command} maxLength={240} rows={3}
          onChange={event => setCommand(event.target.value)}
          disabled={active}
          className="border-input bg-background focus-visible:ring-ring w-full rounded-md border px-3 py-2 font-mono text-sm focus-visible:outline-none focus-visible:ring-2"
          placeholder="id" spellCheck={false} />
        <p className="text-muted-foreground text-xs">{command.length}/240 characters · Shizuku ADB is not root</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" onClick={() => void submit()}
          disabled={busy || active || !/^\d{10}$/.test(code) || !command.trim()}>
          {busy ? "Submitting…" : "Send for approval on Samsung"}
        </Button>
        <span role="status" aria-live="polite" className="text-muted-foreground text-sm">
          {active ? "Awaiting approval in Companion on Samsung (" + state + ")" :
            state === "idle" ? "Not connected to remote shell" : "Request: " + state}
        </span>
      </div>
      {error && <p role="alert" className="text-destructive text-sm">{error}</p>}
      {output && <div className="space-y-1">
        <p className="text-sm font-medium">Android result</p>
        <pre className="bg-muted max-h-72 overflow-auto rounded-md p-3 font-mono text-xs whitespace-pre-wrap break-all">{output}</pre>
      </div>}
      {history.length > 0 && <div className="space-y-2">
        <p className="text-sm font-medium">Recent requests (this browser tab only)</p>
        {history.map((item, index) => <div key={index} className="rounded-md border p-2 text-xs">
          <code className="block break-all">{item.command}</code>
          <span className="text-muted-foreground">{item.result.slice(0, 160)}</span>
        </div>)}
      </div>}
      <p className="text-muted-foreground text-xs">
        This trusted-LAN panel uses unencrypted HTTP. Do not send secrets in commands.
        No shell commands run unattended; disable pairing in Companion when finished.
      </p>
    </CardContent>
  </Card>
}
