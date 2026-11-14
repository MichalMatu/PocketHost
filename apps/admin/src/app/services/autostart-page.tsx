import { BaseLayout } from "@/components/layouts/base-layout"
import { RunitServiceActions } from "@/app/termux/admin-actions"

export default function ServiceAutostartPage() {
  return <BaseLayout title="Service autostart" description="Runit boot policy for enrolled services">
    <div className="space-y-4 px-4 pb-8 lg:px-6">
      <RunitServiceActions mode="autostart" />
      <p className="text-xs text-muted-foreground">
        This page controls only runit enable/disable for explicitly registered services.
        It does not change Android Termux:Boot permission or guarantee boot recovery.
        Protected services remain read-only.
      </p>
    </div>
  </BaseLayout>
}
