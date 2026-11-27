import * as React from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { z } from "zod"

const api = "/api/v1/termux-admin"
const connectionSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(48),
  host: z.string().min(1).max(253),
  username: z.string().min(1).max(32),
  port: z.number().int().min(1).max(65535),
}).strict()
const responseSchema = z.object({
  connections: z.array(connectionSchema).max(24),
  activeSession: z.string().nullable(),
  terminal: z.object({
    running: z.boolean(),
    url: z.string().nullable(),
  }),
})
type ResponseData = z.infer<typeof responseSchema>

export function SSHConnectionsPanel() {
  const [data, setData] = React.useState<ResponseData | null>(null)
  const [selected, setSelected] = React.useState("")
  const [name, setName] = React.useState("")
  const [host, setHost] = React.useState("")
  const [username, setUsername] = React.useState("")
  const [port, setPort] = React.useState("22")
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState("")

  const read = React.useCallback(async () => {
    const res = await fetch(api + "?mode=ssh-connections", {
      credentials: "same-origin", cache: "no-store",
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) throw Error("Cannot read SSH profiles")
    const value = responseSchema.parse(await res.json() as unknown)
    setData(value)
    return value
  }, [])

  React.useEffect(() => {
    let active = true
    let reading = false
    const update = async () => {
      if (reading || !active) return
      reading = true
      try {
        const res = await fetch(api + "?mode=ssh-connections", {
          credentials: "same-origin", cache: "no-store",
          signal: AbortSignal.timeout(10000),
        })
        if (!res.ok) throw Error("Cannot read SSH profiles")
        const next = responseSchema.parse(await res.json() as unknown)
        if (active) { setData(next); setError("") }
      } catch {
        if (active) setError("SSH connection state unavailable.")
      } finally { reading = false }
    }
    void update()
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible" && !busy) void update()
    }, 5000)
    return () => { active = false; window.clearInterval(timer) }
  }, [busy])

  const choose = (id: string) => {
    setSelected(id)
    const p = data?.connections.find(item => item.id === id)
    setName(p?.name ?? ""); setHost(p?.host ?? "")
    setUsername(p?.username ?? ""); setPort(p ? String(p.port) : "22")
  }
  const post = async (body: Record<string, string>) => {
    const res = await fetch(api, {
      method: "POST", credentials: "same-origin",
      headers: { "Content-Type": "application/json", "X-PocketHost-Intent": "termux-admin" },
      body: JSON.stringify(body),
    })
    if (!res.ok) throw Error("SSH operation not confirmed")
    return res.json() as Promise<unknown>
  }
  const run = async (task: "save" | "delete" | "connect" | "disconnect") => {
    if (busy || !data) return
    if (task === "delete" && !window.confirm("Delete this saved SSH connection?")) return
    if (task === "disconnect" && !window.confirm("Disconnect the active interactive terminal?")) return
    setBusy(true)
    try {
      if (task === "save") {
        const profile = {name, host, username, port: Number(port)}
        await post({action: "ssh-profile", name: selected ? "update" : "add",
          ...(selected ? {path: selected} : {}), content: JSON.stringify(profile)})
      } else if (task === "delete") {
        await post({action: "ssh-profile", name: "delete", path: selected})
        choose("")
      } else if (task === "connect") {
        await post({action: "ssh-profile", name: "connect", path: selected})
      } else {
        await post({action: "terminal", name: "stop"})
      }
      await read()
      setError("")
    } catch {
      setError("Operation not confirmed. Refresh before retrying.")
    } finally { setBusy(false) }
  }

  const activeName = data?.connections.find(x => x.id === data.activeSession)?.name
  return <Card>
    <CardHeader>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <CardTitle className="text-base">Interactive SSH connections</CardTitle>
        <Badge variant="outline">{data?.terminal.running ? "Terminal active" : "Disconnected"}</Badge>
      </div>
    </CardHeader>
    <CardContent className="space-y-4 text-sm">
      <p className="text-xs text-muted-foreground">
        Saved host, user and port; authenticate using existing Termux SSH keys or the interactive terminal.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1">Saved profile
          <select className="flex h-9 w-full rounded-md border bg-background px-3 text-sm"
            value={selected} onChange={e => choose(e.target.value)}>
            <option value="">New connection</option>
            {data?.connections.map(item =>
              <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        <label className="space-y-1">Connection name
          <Input value={name} maxLength={48} onChange={e => setName(e.target.value)} placeholder="MacBook LAN" />
        </label>
        <label className="space-y-1">Host / IP
          <Input value={host} maxLength={253} onChange={e => setHost(e.target.value)} placeholder="192.168.0.14" />
        </label>
        <label className="space-y-1">SSH user
          <Input value={username} maxLength={32} onChange={e => setUsername(e.target.value)} placeholder="michal" />
        </label>
        <label className="space-y-1">Port
          <Input value={port} inputMode="numeric" onChange={e => setPort(e.target.value)} placeholder="22" />
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button disabled={busy || !data || !!error || !name.trim() || !host.trim() || !username.trim()}
          onClick={() => void run("save")}>{selected ? "Save changes" : "Add connection"}</Button>
        {selected && <>
          <Button variant="outline" disabled={busy || !!error || !!data?.terminal.running}
            onClick={() => void run("connect")}>Connect</Button>
          <Button variant="outline" disabled={busy || !!error}
            onClick={() => void run("delete")}>Delete</Button>
        </>}
        {data?.terminal.running && <Button variant="outline" disabled={busy || !!error}
          onClick={() => void run("disconnect")}>Disconnect terminal</Button>}
      </div>
      {data?.terminal.running && <div className="space-y-2">
        <p className="text-xs text-muted-foreground">
          {data.activeSession ? "SSH session: " + (activeName ?? data.activeSession) :
            "A local Termux terminal session is already active."}
        </p>
        <iframe title="PocketHost SSH interactive terminal" src="/terminal/"
          className="h-[500px] w-full rounded-md border bg-black" loading="eager"
          referrerPolicy="same-origin" />
      </div>}
      {error && <p role="alert" className="text-destructive">{error}</p>}
    </CardContent>
  </Card>
}
