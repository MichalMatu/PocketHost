import * as React from "react"
import { Button } from "@/components/ui/button"
type Capabilities = {
  version: number; loginRequired: boolean; transport: string;
  actions: string[]; path: string; headers: Record<string, string>;
}
const example = [
  "curl -fsS -X POST http://127.0.0.1:8787/api/v1/termux-admin \\",
  "  -H 'Content-Type: application/json' \\",
  "  -H 'X-PocketHost-Intent: termux-admin' \\",
  "  -H 'X-PocketHost-Agent-Intent: termux-owner-agent' \\",
  "  --data '{\"action\":\"package-preview\",\"name\":\"install\",\"path\":\"git\"}'",
].join("\n")

export function AgentApiPanel() {
  const [capabilities, setCapabilities] = React.useState<Capabilities | null>(null)
  const [error, setError] = React.useState("")
  const [copied, setCopied] = React.useState(false)
  React.useEffect(() => {
    let mounted = true
    void fetch("/api/v1/termux-admin?mode=agent-capabilities", {
      credentials: "same-origin", cache: "no-store",
    }).then(async response => {
      if (!response.ok) throw new Error("Unavailable")
      return response.json() as Promise<Capabilities>
    }).then(value => {
      if (!mounted) return
      if (value.version !== 1 || !Array.isArray(value.actions)) throw new Error("Invalid API")
      setCapabilities(value)
    }).catch(() => { if (mounted) setError("Agent API contract unavailable.") })
    return () => { mounted = false }
  }, [])
  return <section className="space-y-4 rounded-md border p-4">
    <h3 className="font-medium">Local Agent & AI control API</h3>
    <p className="text-sm text-muted-foreground">
      PocketHost now exposes its existing typed administrative operations to the
      Termux Local Agent OS account over loopback HTTP, without a login prerequisite.
      This is an API adapter, not a second AI execution engine or a new Local Agent daemon.
    </p>
    {capabilities && <div className="space-y-2">
      <p className="text-sm">API version: {capabilities.version} · Transport: {capabilities.transport}</p>
      <p className="text-sm">Registered actions: {capabilities.actions.join(", ")}</p>
    </div>}
    <p className="text-sm font-medium">Example Local Agent host-command client request</p>
    <pre className="overflow-auto rounded bg-muted p-3 text-xs">{example}</pre>
    <Button variant="outline" size="sm" onClick={() => void navigator.clipboard.writeText(example).then(
      () => setCopied(true), () => setError("Clipboard unavailable"),
    )}>{copied ? "Copied" : "Copy example"}</Button>
    <p className="text-xs text-muted-foreground">
      The existing Local Agent Git task transport is unchanged. The agent can call this
      local endpoint via an authorized host task while PocketHost is running.
      No public bind, no automatic startup and no GitHub credentials exposed.
    </p>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </section>
}
