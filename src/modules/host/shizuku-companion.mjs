import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);
const STATUS_URI = 'content://pl.pockethost.companion.telemetry/status';

/** A device-local, read-only Android IPC result: no arbitrary commands. */
export function parseCompanionStatus(raw) {
  const value = JSON.parse(raw);
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      value.version !== 1 || value.source !== 'android-companion' ||
      typeof value.connected !== 'boolean' ||
      typeof value.authorized !== 'boolean' ||
      !['adb', 'root', 'none'].includes(value.mode) ||
      typeof value.observedAt !== 'string' ||
      Number.isNaN(Date.parse(value.observedAt)) ||
      Math.abs(Date.now() - Date.parse(value.observedAt)) > 60000 ||
      !Array.isArray(value.capabilities) || value.capabilities.length > 96) {
    throw new Error('invalid-companion-telemetry');
  }
  for (const field of ['cpuPercent', 'visibleProcesses']) {
    const n = value[field];
    if (n !== null && (typeof n !== 'number' || !Number.isFinite(n) ||
        n < 0 || (field === 'cpuPercent' && n > 100) ||
        (field === 'visibleProcesses' && !Number.isSafeInteger(n)))) {
      throw new Error('invalid-companion-metric');
    }
  }
  if ((value.connected || value.authorized) && value.mode === 'none') {
    throw new Error('invalid-companion-privilege');
  }
  if (!value.authorized && (value.cpuPercent !== null || value.visibleProcesses !== null)) {
    throw new Error('unauthorized-companion-telemetry');
  }
  const capabilities = value.capabilities.map((cap) => {
    if (!cap || typeof cap !== 'object' || typeof cap.id !== 'string' ||
        cap.id.length < 1 || cap.id.length > 90 ||
        typeof cap.title !== 'string' || cap.title.length > 100 ||
        typeof cap.available !== 'boolean' || typeof cap.description !== 'string' ||
        cap.description.length > 220) {
      throw new Error('invalid-companion-capabilities');
    }
    return { id: cap.id, title: cap.title, available: cap.available, description: cap.description };
  });
  return {
    version: 1,
    source: 'android-companion',
    connected: value.connected,
    authorized: value.authorized,
    mode: value.mode,
    observedAt: value.observedAt,
    cpuPercent: value.cpuPercent,
    visibleProcesses: value.visibleProcesses,
    capabilities,
  };
}

export async function readCompanionStatus() {
  const { stdout } = await run('/system/bin/content', ['read', '--uri', STATUS_URI], {
    timeout: 4000,
    maxBuffer: 16384,
    encoding: 'utf8',
    shell: false,
  });
  return parseCompanionStatus(stdout);
}
