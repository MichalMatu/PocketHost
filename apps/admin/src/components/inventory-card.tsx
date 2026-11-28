import type { ReactNode } from "react"
import { Link } from "react-router-dom"

import { pageActionClass } from "@/components/layouts/standard-page-layout"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export function InventoryCard({ headingId, title, status, statusLabel, loading, manageTo, manageLabel, children }: {
  headingId: string
  title: string
  status: string
  statusLabel: string
  loading: boolean
  manageTo: string
  manageLabel: string
  children?: ReactNode
}) {
  return (
    <Card role="region" aria-labelledby={headingId}>
      <CardHeader>
        <CardTitle><h2 id={headingId}>{title}</h2></CardTitle>
        <CardDescription role="status" aria-label={statusLabel} aria-busy={loading}>{status}</CardDescription>
        <CardAction>
          <Link to={manageTo} aria-label={manageLabel} className={buttonVariants({ variant: "outline", className: pageActionClass })}>Manage</Link>
        </CardAction>
      </CardHeader>
      {children && <CardContent>{children}</CardContent>}
    </Card>
  )
}

export function InventoryList({ children }: { children: ReactNode }) {
  return <ul className="divide-y">{children}</ul>
}

export function InventoryRow({ name, to, state, logsTo, children }: {
  name: string
  to: string
  state: string
  logsTo: string
  children: ReactNode
}) {
  return (
    <li className="flex flex-wrap items-start justify-between gap-2 py-3 first:pt-0 last:pb-0">
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <Link to={to} className="inline-flex min-h-8 max-md:min-h-10 min-w-0 items-center break-all font-medium underline underline-offset-4">{name}</Link>
          <Badge variant={state === "unknown" ? "destructive" : state === "running" ? "secondary" : "outline"}>{state}</Badge>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground">
          {children}
        </div>
      </div>
      <Link to={logsTo} className={buttonVariants({ variant: "ghost", className: pageActionClass })}>Logs</Link>
    </li>
  )
}
