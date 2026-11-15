import * as React from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

type VerifiedService = {
  name: string
  registered: boolean
  protected: boolean
}
type RunitHealth = {
  name: string
  identity: "verified"
  observed: "running" | "stopped" | "unknown"
  readiness: "not-verified"
  autostart: boolean | null
  logEvidence: "log-write" | "no-log" | "untrusted"
  lastLogWriteAt: string | null
  checkedAt: string
}

const base = "/api/v1/termux-admin"
const serviceName = /^[a-z][a-z0-9-]{1,63}$/

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(base + path, {
    credentials: "same-origin", cache: "no-store",
  })
  if (!response.ok) throw new Error("Termux observation unavailable")
  return await response.json() as T
}

export function RunitHealthPanel() {
  const [services, setServices] = React.useState<VerifiedService[] | null>(null)
  const [busy, setBusy] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [readback, setReadback] = React.useState<RunitHealth | null>(null)

  const refresh = React.useCallback(async () => {
    const result = await getJson<{ services: VerifiedService[] }>("?mode=services")
    if (!Array.isArray(result.services) || result.services.length > 100 ||
        !result.services.every(service =>
          serviceName.test(service.name) &&
          typeof service.registered === "boolean" &&
          typeof service.protected === "boolean")) {
      throw new Error("Invalid service inventory")
    }
    setServices(result.services.filter(service =>
      service.registered && !service.protected))
    setReadback(null)
    setError(null)
  }, [])

  React.useEffect(() => {
    void refresh().catch(() => setError("Service inventory unavailable"))
  }, [refresh])

  const inspect = async (service: VerifiedService) => {
    if (busy || !service.registered || service.protected ||
        !serviceName.test(service.name)) return
    setBusy(service.name)
    setError(null)
    setReadback(null)
    try {
      const result = await getJson<RunitHealth>(
        "?mode=service-health&name=" + encodeURIComponent(service.name))
      if (!result || result.name !== service.name ||
          result.identity !== "verified" ||
          !["running", "stopped", "unknown"].includes(result.observed) ||
          result.readiness !== "not-verified" ||
          (result.autostart !== null && typeof result.autostart !== "boolean") ||
          !["log-write", "no-log", "untrusted"].includes(result.logEvidence) ||
          (result.lastLogWriteAt !== null &&
            (typeof result.lastLogWriteAt !== "string" ||
              !Number.isFinite(Date.parse(result.lastLogWriteAt)))) ||
          !Number.isFinite(Date.parse(result.checkedAt))) {
        throw new Error("Untrusted service health response")
      }
      setReadback(result)
    } catch {
      setError("Health observation refused or unavailable; do not infer readiness.")
    } finally {
      setBusy(null)
    }
  }

  return <section className="space-y-3 rounded-md border p-3" aria-label="Runit health observations">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className="text-sm font-medium">Runit process observations</h3>
      <Button size="sm" variant="outline" disabled={busy !== null}
        onClick={() => void refresh().catch(() => setError("Service inventory unavailable"))}>
        Refresh services
      </Button>
    </div>
    <p className="text-xs text-muted-foreground">
      Manual, read-only inspection of PocketHost-attested services only.
      Process state and recent log output are not application readiness.
      No automatic restart, timer or foreign-service probe.
    </p>
    {error && <p role="alert" className="text-xs">{error}</p>}
    {services === null && !error && <p className="text-xs text-muted-foreground">Loading verified services…</p>}
    {services?.length === 0 && <p className="text-xs text-muted-foreground">
      No verified runit services to inspect. Add a PocketHost-owned service under Runit services.
    </p>}
    {services?.map(service => <div key={service.name}
      className="flex flex-wrap items-center justify-between gap-2 border-b py-2">
      <span className="text-sm">{service.name}</span>
      <Button size="sm" variant="outline" disabled={busy !== null}
        onClick={() => void inspect(service)}>
        {busy === service.name ? "Inspecting…" : "Inspect health"}
      </Button>
    </div>)}
    {readback && <div className="space-y-2 rounded-md border p-3" role="status">
      <p className="text-sm font-medium">{readback.name}</p>
      <div className="flex flex-wrap gap-2">
        <Badge variant="outline">Runit: {readback.observed}</Badge>
        <Badge variant="outline">Readiness: unverified</Badge>
        <Badge variant="outline">Autostart: {readback.autostart === null
          ? "unknown" : readback.autostart ? "enabled" : "disabled"}</Badge>
      </div>
      <p className="text-xs text-muted-foreground">
        Log write: {readback.logEvidence === "log-write" && readback.lastLogWriteAt
          ? new Date(readback.lastLogWriteAt).toLocaleString()
          : readback.logEvidence === "untrusted" ? "untrusted path" : "no recent evidence available"}
      </p>
      <p className="text-xs text-muted-foreground">
        Observed: {new Date(readback.checkedAt).toLocaleString()}.
        A running supervisor is not proof of a healthy application.
      </p>
    </div>}
  </section>
}
