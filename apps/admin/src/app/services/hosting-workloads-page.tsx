import { BaseLayout } from "@/components/layouts/base-layout"
import { HostingWorkloads } from "@/app/termux/hosting-workloads"

export default function HostingServicesPage() {
  return <BaseLayout>
    <div className="space-y-4 px-4 pb-8 lg:px-6">
      <h1 className="text-xl font-semibold tracking-tight">Hosting workloads</h1>
      <HostingWorkloads view="inventory" />
    </div>
  </BaseLayout>
}
