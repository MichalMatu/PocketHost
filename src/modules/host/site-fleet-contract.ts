export interface SiteDeployment {
  at: string;
  action: 'publish' | 'rollback' | 'restore' | 'prune';
  from: string | null;
  to: string;
}
export interface RecordOnDisk {
  schema: 1;
  id: string;
  name: string;
  owner: 'pockethost-h2';
  instance: string;
  port: number;
  activeRelease: string | null;
  previousRelease: string | null;
  process: { pid: number; ticks: string; startedAt: string } | null;
  createdAt: string;
  history: SiteDeployment[];
}
export interface FleetProject {
  id: string;
  name: string;
  kind: 'static-site';
  state: 'stopped' | 'running' | 'unknown';
  port: number;
  activeRelease: string | null;
  previousRelease: string | null;
  canRollback: boolean;
  pid: number | null;
  startTicks: string | null;
  fileCount: number;
  bytes: number;
  releases: number;
  memoryBytes: number | null;
  uptimeSeconds: number | null;
  healthy: boolean | null;
  history: SiteDeployment[];
}
export interface FleetFile {
  name: string;
  bytes: Buffer;
}

export interface FleetRelease {
  id: string;
  createdAt: string;
  fileCount: number;
  bytes: number;
  active: boolean;
  rollbackTarget: boolean;
}

export function validateName(name: unknown): string {
  if (
    typeof name !== 'string' ||
    name.trim().length < 2 ||
    name.trim().length > 60 ||
    !/^[\p{L}\p{N}][\p{L}\p{N} ._-]*$/u.test(name.trim())
  )
    throw new RangeError('Site name must contain 2–60 safe characters');
  return name.trim();
}
