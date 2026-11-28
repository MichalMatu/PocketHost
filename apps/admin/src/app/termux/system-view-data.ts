import { trafficMbps } from "@/lib/network-traffic"
import { freshCpu, type useSystemData } from "./system-data"

/** Derive display values from the observed sample timestamp, not the render clock. */
export function systemViewData({
  host, bridge, internet, samples, historyState, loading, sampledAt,
}: ReturnType<typeof useSystemData>) {
  // Use a timestamp captured by the polling effect, never an impure clock read during render.
  const referenceTimeMs = sampledAt === null ? null : Date.parse(sampledAt)
  const lastCollected = [...samples].reverse().find(sample =>
    sample.batteryPercent !== undefined || sample.dnsFailed !== undefined) ?? null
  const collectedAge = referenceTimeMs === null || lastCollected === null ? null :
    referenceTimeMs - Date.parse(lastCollected.observedAt)
  const collectedFresh = collectedAge !== null && collectedAge >= 0 && collectedAge <= 150000
  const collectorLabel = historyState === "loading" ? "Collector: checking"
    : historyState === "unavailable" ? "Collector: unavailable"
    : !lastCollected ? "Collector: no samples"
    : collectedFresh ? "Collector: current" : "Collector: stale"
  const batteryPercent = collectedFresh ? lastCollected?.batteryPercent ?? null : null
  const batteryCharging = collectedFresh ? lastCollected?.batteryCharging ?? null : null
  const batteryTempC = collectedFresh ? lastCollected?.batteryTempC ?? null : null
  const dnsMs = collectedFresh ? lastCollected?.dnsMs ?? null : null
  const dnsFailed = collectedFresh ? lastCollected?.dnsFailed ?? null : null
  const alerts: string[] = []
  if (historyState === "ok" && !collectedFresh) alerts.push("Collector history is stale")
  if (batteryPercent !== null && batteryCharging === false && batteryPercent <= 20)
    alerts.push("Low battery · " + batteryPercent + "%")
  const storageAvailable = host?.runtime.storage?.availableMiB ?? null
  if (storageAvailable != null && storageAvailable <= 512)
    alerts.push("Low Termux storage · " + Math.round(storageAvailable) + " MiB left")
  const stoppedServices = host?.services.filter(service => service.state === "stopped").length ?? 0
  if (stoppedServices > 0)
    alerts.push(stoppedServices + " observed services stopped · verify desired state in Services")
  if (host?.services.some(service => service.state === "unknown"))
    alerts.push("Some service states unknown")
  if (internet?.state === "unreachable") alerts.push("Internet TCP probe failed")

  const chartSamples = samples.map(sample => ({ ...sample, timestamp: Date.parse(sample.observedAt) }))
  const trafficSamples = chartSamples.map((sample, i) => ({
    ...sample, ...trafficMbps(i ? samples[i - 1]! : null, sample),
  }))
  const lastTraffic = [...trafficSamples].reverse().find(sample =>
    sample.networkRxMbps !== null || sample.networkTxMbps !== null)
  const trafficAge = referenceTimeMs === null || !lastTraffic?.networkObservedAt ? null :
    referenceTimeMs - Date.parse(lastTraffic.networkObservedAt)
  const trafficFresh = trafficAge !== null && trafficAge >= 0 && trafficAge <= 150000
  const rxMbps = trafficFresh ? lastTraffic?.networkRxMbps ?? null : null
  const txMbps = trafficFresh ? lastTraffic?.networkTxMbps ?? null : null

  // A reachable, fresh and authorized Android source enables enhanced mode;
  // an HTTP 503 or disconnected Companion is not a failure of Termux itself.
  const companionAge = referenceTimeMs === null || !bridge
    ? null : referenceTimeMs - Date.parse(bridge.observedAt)
  const companionReady = !!bridge && bridge.connected && bridge.authorized &&
    companionAge !== null && companionAge >= 0 && companionAge <= 45_000
  const cpu = companionReady ? freshCpu(bridge, referenceTimeMs) : null
  const trafficSource = bridge?.network
  const trafficSourceAge = referenceTimeMs === null || !trafficSource
    ? null : referenceTimeMs - Date.parse(trafficSource.observedAt)
  const androidTrafficReady = companionReady && trafficSource?.rxBytes != null &&
    trafficSource?.txBytes != null && trafficSourceAge !== null &&
    trafficSourceAge >= 0 && trafficSourceAge <= 120_000
  const dnsReady = dnsMs !== null || dnsFailed === true
  const servicesRunning = host?.services.filter(service => service.state === "running").length ?? null
  const serviceUnknown = host?.services.some(service => service.state === "unknown") ?? false
  const active = !sampledAt && loading
  const bridgeState = !bridge ? "Android Bridge: status API unavailable"
    : bridge.connected && bridge.authorized
      ? cpu === null ? "Android Bridge: CPU sample unavailable" : "Android Bridge: authorized"
      : "Android Bridge: disconnected or unauthorized"
  const bridgeHealth = !bridge ? "Bridge status API unavailable"
    : bridge.connected ? bridge.authorized ? "Connected · authorized" : "Connected · authorization required"
    : "Disconnected · last status received"

  return {
    collectorLabel, batteryPercent, batteryCharging, batteryTempC, dnsMs, dnsFailed,
    alerts, chartSamples, trafficSamples, lastTraffic, trafficFresh, rxMbps, txMbps,
    companionReady, cpu, androidTrafficReady, dnsReady, servicesRunning, serviceUnknown,
    active, bridgeState, bridgeHealth,
  }
}
