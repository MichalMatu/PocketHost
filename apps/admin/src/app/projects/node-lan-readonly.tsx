import { Link } from "react-router-dom"
import { BaseLayout } from "@/components/layouts/base-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

type NodeEntry = { id: string; name: string }
type CatalogState = "loading" | "ready" | "disabled" | "error"

/** Passwordless LAN intentionally has read-only Node Hosting access. */
export function NodeLanReadOnly({ projects, status, onRefresh }: {
  projects: NodeEntry[]
  status: CatalogState
  onRefresh: () => void
}) {
  return <BaseLayout title="Node.js applications" description="Read-only private LAN access.">
    <div className="space-y-4 px-4 pb-8 lg:px-6">
      <Card>
        <CardHeader>
          <CardTitle>Node.js Hosting — read only</CardTitle>
          <CardDescription>
            Creating, editing, installing dependencies and executing Node code require an
            authenticated owner channel. These operations are blocked from passwordless LAN.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p role="status">{status === "ready" ? "Inventory available" :
            status === "disabled" ? "Node Hosting disabled" :
            status === "error" ? "Inventory unavailable" : "Loading inventory"}</p>
          {status === "ready" && (projects.length
            ? <ul className="list-disc pl-5">{projects.map(item =>
                <li key={item.id}>{item.name}</li>)}</ul>
            : <p>No Node projects registered.</p>)}
          <div className="flex flex-wrap gap-3">
            <Button size="sm" variant="outline" onClick={onRefresh}>Refresh inventory</Button>
            <Button size="sm" variant="outline" render={<Link to="/deployments" />}>Deployments</Button>
            <Button size="sm" variant="outline" render={<Link to="/runtime-logs" />}>Project logs</Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Node code shares Termux user permissions; this is not a sandbox.
            Do not run untrusted repositories.
          </p>
        </CardContent>
      </Card>
    </div>
  </BaseLayout>
}
