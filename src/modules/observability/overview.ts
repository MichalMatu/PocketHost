import type { O1Event, O1HistoryPoint, O1Snapshot } from '../../shared/observability.ts';

const MAX_HISTORY = 36;
const MAX_EVENTS = 20;
const MAX_ALERTS = 12;

/** In-memory foreground-only history. No process manager, persistent daemon or host I/O. */
export class ObservabilityHistory {
  private samples: O1HistoryPoint[] = [];

  append(snapshot: Omit<O1Snapshot, 'history' | 'alerts'>): O1Snapshot {
    if (!Number.isFinite(Date.parse(snapshot.observedAt))) throw new Error('Invalid observation timestamp');
    const point: O1HistoryPoint = {
      observedAt: snapshot.observedAt,
      cpuPercent: snapshot.metrics.cpuPercent.state === 'ok' ? snapshot.metrics.cpuPercent.value : null,
      freeMemoryMiB: snapshot.host.runtime.freeMemoryMiB,
    };
    this.samples.push(point);
    this.samples = this.samples.slice(-MAX_HISTORY);
    const alerts: string[] = [];
    if (snapshot.metrics.cpuPercent.state !== 'ok') alerts.push('CPU metric unavailable');
    if (snapshot.metrics.batteryPercent.state !== 'ok') alerts.push('Battery access unavailable');
    if (snapshot.metrics.network.state !== 'ok') alerts.push('Network counters unavailable');
    if (snapshot.processes.state !== 'ok') alerts.push('Process view restricted');
    if (snapshot.processes.truncated) alerts.push('Process list truncated');
    if (snapshot.packages.state !== 'ok') alerts.push('Termux package inventory unavailable');
    if (snapshot.packages.updates.state !== 'cached-unverified') alerts.push('Package update metadata unknown');
    for (const service of snapshot.host.services) {
      if (service.state !== 'running') alerts.push(`Observed service ${service.id}: ${service.state}`);
    }
    return {
      ...snapshot,
      diagnostics: { state: snapshot.diagnostics.state, events: sanitizeEvents(snapshot.diagnostics.events) },
      history: this.samples.map((sample) => ({ ...sample })),
      alerts: alerts.slice(0, MAX_ALERTS),
    };
  }
}
export function sanitizeEvents(events: ReadonlyArray<O1Event>): O1Event[] {
  return events.slice(-MAX_EVENTS).flatMap((event) =>
    /^[a-z][a-z0-9-]{1,63}$/.test(event.instanceId) &&
    /^[a-z][a-z0-9-]{1,63}$/.test(event.code) &&
    !Number.isNaN(Date.parse(event.timestamp)) &&
    event.timestamp.length <= 32
      ? [{ timestamp: event.timestamp, instanceId: event.instanceId, code: event.code }]
      : [],
  );
}

export function sameProcessIdentity(
  before: { pid: number; startTicks: string },
  after: { pid: number; startTicks: string },
): boolean {
  return before.pid === after.pid && before.startTicks === after.startTicks &&
    /^\d+$/.test(before.startTicks);
}
