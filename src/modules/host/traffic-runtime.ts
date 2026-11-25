import os from 'node:os';
import type { NodeRunitHost } from './node-runit-host.ts';
import path from 'node:path';
import { readTraffic, type TrafficSession } from './traffic-store.mjs';

/** Invoked only after an existing hosting adapter has attested the project. */
export function readOwnedTraffic(id: string, url: string, process: TrafficSession | null) {
  const query = new URL(url, 'http://127.0.0.1').searchParams;
  const range = query.get('range') ?? '24h';
  if ((range !== '24h' && range !== '7d') || query.getAll('range').length > 1 || [...query.keys()].some(key => key !== 'range'))
    throw new RangeError('Invalid traffic range');
  const root = path.join(os.homedir(), '.local', 'state', 'pockethost', 'traffic-v1');
  const result = readTraffic(root, id, range);
  if (result.state !== 'available') return { projectId: id, state: result.state };
  const current = process?.pid === result.session.pid && process.startTicks === result.session.startTicks;
  return {
    projectId: id,
    state: result.state,
    current,
    persistedAt: result.persistedAt,
    summary: { ...result.summary, rps: current ? result.summary.rps : null },
  };
}

/** The runtime verifies project identity even if it has never been provisioned. */
export function readNodeTraffic(runtime: NodeRunitHost, id: string, url = '') {
  const process = runtime.trafficProcess(id);
  return readOwnedTraffic(id, url, process ? { pid: process.pid, startTicks: process.ticks } : null);
}
