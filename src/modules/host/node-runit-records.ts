import { nodeHostingUnitName as unitName } from '../../shared/node-hosting-projection.ts';

export const PREFIX = '/data/data/com.termux/files/usr';
export const FIRST_PORT = 19300;
export const PORT_COUNT = 32;
export const RELEASE = /^r-[a-f0-9]{32}$/;
export const UNIT_MARKER = '.pockethost-node-unit.json';
export const RUNTIME_MARKER = '.pockethost-node-runtime.json';
export const MAX_HISTORY = 24;

export type ProcessProof = { pid: number; ticks: string };
export type RuntimeRecord = {
  schema: 1;
  owner: 'pockethost-node-runit';
  projectId: string;
  unit: string;
  port: number;
  desired: 'stopped' | 'running';
  activeRelease: string | null;
  lastGoodRelease: string | null;
  previousGoodRelease?: string | null;
  process: ProcessProof | null;
  readinessNonce: string;
  history: {
    at: string;
    action: 'start' | 'update' | 'stop' | 'failed' | 'rollback';
    release: string;
  }[];
};
export type UnitRecord = {
  schema: 1;
  owner: 'pockethost-node-runit';
  projectId: string;
  unit: string;
  port: number;
  runDigest: string;
  logDigest: string;
  readinessNonce: string;
};

export function stored(raw: string, id: string): RuntimeRecord {
  const v: unknown = JSON.parse(raw);
  if (!v || typeof v !== 'object' || Array.isArray(v))
    throw new Error('Invalid Node runtime state');
  const s = v as RuntimeRecord;
  if (
    s.schema !== 1 ||
    s.owner !== 'pockethost-node-runit' ||
    s.projectId !== id ||
    s.unit !== unitName(id) ||
    !Number.isSafeInteger(s.port) ||
    s.port < FIRST_PORT ||
    s.port >= FIRST_PORT + PORT_COUNT ||
    !['running', 'stopped'].includes(s.desired) ||
    typeof s.readinessNonce !== 'string' ||
    !/^[a-f0-9]{48}$/.test(s.readinessNonce) ||
    (s.activeRelease !== null && !RELEASE.test(s.activeRelease)) ||
    (s.lastGoodRelease !== null && !RELEASE.test(s.lastGoodRelease)) ||
    (s.previousGoodRelease !== undefined &&
      s.previousGoodRelease !== null &&
      !RELEASE.test(s.previousGoodRelease)) ||
    (s.process !== null &&
      (!Number.isSafeInteger(s.process.pid) ||
        s.process.pid < 2 ||
        !/^\d+$/.test(s.process.ticks))) ||
    !Array.isArray(s.history) ||
    s.history.length > MAX_HISTORY ||
    s.history.some(
      (event) =>
        !event ||
        !RELEASE.test(event.release) ||
        !['start', 'update', 'stop', 'failed', 'rollback'].includes(event.action) ||
        !Number.isFinite(Date.parse(event.at)),
    )
  ) {
    throw new Error('Unsafe Node runtime record');
  }
  return s;
}
