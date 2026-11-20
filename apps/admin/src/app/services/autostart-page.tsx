import * as React from "react"
import { BaseLayout } from "@/components/layouts/base-layout"
import { Button } from "@/components/ui/button"
import { RunitServiceActions } from "@/app/termux/admin-actions"
import { localAgentOperationsSchema } from "@/lib/local-agent-operations-schema"
import { protectedServiceSchema } from "@/lib/protected-service-schema"

type BootObservation = {
  state: "scripts-present" | "no-scripts" | "unverified"
  scriptCount: number | null
  ownerExecutableCount: number | null
  androidPermission: "not-verified"
  rebootReadback: "not-verified"
  checkedAt: string
}

type RuntimeStatus = "running" | "stopped" | "unverified"

async function readRuntimeMode(mode: string, signal: AbortSignal): Promise<unknown> {
  const response = await fetch("/api/v1/termux-admin?mode=" + mode, {
    credentials: "same-origin", cache: "no-store",
    signal: AbortSignal.any([signal, AbortSignal.timeout(10_000)]),
  })
  if (!response.ok) throw Error("Runtime state unavailable")
  return await response.json() as unknown
}

/** Runtime snapshot only. A running service today does not prove boot restoration. */
function BootSessionReadback({ refreshToken }: { refreshToken: number }) {
  const [states, setStates] = React.useState<Record<string, RuntimeStatus> | null>(null)
  const [observedAt, setObservedAt] = React.useState<string | null>(null)

  React.useEffect(() => {
    const controller = new AbortController()
    void Promise.resolve().then(async () => {
      if (controller.signal.aborted) return
      setStates(null)
      setObservedAt(null)
      const [agentResult, mqttResult] = await Promise.allSettled([
        readRuntimeMode("local-agent-operations", controller.signal)
          .then(value => localAgentOperationsSchema.parse(value)),
        readRuntimeMode("mqtt-diagnostics", controller.signal)
          .then(value => protectedServiceSchema.parse(value)),
      ])
      if (controller.signal.aborted) return
      const agent = agentResult.status === "fulfilled" ? agentResult.value : null
      const mqtt = mqttResult.status === "fulfilled" && mqttResult.value.service === "mosquitto"
        ? mqttResult.value : null
      setStates({
        "PocketHost panel": "running",
        "Local Agent": agent?.agent.state ?? "unverified",
        "Dedicated SSH": agent
          ? agent.ssh.state === "running" && agent.ssh.listen === "open"
            ? "running" : agent.ssh.state === "stopped" ? "stopped" : "unverified"
          : "unverified",
        "Mosquitto broker": mqtt?.runit.state ?? "unverified",
      })
      setObservedAt(new Date().toISOString())
    })
    return () => controller.abort()
  }, [refreshToken])

  return <section className="space-y-3 rounded-md border p-3" aria-label="Current A8 startup chain">
    <h3 className="text-sm font-medium">Current A8 service chain</h3>
    {!states && <p role="status" className="text-xs text-muted-foreground">
      Reading current service states…
    </p>}
    {states && <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
      {Object.entries(states).map(([name, state]) =>
        <div className="space-y-1 rounded-md border p-3" key={name}>
          <p className="text-sm font-medium">{name}</p>
          <p role={state === "running" ? "status" : "alert"} className="text-xs">
            {state === "running" ? "Running now" :
              state === "stopped" ? "Stopped" : "Unverified"}
          </p>
        </div>)}
    </div>}
    <p className="text-xs text-muted-foreground">
      This is a current-session observation, not proof that Termux:Boot restored
      these services after an Android reboot. Cloudflare's shared connector runs
      on Pi Zero and is not checked from A8.
      {observedAt && " Checked " + new Date(observedAt).toLocaleString() + "."}
    </p>
  </section>
}

function TermuxBootObservation({ refreshToken }: { refreshToken: number }) {
  const [boot, setBoot] = React.useState<BootObservation | null>(null)
  const [error, setError] = React.useState(false)
  const [loading, setLoading] = React.useState(false)
  const activeRequest = React.useRef<AbortController | null>(null)
  const refresh = React.useCallback(async () => {
    // A slower previous read must never overwrite a newer boot observation.
    activeRequest.current?.abort()
    const controller = new AbortController()
    activeRequest.current = controller
    setLoading(true)
    setError(false)
    setBoot(null)
    try {
      const response = await fetch("/api/v1/termux-admin?mode=service-boot", {
        credentials: "same-origin", cache: "no-store",
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10_000)]),
      })
      if (!response.ok) throw new Error("Boot diagnostics unavailable")
      const value = await response.json() as BootObservation
      if (!value || !["scripts-present", "no-scripts", "unverified"].includes(value.state) ||
          (value.state === "unverified"
            ? value.scriptCount !== null || value.ownerExecutableCount !== null
            : !Number.isSafeInteger(value.scriptCount) || value.scriptCount! < 0 ||
              value.scriptCount! > 32 ||
              !Number.isSafeInteger(value.ownerExecutableCount) ||
              value.ownerExecutableCount! < 0 ||
              value.ownerExecutableCount! > value.scriptCount! ||
              (value.state === "no-scripts"
                ? value.scriptCount !== 0 || value.ownerExecutableCount !== 0
                : value.scriptCount === 0)) ||
          value.androidPermission !== "not-verified" ||
          value.rebootReadback !== "not-verified" ||
          !Number.isFinite(Date.parse(value.checkedAt)))
        throw new Error("Invalid boot diagnostics")
      if (!controller.signal.aborted) setBoot(value)
    } catch {
      if (!controller.signal.aborted) setError(true)
    } finally {
      if (activeRequest.current === controller) {
        activeRequest.current = null
        setLoading(false)
      }
    }
  }, [])
  React.useEffect(() => {
    let cancelled = false
    void Promise.resolve().then(() => { if (!cancelled) void refresh() })
    return () => {
      cancelled = true
      activeRequest.current?.abort()
      activeRequest.current = null
    }
  }, [refresh, refreshToken])
  return <section className="space-y-2 rounded-md border p-3" aria-label="Termux Boot observation">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className="text-sm font-medium">Termux:Boot · startup chain</h3>
      <Button size="sm" variant="outline" disabled={loading}
        onClick={() => void refresh()}>Refresh boot status</Button>
    </div>
    {loading && <p role="status" className="text-xs">Reading local boot configuration…</p>}
    {error && <p role="alert" className="text-xs">
      Boot configuration unavailable. No startup capability is assumed.
    </p>}
    {boot && <div className="space-y-1 text-xs text-muted-foreground" role="status">
      <p>{boot.state === "scripts-present"
        ? boot.scriptCount + " local boot script(s) detected. Their commands and ownership are not verified."
        : boot.state === "no-scripts"
          ? "No local Termux:Boot scripts detected."
          : "Boot configuration cannot be safely inspected."}</p>
      {boot.state !== "unverified" && <p>
        Owner-executable bit set: {boot.ownerExecutableCount}/{boot.scriptCount} local script(s).
        {boot.scriptCount! > boot.ownerExecutableCount! &&
          " Some scripts lack the owner's execute permission."}
        {" Mode bits do not prove that Android will execute these scripts on boot."}
      </p>}
      <p>Android Termux:Boot installation/permission: unverified. Startup after a phone reboot: unverified.</p>
      <p>Runit autostart below records each enrolled service's desired state; it does not establish Android startup.</p>
      <p>Last observed: {new Date(boot.checkedAt).toLocaleString()} · read-only</p>
    </div>}
  </section>
}

export default function ServiceAutostartPage() {
  const [refreshToken, setRefreshToken] = React.useState(0)
  return <BaseLayout title="Service autostart" description="Runit policy and Android boot visibility">
    <div className="space-y-4 px-4 pb-8 lg:px-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">Manual observation · no startup scheduler</p>
        <Button size="sm" variant="outline"
          onClick={() => setRefreshToken(value => value + 1)}>Refresh boot and runit</Button>
      </div>
      <TermuxBootObservation refreshToken={refreshToken} />
      <BootSessionReadback refreshToken={refreshToken} />
      <RunitServiceActions mode="autostart" refreshToken={refreshToken} />
      <p className="text-xs text-muted-foreground">
        Runit enable/disable is limited to attested PocketHost-owned standalone services.
        Termux:Boot permissions and actual reboot behavior cannot be confirmed from this page.
        No Android restart, startup script execution or external-service changes are performed.
      </p>
    </div>
  </BaseLayout>
}
