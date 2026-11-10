/** Device-local telemetry from the Android Companion (not a privileged command endpoint). */
export function parseCompanionStatus(raw) {
  const value = JSON.parse(raw);
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    value.version !== 1 ||
    value.source !== 'android-companion' ||
    typeof value.connected !== 'boolean' ||
    typeof value.authorized !== 'boolean' ||
    !['adb', 'root', 'none'].includes(value.mode) ||
    typeof value.observedAt !== 'string' ||
    Number.isNaN(Date.parse(value.observedAt)) ||
    Math.abs(Date.now() - Date.parse(value.observedAt)) > 60000 ||
    !Array.isArray(value.capabilities) ||
    value.capabilities.length > 96
  ) {
    throw new Error('invalid-companion-telemetry');
  }
  for (const field of ['cpuPercent', 'visibleProcesses']) {
    const n = value[field];
    if (
      n !== null &&
      (typeof n !== 'number' ||
        !Number.isFinite(n) ||
        n < 0 ||
        (field === 'cpuPercent' && n > 100) ||
        (field === 'visibleProcesses' && !Number.isSafeInteger(n)))
    ) {
      throw new Error('invalid-companion-metric');
    }
  }
  if (value.uid !== undefined && value.uid !== null && value.uid !== 0 && value.uid !== 2000) {
    throw new Error('invalid-companion-uid');
  }
  if ((value.connected || value.authorized) && value.mode === 'none') {
    throw new Error('invalid-companion-privilege');
  }
  if (
    !value.authorized &&
    (value.cpuPercent !== null || value.visibleProcesses !== null || value.uid != null)
  ) {
    throw new Error('unauthorized-companion-telemetry');
  }
  // Backward-compatible: an older installed APK does not yet publish network counters.
  const network = value.network;
  if (network !== undefined) {
    if (!network || typeof network !== 'object' || Array.isArray(network) ||
      Object.keys(network).sort().join(',') !== 'observedAt,rxBytes,scope,source,txBytes' ||
      network.source !== 'android-trafficstats' ||
      network.scope !== 'all-interfaces-since-boot' ||
      typeof network.observedAt !== 'string' ||
      !Number.isFinite(Date.parse(network.observedAt)) ||
      Math.abs(Date.now() - Date.parse(network.observedAt)) > 60000 ||
      !['rxBytes', 'txBytes'].every(k =>
        network[k] === null || (Number.isSafeInteger(network[k]) && network[k] >= 0))) {
      throw new Error('invalid-companion-network');
    }
  }
  const capabilities = value.capabilities.map((cap) => {
    if (
      !cap ||
      typeof cap !== 'object' ||
      typeof cap.id !== 'string' ||
      cap.id.length < 1 ||
      cap.id.length > 90 ||
      typeof cap.title !== 'string' ||
      cap.title.length > 100 ||
      typeof cap.available !== 'boolean' ||
      typeof cap.description !== 'string' ||
      cap.description.length > 220
    ) {
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
    ...(value.uid === undefined ? {} : { uid: value.uid }),
    observedAt: value.observedAt,
    cpuPercent: value.cpuPercent,
    visibleProcesses: value.visibleProcesses,
    capabilities,
    ...(network === undefined ? {} : { network }),
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
  if (
    !data ||
    typeof data !== 'object' ||
    Array.isArray(data) ||
    data.version !== 1 ||
    data.source !== 'android-companion' ||
    data.connected !== true ||
    data.authorized !== true ||
    !['adb', 'root'].includes(data.mode) ||
    typeof data.observedAt !== 'string' ||
    Number.isNaN(Date.parse(data.observedAt)) ||
    Math.abs(Date.now() - Date.parse(data.observedAt)) > 300000 ||
    typeof data.truncated !== 'boolean' ||
    !Array.isArray(data.packages) ||
    data.packages.length > 1024
  ) {
    throw new Error('invalid-android-package-inventory');
  }
  const seen = new Set();
  for (const entry of data.packages) {
    if (
      !entry ||
      typeof entry !== 'object' ||
      Array.isArray(entry) ||
      Object.keys(entry).sort().join(',') !== 'enabled,label,packageName,system' ||
      typeof entry.packageName !== 'string' ||
      entry.packageName.length > 200 ||
      !/^[A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)+$/.test(entry.packageName) ||
      typeof entry.system !== 'boolean' ||
      typeof entry.label !== 'string' ||
      entry.label.length > 120 ||
      (entry.enabled !== null && typeof entry.enabled !== 'boolean') ||
      seen.has(entry.packageName)
    ) {
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
    method: 'GET',
    redirect: 'error',
    cache: 'no-store',
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
  if (
    !d ||
    typeof d !== 'object' ||
    Array.isArray(d) ||
    d.version !== 1 ||
    d.source !== 'android-companion' ||
    d.connected !== true ||
    d.authorized !== true ||
    !['adb', 'root'].includes(d.mode) ||
    typeof d.observedAt !== 'string' ||
    Number.isNaN(Date.parse(d.observedAt)) ||
    Math.abs(Date.now() - Date.parse(d.observedAt)) > 120000 ||
    !Array.isArray(d.processes) ||
    d.processes.length > 1200 ||
    typeof d.processesTruncated !== 'boolean'
  )
    throw new Error('invalid-android-system');
  if (
    d.processError !== undefined &&
    (typeof d.processError !== 'string' || d.processError.length > 120)
  ) {
    throw new Error('invalid-process-error');
  }
  const seen = new Set();
  for (const p of d.processes) {
    if (
      !p ||
      typeof p !== 'object' ||
      !Number.isSafeInteger(p.pid) ||
      p.pid < 1 ||
      seen.has(p.pid) ||
      typeof p.user !== 'string' ||
      p.user.length > 48 ||
      typeof p.name !== 'string' ||
      p.name.length > 160 ||
      (p.rssKb !== null && (!Number.isSafeInteger(p.rssKb) || p.rssKb < 0)) ||
      (p.cpuPercent !== null &&
        (typeof p.cpuPercent !== 'number' ||
          !Number.isFinite(p.cpuPercent) ||
          p.cpuPercent < 0 ||
          p.cpuPercent > 100))
    ) {
      throw new Error('invalid-android-process');
    }
    seen.add(p.pid);
  }
  if (
    !d.power ||
    typeof d.power !== 'object' ||
    Array.isArray(d.power) ||
    !d.settings ||
    typeof d.settings !== 'object' ||
    !d.services ||
    typeof d.services !== 'object' ||
    !Array.isArray(d.services.names) ||
    d.services.names.length > 256 ||
    d.services.names.some((s) => typeof s !== 'string' || s.length > 300) ||
    typeof d.services.truncated !== 'boolean'
  )
    throw new Error('invalid-android-diagnostics');
  return d;
}

export async function readCompanionSystem() {
  const status = await readCompanionStatus();
  if (!status.connected || !status.authorized) throw new Error('companion-not-authorized');
  const response = await fetch('http://127.0.0.1:18791/system', {
    method: 'GET',
    redirect: 'error',
    cache: 'no-store',
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) throw new Error('android-system-unavailable');
  const raw = await response.text();
  if (raw.length > 380000) throw new Error('android-system-response-too-large');
  const d = parseCompanionSystem(raw);
  if (d.mode !== status.mode) throw new Error('android-system-mode-mismatch');
  return d;
}

/** Strict read-only metadata from Android PackageManager via the native Companion. */
export function parseCompanionApp(raw) {
  const d = JSON.parse(raw);
  if (
    !d ||
    typeof d !== 'object' ||
    Array.isArray(d) ||
    d.version !== 1 ||
    d.source !== 'android-companion' ||
    typeof d.packageName !== 'string' ||
    d.packageName.length > 200 ||
    !/^[A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)+$/.test(d.packageName) ||
    typeof d.label !== 'string' ||
    d.label.length > 120 ||
    typeof d.versionName !== 'string' ||
    d.versionName.length > 120 ||
    !Number.isSafeInteger(d.versionCode) ||
    d.versionCode < 0 ||
    !Number.isSafeInteger(d.targetSdk) ||
    d.targetSdk < 0 ||
    d.targetSdk > 100 ||
    typeof d.system !== 'boolean' ||
    typeof d.enabled !== 'boolean' ||
    !Array.isArray(d.permissions) ||
    d.permissions.length > 96 ||
    (d.iconPng !== undefined &&
      (typeof d.iconPng !== 'string' ||
        d.iconPng.length > 65000 ||
        !/^[A-Za-z0-9+/]+={0,2}$/.test(d.iconPng)))
  ) {
    throw new Error('invalid-android-app-details');
  }
  const seen = new Set();
  for (const p of d.permissions) {
    if (
      !p ||
      typeof p !== 'object' ||
      Array.isArray(p) ||
      Object.keys(p).sort().join(',') !== 'granted,name' ||
      typeof p.name !== 'string' ||
      p.name.length > 200 ||
      !/^[A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)+$/.test(p.name) ||
      typeof p.granted !== 'boolean' ||
      seen.has(p.name)
    ) {
      throw new Error('invalid-android-permission');
    }
    seen.add(p.name);
  }
  return d;
}

export async function readCompanionApp(packageName) {
  if (
    typeof packageName !== 'string' ||
    packageName.length > 200 ||
    !/^[A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)+$/.test(packageName)
  ) {
    throw new Error('invalid-package-name');
  }
  const status = await readCompanionStatus();
  if (!status.connected || !status.authorized) throw new Error('companion-not-authorized');
  const result = await fetch('http://127.0.0.1:18791/app?package=' + packageName, {
    method: 'GET',
    cache: 'no-store',
    redirect: 'error',
    signal: AbortSignal.timeout(8000),
  });
  if (!result.ok) throw new Error('android-app-details-unavailable');
  const raw = await result.text();
  if (raw.length > 90000) throw new Error('android-app-details-too-large');
  const data = parseCompanionApp(raw);
  if (data.packageName !== packageName) throw new Error('android-package-mismatch');
  return data;
}
