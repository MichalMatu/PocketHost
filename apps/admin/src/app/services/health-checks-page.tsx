import { BaseLayout } from "@/components/layouts/base-layout"
import { HostingWorkloads } from "@/app/termux/hosting-workloads"
import { RunitHealthPanel } from "@/app/termux/runit-health"
import { CoreServicesHealthPanel } from "@/app/termux/core-services-health"

export default function ServiceHealthChecksPage() {
  return <BaseLayout>
    <div className="space-y-4 px-4 pb-8 lg:px-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">Health checks</h1>
        <p className="text-sm text-muted-foreground">On-demand readiness for verified services and workloads.</p>
      </div>
      <CoreServicesHealthPanel />
      <HostingWorkloads view="health" />
      <RunitHealthPanel />
      <p className="text-xs text-muted-foreground">
        Manual probes never schedule checks, change restart policy or adopt external services. Unknown ownership never counts as healthy.
      </p>
    </div>
  </BaseLayout>
}
