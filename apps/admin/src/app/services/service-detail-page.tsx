import * as React from "react"
import { Link, useParams } from "react-router-dom"
import { RefreshCw, ShieldCheck } from "lucide-react"
import { BaseLayout } from "@/components/layouts/base-layout"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { IleStoiDiagnosticPanel } from "@/app/termux/ilestoi-panel"
import { CloudflareTunnelPanel } from "@/app/termux/cloudflare-panel"
import { ProtectedServicePanel } from "@/app/termux/protected-services-panel"

const details = {
  ilestoi: { title: "IleStoi", description: "Application health and redacted service logs" },
  healthwatch: { title: "IleStoi Healthwatch", description: "Protected healthwatch diagnostics" },
  cloudflare: { title: "Cloudflare Tunnel", description: "Tunnel state and sanitized configuration" },
  ssh: { title: "SSH", description: "Protected SSH service diagnostics" },
  mqtt: { title: "Mosquitto MQTT", description: "Protected broker diagnostics" },
} as const

type ServiceId = keyof typeof details

export default function ServiceDetailPage() {
  const { serviceId } = useParams()
  const [refreshToken, setRefreshToken] = React.useState(0)
  const known = serviceId !== undefined &&
    Object.prototype.hasOwnProperty.call(details, serviceId)
  const service = known ? serviceId as ServiceId : null
  const item = service === null ? null : details[service]

  return <BaseLayout title={item?.title ?? "Unknown service"} description={item?.description}>
    <div className="space-y-4 px-4 pb-8 lg:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="gap-1">
            <ShieldCheck className="size-3" />Protected · read-only
          </Badge>
          <Link to="/services" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
            All services
          </Link>
        </div>
        {item && <Button variant="outline" onClick={() => setRefreshToken(value => value + 1)}>
          <RefreshCw className="size-4" />Refresh
        </Button>}
      </div>
      {!item && <p role="alert" className="text-sm text-muted-foreground">
        Unknown service. No diagnostics were requested.
      </p>}
      {service === "ilestoi" && <IleStoiDiagnosticPanel refreshToken={refreshToken} />}
      {service === "cloudflare" && <CloudflareTunnelPanel refreshToken={refreshToken} />}
      {service === "ssh" && <ProtectedServicePanel service="sshd" refreshToken={refreshToken} />}
      {service === "mqtt" && <ProtectedServicePanel service="mosquitto" refreshToken={refreshToken} />}
      {service === "healthwatch" &&
        <ProtectedServicePanel service="ilestoi-healthwatch" refreshToken={refreshToken} />}
    </div>
  </BaseLayout>
}
