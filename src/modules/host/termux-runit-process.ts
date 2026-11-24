import { spawnSync } from 'node:child_process';
import { lstatSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { PREFIX, SERVICE_NAME } from './termux-worker-scripts.ts';
import type { RunitProcessObservation, TermuxService } from './termux-service-models.ts';

/**
 * Read-only process corroboration for an already-attested worker. The
 * supervisor's PID alone is not ownership proof: compare owner uid, procfs
 * start ticks and two runit reports; never read cmdline or execute code.
 * Any error or concurrent restart results in unverified rather than a PID.
 */
export function observeRunitProcess(
  serviceRoot: string,
  name: string,
  observed: TermuxService['state'],
): RunitProcessObservation {
  const unavailable: RunitProcessObservation = {
    status: observed === 'stopped' ? 'stopped' : 'unverified',
    pid: null,
    uptimeSeconds: null,
    startTicks: null,
  };
  if (observed !== 'running') return unavailable;
  const command = path.join(PREFIX, 'bin', 'sv');
  const unit = path.join(serviceRoot, name);
  const prefix = 'run: ' + unit + ': (pid ';
  const readSupervisor = (): { pid: number; uptimeSeconds: number } | null => {
    const result = spawnSync(command, ['status', unit], {
      encoding: 'utf8',
      shell: false,
      timeout: 1500,
      maxBuffer: 2048,
    });
    if (
      result.error ||
      result.status !== 0 ||
      typeof result.stdout !== 'string' ||
      !result.stdout.startsWith(prefix)
    )
      return null;
    const match = /^([1-9][0-9]{0,8})\) ([0-9]{1,10})s(?:;|$)/.exec(
      result.stdout.slice(prefix.length),
    );
    if (!match) return null;
    const pid = Number(match[1]);
    const uptimeSeconds = Number(match[2]);
    if (!Number.isSafeInteger(pid) || pid <= 1 || !Number.isSafeInteger(uptimeSeconds)) return null;
    return { pid, uptimeSeconds };
  };
  try {
    const first = readSupervisor();
    if (!first || typeof process.getuid?.() !== 'number') return unavailable;
    const procDir = path.join('/proc', String(first.pid));
    const directory = lstatSync(procDir);
    if (
      !directory.isDirectory() ||
      directory.isSymbolicLink() ||
      directory.uid !== process.getuid?.()
    )
      return unavailable;
    const stat = readFileSync(path.join(procDir, 'stat'), 'utf8');
    if (stat.length > 4096) return unavailable;
    const open = stat.indexOf(' (');
    const close = stat.lastIndexOf(') ');
    if (open < 1 || close <= open || Number(stat.slice(0, open)) !== first.pid) return unavailable;
    // After "(comm)", index 0 is proc stat field 3; index 19 is starttime (22).
    const fields = stat
      .slice(close + 2)
      .trim()
      .split(/\s+/);
    const startTicks = fields[19];
    if (!startTicks || !/^[0-9]{1,24}$/.test(startTicks) || /^0+$/.test(startTicks))
      return unavailable;
    const second = readSupervisor();
    if (!second || second.pid !== first.pid || second.uptimeSeconds < first.uptimeSeconds)
      return unavailable;
    const confirm = readFileSync(path.join(procDir, 'stat'), 'utf8');
    const confirmClose = confirm.lastIndexOf(') ');
    if (
      confirm.length > 4096 ||
      confirmClose < 0 ||
      confirm
        .slice(confirmClose + 2)
        .trim()
        .split(/\s+/)[19] !== startTicks
    )
      return unavailable;
    return {
      status: 'observed',
      pid: first.pid,
      uptimeSeconds: second.uptimeSeconds,
      startTicks,
    };
  } catch {
    return unavailable;
  }
}

/** Read-only runit liveness; never grants lifecycle ownership. */
export function readRunitState(serviceRoot: string, name: string): TermuxService['state'] {
  try {
    const result = spawnSync(
      path.join(PREFIX, 'bin', 'sv'),
      ['status', path.join(serviceRoot, name)],
      {
        encoding: 'utf8',
        shell: false,
        timeout: 1500,
        maxBuffer: 2048,
      },
    );
    if (result.stdout.startsWith('run: ')) return 'running';
    if (result.stdout.startsWith('down: ')) return 'stopped';
    return 'unknown';
  } catch {
    return 'unknown';
  }
}

/**
 * One bounded read-only status command for already discovered services.
 * Missing, ambiguous or failed results are unknown; this is never ownership proof.
 */
export function readRunitStates(
  serviceRoot: string,
  names: readonly string[],
  readStatus: (units: string[]) => string | null = (units) => {
    const result = spawnSync(path.join(PREFIX, 'bin', 'sv'), ['status', ...units], {
      encoding: 'utf8',
      shell: false,
      timeout: 5000,
      maxBuffer: 256 * 1024,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    // sv may return a nonzero count when only some units cannot be observed.
    return !result.error && result.status !== null ? result.stdout : null;
  },
): Map<string, TermuxService['state']> {
  if (
    !path.isAbsolute(serviceRoot) ||
    names.length > 100 ||
    new Set(names).size !== names.length ||
    names.some((name) => !SERVICE_NAME.test(name))
  )
    throw new RangeError('Invalid runit status batch');
  const states = new Map<string, TermuxService['state']>(names.map((name) => [name, 'unknown']));
  if (names.length === 0) return states;
  const units = new Map(names.map((name) => [path.join(serviceRoot, name), name]));
  let output: string | null;
  try {
    output = readStatus([...units.keys()]);
  } catch {
    return states;
  }
  if (typeof output !== 'string' || Buffer.byteLength(output) > 256 * 1024) return states;
  const seen = new Set<string>();
  for (const line of output.split('\n')) {
    const match = /^([^:]+): (.+?): (.*)$/.exec(line);
    if (!match || match[2] === undefined || match[3] === undefined) continue;
    const name = units.get(match[2]);
    if (!name) continue;
    const state =
      match[1] === 'run' && /^\(pid [1-9]\d*\) \d+s(?:[;,]|$)/.test(match[3])
        ? 'running'
        : match[1] === 'down' && /^\d+s(?:[;,]|$)/.test(match[3])
          ? 'stopped'
          : 'unknown';
    states.set(name, seen.has(name) || line.length > 2048 ? 'unknown' : state);
    seen.add(name);
  }
  return states;
}

/** Read-only runit down-marker readback, with callback ownership re-attestation. */
export function readRunitAutostart(
  serviceRoot: string,
  name: string,
  registered: boolean,
  verifyTarget: () => string,
): boolean | null {
  try {
    // Protected services remain read-only, but a fixed real runit
    // directory can reveal the autostart marker without granting control.
    const root = lstatSync(serviceRoot);
    const target = path.join(serviceRoot, name);
    const entry = lstatSync(target);
    if (!root.isDirectory() || root.isSymbolicLink()) return null;
    // termux-services commonly publishes its units as symlinks from
    // var/service to var/sv. A verified registered unit may use this
    // canonical form, but an unregistered alias remains read-only.
    if (entry.isSymbolicLink()) {
      if (!registered) return null;
    } else if (!entry.isDirectory()) return null;
    // Re-attest the exact symlink target before reading its down marker.
    if (registered) verifyTarget();
    const marker = path.join(serviceRoot, name, 'down');
    try {
      const state = lstatSync(marker);
      return state.isFile() && !state.isSymbolicLink() ? false : null;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return true;
      throw error;
    }
  } catch {
    return null;
  }
}
