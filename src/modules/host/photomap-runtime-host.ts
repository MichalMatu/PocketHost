import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  closeSync,
  existsSync,
  lstatSync,
  openSync,
  readFileSync,
  readlinkSync,
  realpathSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { createServer } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import {
  attestsManagedProcess,
  processGroupAbsent,
} from './managed-process-guards.ts';
import { formatRuntimeEvent, type RuntimeEventCode } from '../../shared/runtime-diagnostics.ts';
import { directory, json } from './managed-runtime-files.ts';
import { loadPhotoMapPlan, RELEASE, type LaunchPlan } from './photomap-runtime-plan.ts';
import {
  captureManagedDescendants,
  observedDescendantsExited,
} from './managed-proc-tree.ts';
import {
  admitOwnedStart,
  awaitOwnedReadiness,
  stopOwnedProcessSafely,
} from './managed-process-supervisor.ts';
import {
  OWNED_PHOTOMAP_ID,
  OWNED_PHOTOMAP_PORT,
  type PhotoMapRuntimePort,
  type PhotoMapRuntimeSnapshot,
} from '../../shared/photomap-runtime.ts';

const VERSION = /^[a-z0-9][a-z0-9-]{1,63}$/;
const LOG_LIMIT = 65536;

interface OwnedMarker {
  schema: 1;
  owner: 'pockethost';
  instance: typeof OWNED_PHOTOMAP_ID;
  release: typeof RELEASE;
  runtimeVersion: string;
  pid: number;
  startTicks: string;
  executable: string;
  cwd: string;
  argvSha256: string;
}

function startTicks(pid: number): string | null {
  if (!Number.isSafeInteger(pid) || pid < 2) return null;
  try {
    const raw = readFileSync('/proc/' + pid + '/stat', 'utf8');
    const fields = raw
      .slice(raw.lastIndexOf(')') + 2)
      .trim()
      .split(/\s+/);
    const ticks = fields[19];
    return ticks && /^\d+$/.test(ticks) ? ticks : null;
  } catch {
    return null;
  }
}

function digest(args: ReadonlyArray<string>): string {
  return createHash('sha256').update(JSON.stringify(args)).digest('hex');
}

function portFree(): Promise<boolean> {
  return new Promise((resolve) => {
    const listener = createServer();
    listener.once('error', () => resolve(false));
    listener.listen(OWNED_PHOTOMAP_PORT, '127.0.0.1', () => listener.close(() => resolve(true)));
  });
}

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Project-local PhotoMap runtime candidate. The imported device manifests are
 * disabled, so this adapter cannot launch anything before a separate approved
 * isolated-rootfs/profile transaction. No automatic startup is implemented.
 */
export class ManagedPhotoMapRuntimeHost implements PhotoMapRuntimePort {
  private readonly root: string;
  private readonly instance: string;
  private readonly state: string;

  constructor(root = path.join(realpathSync(os.homedir()), 'Projects', 'PocketHost-Managed')) {
    this.root = root;
    this.instance = path.join(root, 'instances', OWNED_PHOTOMAP_ID);
    this.state = path.join(this.instance, 'runtime', 'state');
  }

  private plan(): LaunchPlan | null {
    return loadPhotoMapPlan(this.root, this.instance);
  }

  private marker(): OwnedMarker | null {
    const file = path.join(this.state, 'active.json');
    if (!existsSync(file)) return null;
    directory(this.state);
    const item = json(file) as unknown as OwnedMarker;
    if (
      item.schema !== 1 ||
      item.owner !== 'pockethost' ||
      item.instance !== OWNED_PHOTOMAP_ID ||
      item.release !== RELEASE ||
      !VERSION.test(item.runtimeVersion) ||
      !Number.isSafeInteger(item.pid) ||
      item.pid < 2 ||
      !/^\d+$/.test(item.startTicks) ||
      !/^[a-f0-9]{64}$/.test(item.argvSha256) ||
      typeof item.executable !== 'string' ||
      typeof item.cwd !== 'string'
    ) {
      throw new Error('Unsafe PhotoMap process marker');
    }
    return item;
  }

  private owned(marker: OwnedMarker, plan: LaunchPlan): boolean {
    if (
      marker.runtimeVersion !== plan.version ||
      marker.executable !== plan.executable ||
      marker.cwd !== plan.versionRoot ||
      marker.argvSha256 !== digest(plan.args) ||
      startTicks(marker.pid) !== marker.startTicks
    ) {
      return false;
    }
    try {
      const exe = readlinkSync('/proc/' + marker.pid + '/exe');
      const cwd = readlinkSync('/proc/' + marker.pid + '/cwd');
      const argv = readFileSync('/proc/' + marker.pid + '/cmdline', 'utf8')
        .split('\0')
        .filter(Boolean);
      return attestsManagedProcess(
        {
          pid: marker.pid,
          startTicks: marker.startTicks,
          executable: plan.executable,
          cwd: plan.versionRoot,
          argvSha256: marker.argvSha256,
        },
        {
          pid: marker.pid,
          startTicks: startTicks(marker.pid) ?? '',
          executable: exe,
          cwd,
          argvSha256: digest(argv.slice(1)),
        },
      );
    } catch {
      return false;
    }
  }

  inspect(): PhotoMapRuntimeSnapshot {
    const plan = this.plan();
    const basic: PhotoMapRuntimeSnapshot = {
      version: 1,
      id: OWNED_PHOTOMAP_ID,
      ownership: 'pockethost',
      sourceRelease: RELEASE,
      runtimeVersion: plan?.version ?? null,
      state: 'disabled',
      port: OWNED_PHOTOMAP_PORT,
      autostart: false,
      manualStartAllowed: false,
      healthy: null,
    };
    if (!plan) {
      // Disabled flags never hide an already recorded or suspicious process marker.
      const runtimeDir = lstatSync(path.join(this.instance, 'runtime'), {
        throwIfNoEntry: false,
      });
      if (runtimeDir && (!runtimeDir.isDirectory() || runtimeDir.isSymbolicLink())) {
        throw new Error('Unsafe disabled PhotoMap process-state directory');
      }
      const state = lstatSync(this.state, { throwIfNoEntry: false });
      if (state && (!state.isDirectory() || state.isSymbolicLink())) {
        throw new Error('Unsafe disabled PhotoMap process-state directory');
      }
      const file = path.join(this.state, 'active.json');
      if (state && lstatSync(file, { throwIfNoEntry: false })) {
        return { ...basic, state: 'unknown' };
      }
      return basic;
    }
    const marker = this.marker();
    const state = !marker
      ? 'stopped'
      : this.owned(marker, plan)
        ? 'running'
        : startTicks(marker.pid) === null
          ? 'stopped'
          : 'unknown';
    return { ...basic, state, manualStartAllowed: true };
  }

  private event(message: RuntimeEventCode): void {
    if (!existsSync(this.state)) return;
    directory(this.state);
    const file = path.join(this.state, 'events.log');
    if (existsSync(file)) {
      const stat = lstatSync(file);
      if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('Unsafe event log');
      if (stat.size > LOG_LIMIT) unlinkSync(file);
    }
    writeFileSync(file, formatRuntimeEvent(OWNED_PHOTOMAP_ID, message), {
      flag: 'a',
      mode: 0o600,
    });
  }

  async start(): Promise<PhotoMapRuntimeSnapshot> {
    const plan = this.plan();
    if (!plan) throw new Error('PhotoMap runtime not approved for launch');
    const current = this.inspect();
    if (current.state === 'running') return current;
    if (current.state !== 'stopped' || this.marker()) {
      throw new Error('Unverified PhotoMap process state; start denied');
    }
    await admitOwnedStart({
      approved: () => this.plan() !== null,
      noUnresolvedMarker: () => this.marker() === null,
      portFree,
    });
    directory(this.state);
    const claim = path.join(this.state, 'start.claim');
    const handle = openSync(claim, 'wx', 0o600);
    closeSync(handle);
    try {
      const child = spawn(plan.executable, plan.args, {
        cwd: plan.versionRoot,
        shell: false,
        detached: true,
        stdio: 'ignore',
        env: {
          PATH: process.env.PREFIX + '/bin',
          HOME: plan.versionRoot,
          PYTHONDONTWRITEBYTECODE: '1',
          PHOTOMAP_ENV: 'development',
          PHOTOMAP_DATA_DIR: '/mnt/data',
          DATABASE_URL: 'sqlite:////mnt/data/app.db',
          PHOTOMAP_STORAGE_DIR: '/mnt/storage',
          PHOTOMAP_FRONTEND_DIST_DIR: '/mnt/source/frontend/dist',
          PHOTOMAP_ALLOWED_HOSTS: 'localhost,127.0.0.1',
          FRONTEND_ORIGINS: 'http://127.0.0.1:8010,http://localhost:8010',
        },
      });
      child.on('error', () => {
        // A failed native spawn never permits PID-only cleanup.
      });
      if (!child.pid) throw new Error('PRoot spawn did not return an owned PID');
      let ticks: string | null = null;
      for (let i = 0; i < 30; i++) {
        ticks = startTicks(child.pid);
        if (ticks) break;
        await pause(40);
      }
      if (!ticks) throw new Error('Cannot attest PRoot process start ticks');
      const marker: OwnedMarker = {
        schema: 1,
        owner: 'pockethost',
        instance: OWNED_PHOTOMAP_ID,
        release: RELEASE,
        runtimeVersion: plan.version,
        pid: child.pid,
        startTicks: ticks,
        executable: plan.executable,
        cwd: plan.versionRoot,
        argvSha256: digest(plan.args),
      };
      writeFileSync(path.join(this.state, 'active.json'), JSON.stringify(marker) + '\n', {
        flag: 'wx',
        mode: 0o600,
      });
      child.unref();
      this.event('manual-start-requested');
      try {
        await awaitOwnedReadiness({
          identityMatches: () => this.owned(marker, plan),
          health: () => this.health(),
          pause: () => pause(110),
          maxPolls: 45,
        });
        return this.inspect();
      } catch {
        try {
          if (this.owned(marker, plan)) await this.stop();
        } catch {
          // Retain the marker if safe cleanup cannot be established.
        }
        this.event('manual-start-health-failed');
        throw new Error('PhotoMap managed health acceptance failed');
      }
    } finally {
      unlinkSync(claim);
    }
  }

  async stop(): Promise<PhotoMapRuntimeSnapshot> {
    const plan = this.plan();
    if (!plan) throw new Error('PhotoMap runtime not approved for stop');
    const marker = this.marker();
    if (!marker) return this.inspect();
    if (!this.owned(marker, plan)) {
      throw new Error('Unverified PhotoMap process identity; stop denied');
    }
    const descendants = captureManagedDescendants(
      marker.pid,
      (pid) => {
        try {
          return readFileSync('/proc/' + pid + '/task/' + pid + '/children', 'utf8');
        } catch {
          return null;
        }
      },
      startTicks,
    );
    if (descendants === null) {
      throw new Error('Cannot attest owned PRoot descendant graph; stop denied');
    }
    try {
      await stopOwnedProcessSafely({
        verifyOwnership: () => this.owned(marker, plan),
        signalOwnedLeader: () => process.kill(marker.pid, 'SIGTERM'),
        observe: async () => ({
          leaderExited: startTicks(marker.pid) === null,
          portReleased: await portFree(),
          descendantsExited:
            observedDescendantsExited(descendants, startTicks) &&
            processGroupAbsent(marker.pid, (pgid) => {
              try {
                process.kill(-pgid, 0);
                return 'present';
              } catch (error) {
                return (error as NodeJS.ErrnoException).code === 'ESRCH' ? 'absent' : 'unknown';
              }
            }),
        }),
        pause: () => pause(100),
        maxPolls: 40,
      });
    } catch {
      this.event('manual-stop-uncertain');
      throw new Error('PhotoMap graceful stop uncertain; marker retained');
    }
    unlinkSync(path.join(this.state, 'active.json'));
    this.event('manual-stop-completed');
    return this.inspect();
  }

  async health(): Promise<boolean> {
    const plan = this.plan();
    const marker = plan ? this.marker() : null;
    if (!plan || !marker || !this.owned(marker, plan)) return false;
    try {
      const res = await fetch('http://127.0.0.1:8010/health', {
        signal: AbortSignal.timeout(1000),
      });
      return res.status === 200;
    } catch {
      return false;
    }
  }

  readLogs(): ReadonlyArray<string> {
    if (!existsSync(this.state)) return [];
    directory(this.state);
    const file = path.join(this.state, 'events.log');
    if (!existsSync(file)) return [];
    const stat = lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > LOG_LIMIT * 2) {
      throw new Error('Unsafe managed runtime log');
    }
    return readFileSync(file, 'utf8')
      .split('\n')
      .filter(Boolean)
      .slice(-40)
      .map((line) => line.slice(0, 240));
  }
}
