import { BaseLayout } from "@/components/layouts/base-layout"
import { HostingWorkloads } from "@/app/termux/hosting-workloads"

export default function ServiceHealthChecksPage() {
  return <BaseLayout title="Health checks" description="On-demand readiness for verified Hosting workloads">
    <div className="space-y-4 px-4 pb-8 lg:px-6">
      <HostingWorkloads view="health" />
      <p className="text-xs text-muted-foreground">
        These manual probes do not configure a health schedule, modify restart policy,
        or adopt external services. Unknown ownership never counts as healthy.
      </p>
    </div>
  </BaseLayout>
}
