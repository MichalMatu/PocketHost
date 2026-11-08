/** Device-local telemetry from the Android Companion (not a privileged command endpoint). */
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

/** Android shared loopback is accessible from Termux without ADB/app_process. */
export async function readCompanionStatus() {
  const response = await fetch('http://127.0.0.1:18791/status', {
    method: 'GET',
    redirect: 'error',
    cache: 'no-store',
    signal: AbortSignal.timeout(3500),
  });
  if (!response.ok) throw new Error('companion-unavailable');
  const raw = await response.text();
  if (raw.length > 16384) throw new Error('companion-response-too-large');
  return parseCompanionStatus(raw);
}


/** Read-only Android package inventory; status and authorization must be fresh. */
export function parseCompanionApps(raw) {
  const data = JSON.parse(raw);
  if (!data || typeof data !== 'object' || Array.isArray(data) ||
      data.version !== 1 || data.source !== 'android-companion' ||
      data.connected !== true || data.authorized !== true ||
      !['adb', 'root'].includes(data.mode) ||
      typeof data.observedAt !== 'string' ||
      Number.isNaN(Date.parse(data.observedAt)) ||
      Math.abs(Date.now() - Date.parse(data.observedAt)) > 300000 ||
      typeof data.truncated !== 'boolean' ||
      !Array.isArray(data.packages) || data.packages.length > 1024) {
    throw new Error('invalid-android-package-inventory');
  }
  const seen = new Set();
  for (const entry of data.packages) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry) ||
        Object.keys(entry).sort().join(',') !== 'packageName,system' ||
        typeof entry.packageName !== 'string' ||
        entry.packageName.length > 200 ||
        !/^[A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)+$/.test(entry.packageName) ||
        typeof entry.system !== 'boolean' || seen.has(entry.packageName)) {
      throw new Error('invalid-android-package-entry');
    }
    seen.add(entry.packageName);
  }
  return data;
}

export async function readCompanionApps() {
  const status = await readCompanionStatus();
  if (!status.connected || !status.authorized) {
    throw new Error('companion-not-authorized');
  }
  const response = await fetch('http://127.0.0.1:18791/apps', {
    method: 'GET', redirect: 'error', cache: 'no-store',
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error('android-apps-unavailable');
  const raw = await response.text();
  if (raw.length > 280000) throw new Error('android-apps-response-too-large');
  const apps = parseCompanionApps(raw);
  if (apps.mode !== status.mode) throw new Error('android-apps-privilege-mismatch');
  return apps;
}


/**
 * Fixed read-only system channel. The privileged owner actions are bound
 * only to on-device Companion UI; never proxy command execution to LAN.
 */
export function parseCompanionSystem(raw) {
  const d = JSON.parse(raw);
  if (!d || typeof d !== 'object' || Array.isArray(d) ||
      d.version !== 1 || d.source !== 'android-companion' ||
      d.connected !== true || d.authorized !== true ||
      !['adb', 'root'].includes(d.mode) ||
      typeof d.observedAt !== 'string' || Number.isNaN(Date.parse(d.observedAt)) ||
      Math.abs(Date.now() - Date.parse(d.observedAt)) > 120000 ||
      !Array.isArray(d.processes) || d.processes.length > 1200 ||
      typeof d.processesTruncated !== 'boolean') throw new Error('invalid-android-system');
  if (d.processError !== undefined &&
      (typeof d.processError !== 'string' || d.processError.length > 120)) {
    throw new Error('invalid-process-error');
  }
  const seen = new Set();
  for (const p of d.processes) {
    if (!p || typeof p !== 'object' ||
        !Number.isSafeInteger(p.pid) || p.pid < 1 || seen.has(p.pid) ||
        typeof p.user !== 'string' || p.user.length > 48 ||
        typeof p.name !== 'string' || p.name.length > 160 ||
        (p.rssKb !== null && (!Number.isSafeInteger(p.rssKb) || p.rssKb < 0)) ||
        (p.cpuPercent !== null && (typeof p.cpuPercent !== 'number' ||
          !Number.isFinite(p.cpuPercent) || p.cpuPercent < 0 || p.cpuPercent > 100))) {
      throw new Error('invalid-android-process');
    }
    seen.add(p.pid);
  }
  if (!d.power || typeof d.power !== 'object' || Array.isArray(d.power) ||
      !d.settings || typeof d.settings !== 'object' ||
      !d.services || typeof d.services !== 'object' ||
      !Array.isArray(d.services.names) || d.services.names.length > 96 ||
      d.services.names.some(s => typeof s !== 'string' || s.length > 300) ||
      typeof d.services.truncated !== 'boolean') throw new Error('invalid-android-diagnostics');
  return d;
}

export async function readCompanionSystem() {
  const status = await readCompanionStatus();
  if (!status.connected || !status.authorized) throw new Error('companion-not-authorized');
  const response = await fetch('http://127.0.0.1:18791/system', {
    method: 'GET', redirect: 'error', cache: 'no-store',
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) throw new Error('android-system-unavailable');
  const raw = await response.text();
  if (raw.length > 380000) throw new Error('android-system-response-too-large');
  const d = parseCompanionSystem(raw);
  if (d.mode !== status.mode) throw new Error('android-system-mode-mismatch');
  return d;
}
