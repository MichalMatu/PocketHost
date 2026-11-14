import * as React from "react"
import { Link, useParams } from "react-router-dom"
import { RefreshCw, ShieldCheck } from "lucide-react"
import { BaseLayout } from "@/components/layouts/base-layout"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { IleStoiDiagnosticPanel } from "@/app/termux/ilestoi-panel"
import { CloudflareTunnelPanel } from "@/app/termux/cloudflare-panel"
import { ProtectedServicePanel } from "@/app/termux/protected-services-panel"
import { diagnosticServices, type DiagnosticServiceId } from "@/config/service-workspaces"

export default function ServiceDetailPage({ service: selectedService }: {
  service?: DiagnosticServiceId
}) {
  // The explicit routes supply service; the legacy parameter is an unknown-slug fallback.
  const { serviceId } = useParams()
  const [refreshToken, setRefreshToken] = React.useState(0)
  const item = diagnosticServices.find(entry => entry.id === (selectedService ?? serviceId))
  const service = item?.id ?? null

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
