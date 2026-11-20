import * as React from "react"
import { Link, useParams } from "react-router-dom"
import { RefreshCw, ShieldCheck } from "lucide-react"
import { BaseLayout } from "@/components/layouts/base-layout"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CloudflareTunnelPanel } from "@/app/termux/cloudflare-panel"
import { ProtectedServicePanel } from "@/app/termux/protected-services-panel"
import { LocalAgentOperationsPanel } from "@/app/local-agent/operations-panel"
import { SSHConnectionsPanel } from "@/app/local-agent/ssh-connections-panel"
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
          {service === "ssh" ? <span className="text-sm text-muted-foreground">
            Galaxy A8 · dedicated SSH and saved connections
          </span> : <Badge variant="outline" className="gap-1">
            <ShieldCheck className="size-3" />Protected · read-only
          </Badge>}
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
      {service === "cloudflare" && <CloudflareTunnelPanel refreshToken={refreshToken} />}
      {service === "ssh" && <>
        <LocalAgentOperationsPanel scope="ssh" refreshToken={refreshToken} />
        <SSHConnectionsPanel />
        <section aria-label="External SSH service" className="space-y-2 pt-2">
          <h2 className="font-semibold">Other SSH service (protected)</h2>
          <p className="text-sm text-muted-foreground">
            This is the separate system sshd service, not the dedicated A8 SSH listener above.
            It remains read-only and its stopped state does not mean the dedicated listener is offline.
          </p>
          <ProtectedServicePanel service="sshd" refreshToken={refreshToken} />
        </section>
      </>}
      {service === "mqtt" && <ProtectedServicePanel service="mosquitto" refreshToken={refreshToken} />}
    </div>
  </BaseLayout>
}
