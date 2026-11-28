import { Cpu } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

function metricValue(value: string | null, loading: boolean) {
  return loading
    ? <span aria-label="Loading" className="block h-8 w-28 max-w-full animate-pulse rounded bg-muted" />
    : <span className="block min-h-8 truncate leading-8">{value ?? "Unavailable"}</span>
}

export function SummaryCard({ title, value, detail, icon: Icon, loading }: {
  title: string
  value: string | null
  detail: string
  icon: typeof Cpu
  loading: boolean
}) {
  return (
    <Card className="min-w-0 gap-2 py-3">
      <CardHeader className="gap-1 px-3 sm:px-4">
        <CardDescription className="flex items-start gap-1.5">
          <Icon className="mt-0.5 size-4 shrink-0" />{title}
        </CardDescription>
        <CardTitle className="break-words text-lg tabular-nums sm:text-2xl">{metricValue(value, loading)}</CardTitle>
      </CardHeader>
      {detail && <CardContent className="px-3 text-xs text-muted-foreground sm:px-4">{detail}</CardContent>}
    </Card>
  )
}
