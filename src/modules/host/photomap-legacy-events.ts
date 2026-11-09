import { runtimeEventHistory } from '../../shared/runtime-diagnostics.ts';

const LEGACY_ID = 'photomap-test';

export interface LegacyPhotoMapEvents {
  readonly state: 'ok' | 'unavailable';
  readonly events: ReadonlyArray<{
    readonly timestamp: string;
    readonly instanceId: typeof LEGACY_ID;
    readonly code: string;
  }>;
}

/**
 * Isolated P4 compatibility-only diagnostics reader.
 * It does not discover, start, stop or adopt processes. It can only
 * sanitize events supplied by the existing explicit PhotoMap log reader.
 */
export function readLegacyPhotoMapEvents(readLogs: () => ReadonlyArray<string>): LegacyPhotoMapEvents {
  try {
    const events = runtimeEventHistory(readLogs())
      .filter((event) => event.instanceId === LEGACY_ID)
      .slice(-20)
      .map(({ timestamp, code }) => ({ timestamp, instanceId: LEGACY_ID, code }));
    return { state: 'ok', events };
  } catch {
    return { state: 'unavailable', events: [] };
  }
}
