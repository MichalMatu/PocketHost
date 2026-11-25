export type TrafficRange = '24h' | '7d';
export type TrafficSummary = {
  range: TrafficRange;
  from: number;
  observedAt: number;
  startedAt: number;
  lastAt: number;
  requests: number;
  bytes: number;
  rps: number;
  statuses: [number, number][];
  topPaths: [string, number][];
  otherPaths: number;
  history: { at: number; requests: number; bytes: number }[];
};
export type TrafficSession = { pid: number; startTicks: string };
export type TrafficRead =
  | { state: 'missing' | 'unavailable' }
  | { state: 'available'; session: TrafficSession; persistedAt: number; summary: TrafficSummary };
export function readTraffic(root: string, projectId: string, range?: TrafficRange, now?: number): TrafficRead;

export function createTrafficRecorder(
  root: string,
  projectId: string,
  options?: { identity?: TrafficSession; clock?: () => number; flushMs?: number },
): { record(observation: { at: number; status: number; bytes: number; path: string }): boolean; flush(): Promise<boolean>; close(): Promise<boolean> } | null;
