import * as React from "react"
import { Activity, AppWindow, Battery, Cpu, ExternalLink, LockKeyhole, Settings2, Shield, Smartphone, Terminal } from "lucide-react"
import { BaseLayout } from "@/components/layouts/base-layout"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { INITIAL_SHIZUKU_SESSION } from "@/shared/shizuku"

const capabilities = [
  { title: "CPU & processes", detail: "True CPU load, process inventory and diagnostics", icon: Cpu },
  { title: "Installed applications", detail: "Package details, user apps and Android app actions", icon: AppWindow },
  { title: "Permissions", detail: "Inspect and manage actual Android grants", icon: LockKeyhole },
  { title: "Services & device", detail: "Services, settings and device controls", icon: Settings2 },
  { title: "Shell & automation", detail: "Owner-directed advanced operations at real ADB or root privilege", icon: Terminal },
  { title: "Battery & diagnostics", detail: "Power state, thermal and system diagnostics", icon: Battery },
]

export default function ShizukuPage() {
  return (
    <BaseLayout title="Android & Shizuku" description="Full-featured Android power-user management — growing inside PocketHost">
      <div className="space-y-5 px-4 lg:px-6">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline"><Smartphone className="size-3" /> Android power user</Badge>
          <Badge variant="outline"><Shield className="size-3" /> Privileges reflect real Android access</Badge>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Shizuku connection</CardTitle>
              <CardDescription>Native bridge status, not a simulated permission grant</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-xl font-medium">Not connected</p>
              <p className="text-muted-foreground text-sm">PocketHost has not connected an Android companion to Shizuku yet. Installed Shizuku alone does not grant this browser privileges.</p>
              <p className="text-muted-foreground text-xs">Initial state: {INITIAL_SHIZUKU_SESSION.connection} · privilege: {INITIAL_SHIZUKU_SESSION.privilege}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Verified Samsung evidence</CardTitle>
              <CardDescription>One-time ADB check, not a live Shizuku session</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>Shizuku application: installed</p>
              <p>Android: 16 · Samsung SM-S906B</p>
              <p>ADB CPU usage: 31% TOTAL in one diagnostic sample</p>
              <p className="text-muted-foreground text-xs">Shizuku service and PocketHost authorization require native verification.</p>
            </CardContent>
          </Card>
        </div>
        <div className="space-y-3">
          <h2 className="text-lg font-medium">Power-user capabilities</h2>
          <p className="text-muted-foreground text-sm">No artificial feature ceiling. Available operations will depend on the actual Shizuku ADB or root mode and user authorization.</p>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {capabilities.map(({ title, detail, icon: Icon }) => (
              <Card key={title} className="min-h-36">
                <CardHeader><CardTitle className="flex items-center gap-2"><Icon className="size-4" />{title}</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-muted-foreground text-sm">{detail}</p>
                  <p className="text-muted-foreground text-xs">Android companion integration pending</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Activity className="size-4" /> Connection setup</CardTitle>
            <CardDescription>Power-user access requires a native Android component</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>Start Shizuku from its Android application, via wireless debugging or the official ADB flow. The upcoming PocketHost Companion will request Shizuku authorization and expose the real granted capabilities here.</p>
            <p className="text-muted-foreground">ADB mode is not root. Root-only capabilities appear only when genuinely supported; no fake grant dialog or hidden device changes.</p>
            <a className="inline-flex items-center gap-2 underline underline-offset-4" href="https://shizuku.rikka.app/guide/setup/" target="_blank" rel="noreferrer">Official Shizuku setup guide <ExternalLink className="size-4" /></a>
          </CardContent>
        </Card>
      </div>
    </BaseLayout>
  )
}
