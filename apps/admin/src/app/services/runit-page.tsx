import { BaseLayout } from "@/components/layouts/base-layout"
import { RunitServiceActions } from "@/app/termux/admin-actions"

export default function RunitServicesPage() {
  return <BaseLayout title="Runit services" description="Explicit ownership and process lifecycle">
    <div className="space-y-4 px-4 pb-8 lg:px-6">
      <RunitServiceActions mode="lifecycle" />
    </div>
  </BaseLayout>
}
