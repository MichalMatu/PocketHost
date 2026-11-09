/** Shizuku-backed Android capabilities are negotiated, not inferred. */
export type ShizukuPrivilege = 'none' | 'adb' | 'root';
export type ShizukuConnection =
  'not-connected' | 'pending-authorization' | 'connected' | 'unavailable';
export type ShizukuCapability =
  | 'cpu-and-processes'
  | 'apps-and-packages'
  | 'permissions'
  | 'android-services'
  | 'device-settings'
  | 'storage'
  | 'advanced-shell';
export type ShizukuCapabilityStatus =
  'available' | 'requires-authorization' | 'unsupported' | 'unknown';

export interface ShizukuCapabilityResult {
  capability: ShizukuCapability;
  status: ShizukuCapabilityStatus;
  explanation?: string;
}

export interface ShizukuSession {
  version: 1;
  source: 'android-companion';
  connection: ShizukuConnection;
  privilege: ShizukuPrivilege;
  authorization: 'unknown' | 'not-granted' | 'granted';
  observedAt: string;
  capabilities: ShizukuCapabilityResult[];
}

/** Source candidate only. No native companion or session is connected yet. */
export const INITIAL_SHIZUKU_SESSION: Readonly<
  Pick<ShizukuSession, 'version' | 'connection' | 'privilege' | 'authorization'>
> = {
  version: 1,
  connection: 'not-connected',
  privilege: 'none',
  authorization: 'unknown',
};
