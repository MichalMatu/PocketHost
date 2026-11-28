import * as React from "react"
import { parseHostSnapshot, type HostSnapshot } from "@/lib/host-snapshot-schema"
import { parseShizukuStatus, type ShizukuStatus } from "@/lib/shizuku-schema"
import { parseInternetConnectivity, type InternetConnectivity } from "@/lib/internet-connectivity-schema"
import { parseDashboardHistory, type DashboardHistoryEvent } from "@/lib/dashboard-history-schema"
import { MAX_SAMPLES, mergeHistory, type Sample } from "./system-history"

const POLL_MS = 15_000

async function getHost(signal: AbortSignal) {
  const began = performance.now()
  const response = await fetch("/api/v1/host/snapshot", {
    credentials: "same-origin",
    cache: "no-store",
    signal: AbortSignal.any([signal, AbortSignal.timeout(9000)]),
  })
  if (!response.ok) throw new Error("host-unavailable")
  const host = parseHostSnapshot(await response.json() as unknown)
  return { host, apiMs: Math.max(0, Math.round(performance.now() - began)) }
}

async function getBridge(signal: AbortSignal) {
  const began = performance.now()
  const response = await fetch("/api/v1/shizuku/status", {
    credentials: "same-origin",
    cache: "no-store",
    signal: AbortSignal.any([signal, AbortSignal.timeout(9000)]),
  })
  if (!response.ok) throw new Error("bridge-unavailable")
  const bridge = parseShizukuStatus(await response.json() as unknown)
  return { bridge, bridgeMs: Math.max(0, Math.round(performance.now() - began)) }
}

async function getInternet(signal: AbortSignal) {
  const response = await fetch("/api/v1/internet-connectivity", {
    credentials: "same-origin", cache: "no-store",
    signal: AbortSignal.any([signal, AbortSignal.timeout(4500)]),
  })
  if (!response.ok) throw new Error("internet-probe-unavailable")
  return parseInternetConnectivity(await response.json() as unknown)
}

async function getSavedHistory(signal: AbortSignal, range: "1h" | "24h" | "7d") {
  const response = await fetch("/api/v1/dashboard/history?range=" + range, {
    credentials: "same-origin", cache: "no-store",
    signal: AbortSignal.any([signal, AbortSignal.timeout(4500)]),
  })
  if (!response.ok) throw new Error("history-unavailable")
  return parseDashboardHistory(await response.json() as unknown)
}

export function freshCpu(bridge: ShizukuStatus | null, referenceTimeMs: number | null) {
  if (referenceTimeMs === null || !bridge || !bridge.connected || !bridge.authorized || bridge.cpuPercent === null) return null
  const age = referenceTimeMs - Date.parse(bridge.observedAt)
  return age >= 0 && age <= 45_000 ? bridge.cpuPercent : null
}

function ramUsedPercent(host: HostSnapshot | null) {
  if (!host || host.runtime.totalMemoryMiB <= 0) return null
  return Math.round(1000 * (host.runtime.totalMemoryMiB - host.runtime.freeMemoryMiB) / host.runtime.totalMemoryMiB) / 10
}

export function useSystemData() {
  const [host, setHost] = React.useState<HostSnapshot | null>(null)
  const [bridge, setBridge] = React.useState<ShizukuStatus | null>(null)
  const [internet, setInternet] = React.useState<InternetConnectivity | null>(null)
  const [samples, setSamples] = React.useState<Sample[]>([])
  const [historyState, setHistoryState] = React.useState<"loading" | "ok" | "unavailable">("loading")
  const [historyRange, setHistoryRange] = React.useState<"1h" | "24h" | "7d">("1h")
  const [recentEvents, setRecentEvents] = React.useState<DashboardHistoryEvent[]>([])
  const [loading, setLoading] = React.useState(true)
  const [sampledAt, setSampledAt] = React.useState<string | null>(null)
  const [generation, setGeneration] = React.useState(0)

  React.useEffect(() => {
    const controller = new AbortController()
    let busy = false

    async function poll() {
      if (busy || controller.signal.aborted) return
      busy = true
      const [hostResult, bridgeResult, internetResult] = await Promise.all([
        getHost(controller.signal).catch(() => null),
        getBridge(controller.signal).catch(() => null),
        getInternet(controller.signal).catch(() => null),
      ])
      if (!controller.signal.aborted) {
        const nextHost = hostResult?.host ?? null
        const now = new Date().toISOString()
        setHost(nextHost)
        setBridge(bridgeResult?.bridge ?? null)
        setInternet(internetResult)
        setSampledAt(now)
        setSamples(previous => [...previous, {
          observedAt: now,
          cpu: freshCpu(bridgeResult?.bridge ?? null, Date.parse(now)),
          ram: ramUsedPercent(nextHost),
          apiMs: hostResult?.apiMs ?? null,
          internetMs: internetResult?.latencyMs ?? null,
          internetFailed: internetResult?.state === "unreachable" ? true : internetResult ? false : null,
          bridgeMs: bridgeResult?.bridgeMs ?? null,
          bridgeOnline: bridgeResult?.bridge.connected ?? null,
          networkRxBytes: bridgeResult?.bridge.network?.rxBytes ?? null,
          networkTxBytes: bridgeResult?.bridge.network?.txBytes ?? null,
          networkObservedAt: bridgeResult?.bridge.network?.observedAt ?? null,
        }].slice(-MAX_SAMPLES))
        setLoading(false)
      }
      busy = false
    }

    void poll()
    const timer = window.setInterval(() => {
      if (document.visibilityState !== "hidden") void poll()
    }, POLL_MS)
    return () => {
      controller.abort()
      window.clearInterval(timer)
    }
  }, [generation])

  React.useEffect(() => {
    const controller = new AbortController()
    void getSavedHistory(controller.signal, historyRange).then(history => {
      if (controller.signal.aborted) return
      setHistoryState(history.state)
      if (history.state === "ok") {
        const cutoff = Date.now() - (historyRange === "7d" ? 604800000 : historyRange === "24h" ? 86400000 : 3600000)
        setSamples(previous => mergeHistory(
          previous.filter(item => Date.parse(item.observedAt) >= cutoff), history.samples))
        setRecentEvents(history.events ?? [])
      }
    }).catch(() => {
      if (!controller.signal.aborted) setHistoryState("unavailable")
    })
    return () => controller.abort()
  }, [generation, historyRange])

  return {
    host, bridge, internet, samples, historyState, historyRange,
    setHistoryRange, recentEvents, loading, sampledAt, setGeneration,
  }
}
