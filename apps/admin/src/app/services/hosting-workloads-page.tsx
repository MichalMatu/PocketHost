import { BaseLayout } from "@/components/layouts/base-layout"
import { HostingWorkloads } from "@/app/termux/hosting-workloads"

export default function HostingServicesPage() {
  return <BaseLayout title="Hosting workloads" description="Owned Node.js and static hosting runtime inventory">
    <div className="space-y-4 px-4 pb-8 lg:px-6">
      <HostingWorkloads view="inventory" />
    </div>
  </BaseLayout>
}
