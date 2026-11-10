import * as React from "react"

export type HistoryRange = "1h" | "24h" | "7d"

export type TooltipFields = Record<string, {
  label: string
  unit: "%" | "ms" | "Mb/s"
  decimals?: number
}>

type TooltipPoint = {
  dataKey?: string | number
  value?: number | string | readonly (number | string)[] | null
  color?: string
  payload?: { observedAt?: string; timestamp?: number }
}

export function historyTime(value: string | number, range: HistoryRange, detailed = false) {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return "Time unavailable"
  if (range === "1h") return detailed
    ? date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" })
    : date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
  return date.toLocaleString(undefined, {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  })
}

function metricText(value: number, unit: TooltipFields[string]) {
  const digits = unit.decimals ?? 1
  const formatted = value.toLocaleString(undefined, {
    maximumFractionDigits: digits,
  })
  return formatted + (unit.unit === "%" ? "%" : " " + unit.unit)
}

/** Dashboard-only tooltip: Recharts' label can be a series name, not the X timestamp. */
export function DashboardTooltip({
  active, payload, range, fields,
}: {
  active?: boolean
  payload?: readonly TooltipPoint[]
  range: HistoryRange
  fields: TooltipFields
}) {
  if (!active || !payload?.length) return null

  const timestamp = payload.find(item => typeof item.payload?.observedAt === "string")
    ?.payload?.observedAt
  const numericTimestamp = payload.find(item => typeof item.payload?.timestamp === "number")
    ?.payload?.timestamp
  const observedAt = timestamp ?? numericTimestamp
  const rows = payload.flatMap(item => {
    const key = typeof item.dataKey === "string" ? item.dataKey : ""
    const field = fields[key]
    return field && typeof item.value === "number" && Number.isFinite(item.value)
      ? [{ key, field, value: item.value, color: item.color }]
      : []
  })
  if (!rows.length) return null

  return (
    <div role="tooltip" className="min-w-48 max-w-72 rounded-lg border border-border/50 bg-background px-3 py-2 text-xs shadow-xl">
      <p className="mb-2 border-b border-border/50 pb-1.5 font-medium tabular-nums">
        {observedAt === undefined ? "Sample time unavailable" : historyTime(observedAt, range, true)}
      </p>
      <dl className="grid gap-y-1.5">
        {rows.map(row => (
          <div key={row.key} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-5">
            <dt className="flex min-w-0 items-center gap-2 text-muted-foreground">
              <span className="inline-block h-3 w-1 shrink-0 rounded-sm bg-current" aria-hidden="true" />
              <span>{row.field.label}</span>
            </dt>
            <dd className="whitespace-nowrap text-right font-mono font-medium tabular-nums">
              {metricText(row.value, row.field)}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
