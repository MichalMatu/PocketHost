import * as React from "react"
import { BaseLayout } from "@/components/layouts/base-layout"
import { Button } from "@/components/ui/button"
import { RunitServiceActions } from "@/app/termux/admin-actions"

type BootObservation = {
  state: "scripts-present" | "no-scripts" | "unverified"
  scriptCount: number | null
  ownerExecutableCount: number | null
  androidPermission: "not-verified"
  rebootReadback: "not-verified"
  checkedAt: string
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
        credentials: "same-origin", cache: "no-store", signal: controller.signal,
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
      <RunitServiceActions mode="autostart" refreshToken={refreshToken} />
      <p className="text-xs text-muted-foreground">
        Runit enable/disable is limited to attested PocketHost-owned standalone services.
        Termux:Boot permissions and actual reboot behavior cannot be confirmed from this page.
        No Android restart, startup script execution or external-service changes are performed.
      </p>
    </div>
  </BaseLayout>
}
