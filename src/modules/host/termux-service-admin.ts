import { createHash, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  constants,
  openSync,
  closeSync,
  fstatSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  realpathSync,
  readlinkSync,
  unlinkSync,
  symlinkSync,
  renameSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { executeFixed, type Exec, type HostCommandResult } from './termux-admin.ts';
import { evaluateHealthPolicy } from '../../shared/hosting-health-policy.ts';
import {
  WorkerHeartbeatPolicy,
  type HeartbeatReadback,
  type HeartbeatThresholdSeconds,
} from './worker-heartbeat-policy.ts';

const PREFIX = '/data/data/com.termux/files/usr';
const SERVICE_NAME = /^[a-z][a-z0-9-]{1,63}$/;
// A service name or the existence of a runit directory is never evidence of
// PocketHost ownership. Only a trusted in-process provisioner can enroll a new
// unit, and every subsequent operation re-attests its canonical target.
// Preexisting service registrations keep their exact-target constraint.
const SYSTEM_SERVICE_NAMES = new Set([
  'sshd', 'ssh-agent', 'termux-agent',
  'pockethost-panel', 'pockethost-panel-watch',
]);
const MAX_ENTRIES = 100;
const MAX_MANAGED = 32;
const MAX_TEMPLATE_WORKERS = 4;
const RECOVERY_WINDOW_MS = 60 * 60 * 1000;
const RECOVERY_COOLDOWN_MS = 2 * 60 * 1000;
const RECOVERY_MAX_ATTEMPTS = 2;
export type WorkerTemplate = 'heartbeat-worker-v1' | 'python-heartbeat-v1' | 'python-source-v1';

interface Registration {
  name: string;
  target: string;
  addedAt: string;
  /** Missing only for pre-S1 legacy entries: these are read-only. */
  runSha256?: string;
}
interface ArchivedWorker {
  name: string;
  target: string;
  template: WorkerTemplate;
  instanceId: string;
  runSha256: string;
  sourceSha256?: string;
  archivedAt: string;
}
export interface ArchivedWorkerSummary {
  name: string;
  template: WorkerTemplate;
  identity: 'restorable' | 'changed' | 'conflict';
}
type ServiceIdentity = 'verified' | 'unregistered' | 'legacy' | 'changed' | 'archive-conflict' | 'reserved';
export type ServiceOperation =
  'register' | 'unregister' | 'start' | 'stop' | 'restart' | 'once' | 'enable' | 'disable';
interface RecoveryAttemptRecord {
  name: string;
  instanceId: string;
  /** Sorted timestamps; enforce a true rolling-hour budget. */
  attemptedAtMs: number[];
}
export interface RunitRecoveryReview {
  name: string;
  template: WorkerTemplate;
  observed: 'running' | 'stopped' | 'unknown';
  readiness: 'not-verified';
  action: 'start' | 'none' | 'blocked';
  reason: string;
  attempts: number;
  maxAttempts: number;
  nextEligibleAt: string | null;
  windowEndsAt: string | null;
  checkedAt: string;
}
export interface RunitHealthReadback {
  name: string;
  identity: 'verified';
  observed: 'running' | 'stopped' | 'unknown';
  /** Runit process liveness does not confer application readiness. */
  readiness: 'not-verified';
  heartbeat: HeartbeatReadback;
  autostart: boolean | null;
  logEvidence: 'log-write' | 'no-log' | 'untrusted';
  lastLogWriteAt: string | null;
  checkedAt: string;
}
export interface TermuxService {
  name: string;
  registered: boolean;
  protected: boolean;
  identity: ServiceIdentity;
  /** Only the fully attested built-in template grants archive capability. */
  template?: WorkerTemplate;
  /** Generic H3 controls never mutate units owned by a separate provisioner. */
  control: 'standalone' | 'delegated' | 'read-only';
  state: 'running' | 'stopped' | 'unknown';
  enabled?: boolean | null;
}

/**
 * Fixed, exact source identity for both available standalone templates.
 * This function is the allowed execution policy, not merely a display
 * label; recovery re-computes the same SHA-256 before re-enrollment.
 */
function builtinWorkerRunScript(template: WorkerTemplate, target: string): string {
  if (!['heartbeat-worker-v1', 'python-heartbeat-v1', 'python-source-v1'].includes(template))
    throw new RangeError('Invalid builtin worker');
  if (target !== path.join(PREFIX, 'var', 'sv', path.basename(target)))
    throw new Error('Unexpected builtin target path');
  const sh = path.join(PREFIX, 'bin', 'sh');
  const env = path.join(PREFIX, 'bin', 'env');
  const runtime = path.join(PREFIX, 'bin', template !== 'heartbeat-worker-v1' ? 'python' : 'node');
  if (template === 'python-source-v1')
    return '#!' + sh + '\nexec ' + env +
      ' -i PATH=' + path.join(PREFIX, 'bin') +
      ' HOME=' + target + ' TMPDIR=' + path.join(PREFIX, 'tmp') +
      ' ' + runtime + ' -I -u ' + path.join(target, 'worker.py') + '\n';
  const code = template === 'python-heartbeat-v1'
    ? 'import time\nprint("PocketHost Python worker started", flush=True)\nwhile True:\n    time.sleep(60)\n    print("PocketHost Python worker heartbeat", flush=True)'
    : 'console.log("PocketHost Node worker started"); setInterval(() => console.log("PocketHost Node worker heartbeat"), 60000)';
  return '#!' + sh + '\nexec ' + env +
    ' -i PATH=' + path.join(PREFIX, 'bin') +
    ' HOME=' + target + ' TMPDIR=' + path.join(PREFIX, 'tmp') +
    ' ' + runtime + (template === 'python-heartbeat-v1' ? ' -I -u -c ' : ' -e ') +
    "'" + code + "'\n";
}

/**
 * Runit's log child executes its own script. Reattest this exact fixed
 * source as well: verifying only the main run script is insufficient.
 */
function builtinWorkerLogScript(name: string): string {
  valid(name);
  const sh = path.join(PREFIX, 'bin', 'sh');
  const svlogd = path.join(PREFIX, 'bin', 'svlogd');
  const logTarget = path.join(PREFIX, 'var', 'log', 'sv', name);
  return '#!' + sh + '\nexec ' + svlogd + ' -tt ' + logTarget + '\n';
}

function valid(name: string): void {
  if (typeof name !== 'string' || !SERVICE_NAME.test(name))
    throw new RangeError('Invalid runit service name');
}

/** SHA-256 for an exact owner-private script; never evaluates Python source. */
function pythonWorkerSourceHash(target: string): string | null {
  try {
    const file = path.join(target, 'worker.py');
    const stat = lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 ||
        stat.uid !== process.getuid?.() || (stat.mode & 0o077) !== 0 ||
        stat.size === 0 || stat.size > 32 * 1024)
      return null;
    return createHash('sha256').update(readFileSync(file)).digest('hex');
  } catch { return null; }
}
function isReserved(name: string, resolved?: string): boolean {
  return SYSTEM_SERVICE_NAMES.has(name) ||
    (resolved !== undefined && SYSTEM_SERVICE_NAMES.has(path.basename(resolved)));
}
function safeFile(file: string): string | null {
  try {
    const stat = lstatSync(file);
    if (stat.isSymbolicLink() || !stat.isFile() || stat.size > 20000)
      throw new Error('Unsafe runit registry');
    return readFileSync(file, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}

/**
 * No service is adopted by observation. Only an explicit registration of
 * an existing exact canonical runit target confers management capability.
 * An exact target mismatch or protected service always refuses commands.
 */
export class TermuxServiceAdmin {
  private readonly serviceRoot: string;
  private readonly registerFile: string;
  private readonly archiveFile: string;
  private readonly recoveryFile: string;
  private readonly retiredRoot: string;
  private readonly heartbeatPolicy: WorkerHeartbeatPolicy;
  constructor(
    serviceRoot = path.join(PREFIX, 'var', 'service'),
    registerFile = path.join(
      os.homedir(),
      '.local',
      'state',
      'pockethost',
      'h3-runit-registry.json',
    ),
  ) {
    this.serviceRoot = serviceRoot;
    this.registerFile = registerFile;
    this.archiveFile = path.join(path.dirname(registerFile), 'h3-archived-workers.json');
    this.recoveryFile = path.join(path.dirname(registerFile), 'h3-worker-recovery.json');
    this.retiredRoot = path.join(path.dirname(registerFile), 'h3-retired-workers');
    this.heartbeatPolicy = new WorkerHeartbeatPolicy(path.dirname(registerFile));
  }

  private registry(): Registration[] {
    const raw = safeFile(this.registerFile);
    if (raw === null) return [];
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data) || data.length > MAX_MANAGED)
      throw new Error('Invalid runit registry');
    const names = new Set<string>();
    return data.map((entry: unknown) => {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry))
        throw new Error('Invalid runit registry entry');
      const value = entry as Record<string, unknown>;
      if (
        !['addedAt,name,target', 'addedAt,name,runSha256,target'].includes(
          Object.keys(value).sort().join(','),
        ) ||
        typeof value.name !== 'string' ||
        typeof value.target !== 'string' ||
        typeof value.addedAt !== 'string' ||
        !/^\d{4}-\d\d-\d\dT/.test(value.addedAt) ||
        (value.runSha256 !== undefined &&
          (typeof value.runSha256 !== 'string' || !/^[a-f0-9]{64}$/.test(value.runSha256))) ||
        isReserved(value.name, value.target) ||
        names.has(value.name)
      )
        throw new Error('Unsafe runit registration');
      valid(value.name);
      names.add(value.name);
      return {
        name: value.name,
        target: value.target,
        addedAt: value.addedAt,
        ...(typeof value.runSha256 === 'string' ? { runSha256: value.runSha256 } : {}),
      };
    });
  }

  private save(registrations: Registration[]): void {
    if (registrations.length > MAX_MANAGED) throw new RangeError('Too many managed services');
    const folder = path.dirname(this.registerFile);
    mkdirSync(folder, { recursive: true, mode: 0o700 });
    if (lstatSync(folder).isSymbolicLink() || !lstatSync(folder).isDirectory())
      throw new Error('Unsafe runit registry parent');
    safeFile(this.registerFile); // refuse an existing symlink, directory or malformed filesystem object
    const temporary = path.join(folder, '.runit-registry-' + randomUUID());
    writeFileSync(temporary, JSON.stringify(registrations) + '\n', { flag: 'wx', mode: 0o600 });
    try {
      renameSync(temporary, this.registerFile);
    } catch (error) {
      try {
        rmSync(temporary, { force: true });
      } catch {
        /* best effort */
      }
      throw error;
    }
  }

  /**
   * Private archive ledger is separate from live service authority. A marker
   * alone can never adopt a foreign or abandoned service into the registry.
   */
  private archivedRegistry(): ArchivedWorker[] {
    try {
      const file = lstatSync(this.archiveFile);
      if (!file.isFile() || file.isSymbolicLink() || file.nlink !== 1 ||
          file.uid !== process.getuid?.() || (file.mode & 0o077) !== 0)
        throw new Error('Unsafe archive ledger permissions');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw error;
    }
    const raw = safeFile(this.archiveFile);
    if (raw === null) throw new Error('Archive ledger disappeared during read');
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value) || value.length > MAX_TEMPLATE_WORKERS)
      throw new Error('Invalid archived worker ledger');
    const seen = new Set<string>();
    return value.map((candidate: unknown) => {
      if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate))
        throw new Error('Invalid archived worker entry');
      const v = candidate as Record<string, unknown>;
      if (!['archivedAt,instanceId,name,runSha256,target,template',
            'archivedAt,instanceId,name,runSha256,sourceSha256,target,template'].includes(
              Object.keys(v).sort().join(',')) ||
          typeof v.name !== 'string' || typeof v.target !== 'string' ||
          typeof v.instanceId !== 'string' || typeof v.runSha256 !== 'string' ||
          typeof v.archivedAt !== 'string' ||
          !['heartbeat-worker-v1', 'python-heartbeat-v1', 'python-source-v1'].includes(
            v.template as string) ||
          (v.template === 'python-source-v1'
            ? typeof v.sourceSha256 !== 'string' || !/^[a-f0-9]{64}$/.test(v.sourceSha256)
            : v.sourceSha256 !== undefined) ||
          !/^[0-9a-f-]{36}$/.test(v.instanceId) ||
          !/^[a-f0-9]{64}$/.test(v.runSha256) ||
          !Number.isFinite(Date.parse(v.archivedAt)) ||
          v.target !== path.join(PREFIX, 'var', 'sv', v.name) ||
          seen.has(v.name)) throw new Error('Untrusted archived worker entry');
      valid(v.name);
      if (isReserved(v.name)) throw new Error('Protected archive name');
      seen.add(v.name);
      return v as unknown as ArchivedWorker;
    });
  }

  private saveArchived(items: ArchivedWorker[]): void {
    if (items.length > MAX_TEMPLATE_WORKERS) throw new RangeError('Archive quota reached');
    const folder = path.dirname(this.archiveFile);
    mkdirSync(folder, { recursive: true, mode: 0o700 });
    const parent = lstatSync(folder);
    if (!parent.isDirectory() || parent.isSymbolicLink() ||
        parent.uid !== process.getuid?.() || (parent.mode & 0o077) !== 0)
      throw new Error('Unsafe archive state directory');
    // Refuse an existing archive with unsafe permissions or identity.
    this.archivedRegistry();
    const temporary = path.join(folder, '.archived-worker-' + randomUUID());
    writeFileSync(temporary, JSON.stringify(items) + '\n', { flag: 'wx', mode: 0o600 });
    try {
      renameSync(temporary, this.archiveFile);
    } finally {
      if (existsSync(temporary)) rmSync(temporary, { force: true });
    }
  }

  /** Never trust an archival log subprocess without checking its source. */
  private fixedWorkerLogIdentity(name: string, target: string): boolean {
    try {
      const logDir = path.join(target, 'log');
      const logTarget = path.join(PREFIX, 'var', 'log', 'sv', name);
      for (const folder of [logDir, logTarget]) {
        const stat = lstatSync(folder);
        if (!stat.isDirectory() || stat.isSymbolicLink() ||
            stat.uid !== process.getuid?.() || (stat.mode & 0o077) !== 0)
          return false;
      }
      const script = path.join(logDir, 'run');
      const stat = lstatSync(script);
      if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 ||
          stat.uid !== process.getuid?.() || (stat.mode & 0o022) !== 0 ||
          (stat.mode & 0o111) === 0 || stat.size > 20000)
        return false;
      return readFileSync(script, 'utf8') === builtinWorkerLogScript(name);
    } catch {
      return false;
    }
  }

  private offlineWorkerIdentity(record: ArchivedWorker): boolean {
    try {
      const name = record.name;
      const target = path.join(PREFIX, 'var', 'sv', name);
      if (target !== record.target || this.registry().some((item) => item.name === name))
        return false;
      const published = path.join(this.serviceRoot, name);
      try {
        lstatSync(published);
        return false;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') return false;
      }
      const root = lstatSync(this.serviceRoot);
      const dir = lstatSync(target);
      if (!root.isDirectory() || root.isSymbolicLink() ||
          !dir.isDirectory() || dir.isSymbolicLink() ||
          dir.uid !== process.getuid?.() || (dir.mode & 0o077) !== 0 ||
          realpathSync(target) !== target ||
          this.runSha256(target) !== record.runSha256 ||
          createHash('sha256')
            .update(builtinWorkerRunScript(record.template, target))
            .digest('hex') !== record.runSha256 ||
          !this.fixedWorkerLogIdentity(name, target) ||
          (record.template === 'python-source-v1' &&
            (!record.sourceSha256 ||
             pythonWorkerSourceHash(target) !== record.sourceSha256)))
        return false;
      const down = lstatSync(path.join(target, 'down'));
      if (!down.isFile() || down.isSymbolicLink() ||
          down.uid !== process.getuid?.() || (down.mode & 0o077) !== 0)
        return false;
      const markerFile = path.join(target, '.pockethost-service.json');
      const markerStat = lstatSync(markerFile);
      if (!markerStat.isFile() || markerStat.isSymbolicLink() ||
          markerStat.nlink !== 1 || markerStat.uid !== process.getuid?.() ||
          (markerStat.mode & 0o077) !== 0)
        return false;
      const markerRaw = safeFile(markerFile);
      if (!markerRaw) return false;
      const marker: unknown = JSON.parse(markerRaw);
      if (!marker || typeof marker !== 'object' || Array.isArray(marker)) return false;
      const m = marker as Record<string, unknown>;
      return ['instanceId,name,owner,runSha256,schema,template',
          'instanceId,name,owner,runSha256,schema,sourceSha256,template'].includes(
            Object.keys(m).sort().join(',')) &&
        (record.template === 'python-source-v1'
          ? m.sourceSha256 === record.sourceSha256
          : m.sourceSha256 === undefined) &&
        m.schema === 1 && m.owner === 'pockethost' &&
        m.name === name && m.template === record.template &&
        m.instanceId === record.instanceId && m.runSha256 === record.runSha256;
    } catch {
      return false;
    }
  }

  archivedWorkers(): ArchivedWorkerSummary[] {
    const registrations = this.registry();
    return this.archivedRegistry().map((item) => {
      // A crash after journaling an archive but before unlink, or after
      // re-enrolling a restored unit but before clearing the archive, is
      // a conflict. Never pretend it is an ordinary recoverable archive.
      let published = true;
      try {
        lstatSync(path.join(this.serviceRoot, item.name));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') published = false;
      }
      const conflict = published ||
        registrations.some((entry) => entry.name === item.name);
      return {
        name: item.name,
        template: item.template,
        identity: conflict ? 'conflict' as const
          : this.offlineWorkerIdentity(item) ? 'restorable' as const
          : 'changed' as const,
      };
    });
  }


  /**
   * Irreversible from the LAN surface: revoke an exact archived worker by
   * moving its unchanged definition and logs into owner-private quarantine.
   * Never recursively delete service files or adopt a live/foreign unit.
   * A partial rename remains blocked for explicit manual reconciliation.
   */
  retireArchivedWorker(
    name: string,
    template: WorkerTemplate,
  ): { changed: true; retired: true; restorable: false; filesRetained: true } {
    valid(name);
    if (isReserved(name)) throw new Error('Protected service');
    if (!['heartbeat-worker-v1', 'python-heartbeat-v1', 'python-source-v1'].includes(template))
      throw new RangeError('Invalid archived worker template');
    const release = this.acquireStandaloneLifecycleLock();
    try {
      const archived = this.archivedRegistry();
      const record = archived.find((item) => item.name === name);
      if (!record || record.template !== template || !this.offlineWorkerIdentity(record))
        throw new Error('Only the exact attested archived worker can be retired');
      if (this.registry().some((entry) => entry.name === name))
        throw new Error('Active service registration prevents retirement');

      const sourceRoot = path.join(PREFIX, 'var', 'sv');
      const logRoot = path.join(PREFIX, 'var', 'log', 'sv');
      const source = path.join(sourceRoot, name);
      const logs = path.join(logRoot, name);
      if (source !== record.target) throw new Error('Archived worker source changed');
      const owner = process.getuid?.();
      const trustedDirectory = (folder: string, privateOnly: boolean): void => {
        const st = lstatSync(folder);
        if (!st.isDirectory() || st.isSymbolicLink() ||
            st.uid !== owner || (st.mode & (privateOnly ? 0o077 : 0o022)) !== 0 ||
            realpathSync(folder) !== folder)
          throw new Error('Untrusted retirement directory');
      };
      for (const folder of [this.serviceRoot, sourceRoot, logRoot])
        trustedDirectory(folder, false);
      for (const folder of [source, logs])
        trustedDirectory(folder, true);
      if (!this.offlineWorkerIdentity(record))
        throw new Error('Archived worker identity changed before retirement');

      const privateParent = path.dirname(this.retiredRoot);
      trustedDirectory(privateParent, true);
      try {
        mkdirSync(this.retiredRoot, { mode: 0o700 });
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      }
      trustedDirectory(this.retiredRoot, true);
      const entries = readdirSync(this.retiredRoot);
      if (entries.length >= MAX_TEMPLATE_WORKERS ||
          entries.some((entry) => !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(entry)))
        throw new Error('Retired worker quarantine full or untrusted');
      const tombstone = path.join(this.retiredRoot, record.instanceId);
      const sourceProof = lstatSync(source);
      const logProof = lstatSync(logs);
      // A fixed instance-specific tombstone prevents accidental overwrites.
      // No recursive copy, tree deletion or implicit rollback on ambiguity.
      mkdirSync(tombstone, { mode: 0o700 });
      writeFileSync(path.join(tombstone, 'retirement.json'), JSON.stringify({
        schema: 1, name, template, instanceId: record.instanceId,
        runSha256: record.runSha256, ...(record.sourceSha256
          ? { sourceSha256: record.sourceSha256 } : {}),
        archivedAt: record.archivedAt,
        retiredAt: new Date().toISOString(),
      }) + '\n', { flag: 'wx', mode: 0o600 });
      if (!this.offlineWorkerIdentity(record))
        throw new Error('Archived worker identity changed before quarantine move');
      const retiredSource = path.join(tombstone, 'unit');
      const retiredLogs = path.join(tombstone, 'logs');
      renameSync(source, retiredSource);
      const movedUnit = lstatSync(retiredSource);
      if (movedUnit.dev !== sourceProof.dev || movedUnit.ino !== sourceProof.ino)
        throw new Error('Retired worker unit identity changed during move');
      renameSync(logs, retiredLogs);
      const movedLogs = lstatSync(retiredLogs);
      if (movedLogs.dev !== logProof.dev || movedLogs.ino !== logProof.ino)
        throw new Error('Retired worker log identity changed during move');
      for (const oldPath of [source, logs]) {
        try {
          lstatSync(oldPath);
          throw new Error('Archived worker path republished during retirement');
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
        }
      }
      if (this.registry().some((entry) => entry.name === name))
        throw new Error('Archived worker was unexpectedly registered during retirement');
      // Ledger removal is LAST. If any rename or journal write fails,
      // the old entry remains un-restorable and requires manual review.
      this.saveArchived(archived.filter((entry) => entry.name !== name));
      return { changed: true, retired: true, restorable: false, filesRetained: true };
    } finally {
      release();
    }
  }

  /**
   * Restore only a previously archived, exact, private worker definition.
   * The down marker remains in place: restoring grants ownership but does
   * not start the process or enable Android/runit autostart.
   */
  restoreArchivedWorker(
    name: string,
    template: WorkerTemplate,
  ): { changed: boolean; restored: boolean; started: false } {
    valid(name);
    if (isReserved(name)) throw new Error('Protected service');
    if (!['heartbeat-worker-v1', 'python-heartbeat-v1', 'python-source-v1'].includes(template))
      throw new RangeError('Invalid archived worker template');
    const release = this.acquireStandaloneLifecycleLock();
    try {
      const archived = this.archivedRegistry();
      const record = archived.find((item) => item.name === name);
      if (!record || record.template !== template || !this.offlineWorkerIdentity(record))
        throw new Error('Archived worker identity could not be attested');
      if (this.registry().length >= MAX_MANAGED)
        throw new RangeError('Managed service quota reached');
      // Validate all state before publication. Never adopt an existing entry.
      const published = path.join(this.serviceRoot, name);
      symlinkSync(record.target, published);
      // If registration unexpectedly fails, leave an inert down-marked unit
      // for explicit investigation; no implicit retry or unsafe foreign unlink.
      this.registerProvisioned(name, {
        target: record.target, runSha256: record.runSha256,
      });
      this.saveArchived(archived.filter((item) => item.name !== name));
      return { changed: true, restored: true, started: false };
    } finally {
      release();
    }

  }


  /**
   * Read-only recovery allowance. Uses the shared Hosting policy evaluator,
   * but never offers automated healing or readiness claims. Restrict to
   * a fully attested builtin unit: project recovery belongs to NodeRunitHost.
   */
  reviewWorkerRecovery(name: string): RunitRecoveryReview {
    valid(name);
    if (isReserved(name)) throw new Error('Protected service');
    const registrations = this.registry();
    const target = this.target(name);
    const template = this.managedWorkerTemplate(name, target, registrations);
    if (!template || template === 'python-source-v1')
      throw new Error('Recovery only available for fixed builtin heartbeat worker');
    const raw = safeFile(path.join(target, '.pockethost-service.json'));
    if (!raw) throw new Error('Worker identity marker missing');
    const marker: unknown = JSON.parse(raw);
    if (!marker || typeof marker !== 'object' || Array.isArray(marker))
      throw new Error('Untrusted worker identity marker');
    const instanceId = (marker as Record<string, unknown>).instanceId;
    if (typeof instanceId !== 'string' ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(instanceId))
      throw new Error('Invalid worker instance identity');
    const nowMs = Date.now();
    const records = this.recoveryJournal();
    const item = records.find((entry) => entry.name === name);
    // Instance mismatch is not a route for bypassing retry limits.
    if (item && item.instanceId !== instanceId)
      throw new Error('Recovery history belongs to a different worker instance');
    if (item && item.attemptedAtMs.some((at) => at > nowMs))
      throw new Error('Recovery clock moved backwards; manual inspection required');
    const recent = item
      ? item.attemptedAtMs.filter((at) => nowMs - at < RECOVERY_WINDOW_MS)
      : [];
    const attempts = recent.length;
    const lastAttemptAtMs = recent.length ? recent[recent.length - 1] : null;
    const observed = this.probe(name);
    const autostart = this.enabled(name, true);
    const decision = evaluateHealthPolicy({
      readinessTimeoutMs: 5000,
      cooldownMs: RECOVERY_COOLDOWN_MS,
      maxAttempts: RECOVERY_MAX_ATTEMPTS,
    }, {
      desired: autostart === true ? 'running' : 'stopped',
      observed, ready: null, requestedAtMs: null,
      lastAttemptAtMs, attempts, nowMs, owned: true,
      manuallyDisabled: autostart !== true,
    });
    if (this.target(name) !== target ||
        this.managedWorkerTemplate(name, target, this.registry()) !== template)
      throw new Error('Worker changed during recovery assessment');
    return {
      name, template, observed, readiness: 'not-verified',
      action: decision.action === 'start' ? 'start' :
        decision.action === 'blocked' ? 'blocked' : 'none',
      reason: decision.reason, attempts,
      maxAttempts: RECOVERY_MAX_ATTEMPTS,
      nextEligibleAt: decision.nextEligibleAtMs === null
        ? null : new Date(decision.nextEligibleAtMs).toISOString(),
      windowEndsAt: recent.length ? new Date(recent[0] + RECOVERY_WINDOW_MS).toISOString() : null,
      checkedAt: new Date(nowMs).toISOString(),
    };
  }

  /** Explicit, once-only recovery attempt. No timer or background worker. */
  async recoverWorkerOnce(name: string, run: Exec = executeFixed):
    Promise<{ requested: true; result: HostCommandResult; review: RunitRecoveryReview }> {
    // A per-process promise queue does not serialize another panel instance
    // or an independently invoked trusted host adapter. The fixed private
    // O_EXCL lock holds across policy review, journal write and runit command.
    // A crash leaves a lock and intentionally requires explicit inspection.
    const folder = path.dirname(this.recoveryFile);
    mkdirSync(folder, { recursive: true, mode: 0o700 });
    const folderStat = lstatSync(folder);
    if (!folderStat.isDirectory() || folderStat.isSymbolicLink() ||
        folderStat.uid !== process.getuid?.() || (folderStat.mode & 0o077) !== 0 ||
        realpathSync(folder) !== folder)
      throw new Error('Unsafe recovery lock directory');
    const lockPath = path.join(folder, '.h3-worker-recovery.lock');
    let lockFd: number;
    try {
      lockFd = openSync(lockPath, 'wx', 0o600);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'EEXIST')
        throw new Error('Another recovery attempt is in progress or needs manual reconciliation');
      throw error;
    }
    try {
      const review = this.reviewWorkerRecovery(name);
      if (review.action !== 'start' || review.observed !== 'stopped')
        throw new Error('Recovery blocked by owner identity, manual stop, budget or cooldown');
      const nowMs = Date.now();
      const records = this.recoveryJournal();
      const old = records.find((item) => item.name === name);
      const markerRaw = safeFile(path.join(PREFIX, 'var', 'sv', name, '.pockethost-service.json'));
      if (!markerRaw) throw new Error('Worker recovery marker missing');
      const marker: unknown = JSON.parse(markerRaw);
      if (!marker || typeof marker !== 'object' || Array.isArray(marker))
        throw new Error('Recovery marker invalid');
      const instanceId = (marker as Record<string, unknown>).instanceId;
      if (typeof instanceId !== 'string')
        throw new Error('Recovery instance invalid');
      // Reassess immediately and consume the budget *before* sending sv up,
      // ensuring a crash or a failed command never triggers an unbounded retry.
      const fresh = this.reviewWorkerRecovery(name);
      if (fresh.action !== 'start' || fresh.observed !== 'stopped')
        throw new Error('Recovery state changed before attempt');
      if (old && old.instanceId !== instanceId)
        throw new Error('Recovery journal instance changed');
      if (old && old.attemptedAtMs.some((at) => at > nowMs))
        throw new Error('Recovery clock moved backwards');
      const recent = old
        ? old.attemptedAtMs.filter((at) => nowMs - at < RECOVERY_WINDOW_MS)
        : [];
      if (recent.length >= RECOVERY_MAX_ATTEMPTS ||
          (recent.length > 0 && nowMs < recent[recent.length - 1] + RECOVERY_COOLDOWN_MS))
        throw new Error('Recovery attempt budget or cooldown changed');
      const next: RecoveryAttemptRecord = {
        name, instanceId, attemptedAtMs: [...recent, nowMs],
      };
      this.saveRecoveryJournal([...records.filter((item) => item.name !== name), next]);
      const result = await run(path.join(PREFIX, 'bin', 'sv'),
        ['up', path.join(this.serviceRoot, name)],
        { timeout: 20000, maxBuffer: 12000 });
      if (result.exit !== 0)
        throw new Error('Runit rejected the recovery start; attempt budget was consumed');
      return { requested: true, result, review: this.reviewWorkerRecovery(name) };
    } finally {
      // Never unlink a replacement lock created by an independent process.
      // On any ambiguous identity, leave it for manual recovery inspection.
      try {
        const lockProof = fstatSync(lockFd);
        const current = lstatSync(lockPath);
        if (!current.isFile() || current.isSymbolicLink() ||
            current.dev !== lockProof.dev || current.ino !== lockProof.ino ||
            current.nlink !== 1 || current.uid !== process.getuid?.()) {
          throw new Error('Recovery lock identity changed; refusing cleanup');
        }
        unlinkSync(lockPath);
      } finally {
        closeSync(lockFd);
      }
    }
  }

  private recoveryJournal(): RecoveryAttemptRecord[] {
    let raw: string | null;
    try {
      const st = lstatSync(this.recoveryFile);
      if (!st.isFile() || st.isSymbolicLink() || st.nlink !== 1 ||
          st.uid !== process.getuid?.() || (st.mode & 0o077) !== 0)
        throw new Error('Unsafe recovery journal');
      raw = safeFile(this.recoveryFile);
      if (raw === null) throw new Error('Recovery journal disappeared');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw error;
    }
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value) || value.length > MAX_TEMPLATE_WORKERS)
      throw new Error('Untrusted recovery journal');
    const names = new Set<string>();
    return value.map((candidate: unknown) => {
      if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate))
        throw new Error('Invalid recovery entry');
      const v = candidate as Record<string, unknown>;
      if (Object.keys(v).sort().join(',') !==
          'attemptedAtMs,instanceId,name' ||
          typeof v.name !== 'string' || typeof v.instanceId !== 'string' ||
          !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(v.instanceId) ||
          !Array.isArray(v.attemptedAtMs) || v.attemptedAtMs.length < 1 ||
          v.attemptedAtMs.length > RECOVERY_MAX_ATTEMPTS ||
          !v.attemptedAtMs.every((at: unknown, i: number) =>
            typeof at === 'number' && Number.isSafeInteger(at) && at >= 0 &&
            (i === 0 || at > v.attemptedAtMs[i - 1])) ||
          names.has(v.name))
        throw new Error('Untrusted recovery journal entry');
      valid(v.name);
      if (isReserved(v.name)) throw new Error('Protected recovery history');
      names.add(v.name);
      return v as unknown as RecoveryAttemptRecord;
    });
  }

  private saveRecoveryJournal(records: RecoveryAttemptRecord[]): void {
    if (records.length > MAX_TEMPLATE_WORKERS) throw new RangeError('Recovery history full');
    const folder = path.dirname(this.recoveryFile);
    mkdirSync(folder, { recursive: true, mode: 0o700 });
    const parent = lstatSync(folder);
    if (!parent.isDirectory() || parent.isSymbolicLink() ||
        parent.uid !== process.getuid?.() || (parent.mode & 0o077) !== 0)
      throw new Error('Unsafe recovery state folder');
    this.recoveryJournal();
    const temp = path.join(folder, '.recovery-' + randomUUID());
    writeFileSync(temp, JSON.stringify(records) + '\n', { flag: 'wx', mode: 0o600 });
    try {
      renameSync(temp, this.recoveryFile);
    } finally {
      if (existsSync(temp)) rmSync(temp, { force: true });
    }
  }

  private target(name: string): string {
    valid(name);
    const candidate = path.join(this.serviceRoot, name);
    if (!existsSync(candidate)) throw new Error('Runit service unavailable');
    const resolved = realpathSync(candidate);
    if (isReserved(name, resolved)) throw new Error('Protected service');
    const canonicalServiceRoot = realpathSync(this.serviceRoot);
    const allowedRoots = [
      canonicalServiceRoot + path.sep,
      path.join(PREFIX, 'var', 'sv') + path.sep,
    ];
    if (
      !allowedRoots.some((root) => resolved.startsWith(root)) ||
      !statSync(resolved).isDirectory()
    )
      throw new Error('Service points outside accepted runit root');
    return resolved;
  }

  /**
   * Cross-process lease for creation, archiving, restoring and LAN lifecycle
   * of owned standalone workers. Hold it across the complete filesystem and
   * runit transaction: a per-process UI queue cannot protect two adapters.
   * An abandoned lock stays in place for independent manual reconciliation.
   */
  private acquireStandaloneLifecycleLock(): () => void {
    const folder = path.dirname(this.registerFile);
    mkdirSync(folder, { recursive: true, mode: 0o700 });
    const parent = lstatSync(folder);
    if (!parent.isDirectory() || parent.isSymbolicLink() ||
        parent.uid !== process.getuid?.() || (parent.mode & 0o077) !== 0 ||
        realpathSync(folder) !== folder)
      throw new Error('Unsafe standalone worker lock directory');
    const lockPath = path.join(folder, '.h3-standalone-lifecycle.lock');
    let fd: number;
    try {
      fd = openSync(lockPath, 'wx', 0o600);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'EEXIST')
        throw new Error('Another standalone worker operation is in progress or needs reconciliation');
      throw error;
    }
    return () => {
      try {
        const held = fstatSync(fd);
        const current = lstatSync(lockPath);
        if (!current.isFile() || current.isSymbolicLink() ||
            current.dev !== held.dev || current.ino !== held.ino ||
            current.nlink !== 1 || current.uid !== process.getuid?.() ||
            (current.mode & 0o077) !== 0)
          throw new Error('Standalone worker lock changed; refusing cleanup');
        unlinkSync(lockPath);
      } finally {
        closeSync(fd);
      }
    };
  }

  /**
   * First standalone service template: an owned, stopped heartbeat worker.
   * This does NOT accept user code, shell, source path, PID, service target,
   * existing service adoption, or a network port. A name is only a label.
   *
   * Construct under /var/sv (not watched by runsvdir), then publish exactly
   * one symlink in /var/service and bind the expected script hash through
   * the trusted in-process registry. No additional process supervisor.
   */
  createManagedWorker(
    name: string,
    template: WorkerTemplate = 'heartbeat-worker-v1',
    source?: string,
  ): { changed: boolean; name: string; template: WorkerTemplate } {
    valid(name);
    if (!['heartbeat-worker-v1', 'python-heartbeat-v1', 'python-source-v1'].includes(template))
      throw new RangeError('Unsupported owned service template');
    if (template === 'python-source-v1') {
      // Source is staged, not executed. Browser Start/Restart/Enable are denied.
      if (typeof source !== 'string' || !source.trim() ||
          source.includes(String.fromCharCode(0)) || Buffer.byteLength(source) > 32 * 1024)
        throw new RangeError('Invalid Python source or 32 KB limit exceeded');
    } else if (source !== undefined) {
      throw new RangeError('Custom source refused by fixed templates');
    }
    if (isReserved(name)) throw new Error('Protected service');
    const release = this.acquireStandaloneLifecycleLock();
    try {
      if (this.registry().length >= MAX_MANAGED) throw new RangeError('Managed service quota reached');
      const sourceRoot = path.join(PREFIX, 'var', 'sv');
      const logRoot = path.join(PREFIX, 'var', 'log', 'sv');
      for (const folder of [this.serviceRoot, sourceRoot, logRoot]) {
        const st = lstatSync(folder);
        if (!st.isDirectory() || st.isSymbolicLink() ||
            st.uid !== process.getuid?.() || (st.mode & 0o022) !== 0 ||
            realpathSync(folder) !== folder) {
          throw new Error('Untrusted Termux service directory');
        }
      }
      // Both templates share a quota, including already archived definitions,
      // so LAN clients cannot repeatedly archive and allocate more services.
      const templateCount = readdirSync(sourceRoot).filter((unit) => {
        if (!SERVICE_NAME.test(unit)) return false;
        const marker = path.join(sourceRoot, unit, '.pockethost-service.json');
        try {
          const raw = safeFile(marker);
          if (!raw) return false;
          const data: unknown = JSON.parse(raw);
          return !!data && typeof data === 'object' &&
            (data as { template?: string }).template !== undefined &&
            ['heartbeat-worker-v1', 'python-heartbeat-v1', 'python-source-v1'].includes(
              (data as { template: string }).template,
            );
        } catch {
          throw new Error('Managed worker inventory unverified');
        }
      }).length;
      if (templateCount >= MAX_TEMPLATE_WORKERS) throw new RangeError('Managed worker quota reached');
      const published = path.join(this.serviceRoot, name);
      const target = path.join(sourceRoot, name);
      const logTarget = path.join(logRoot, name);
      // No adoption, overwrite, repair, remote repo or caller-supplied code.
      for (const location of [published, target, logTarget]) {
        try {
          lstatSync(location);
          throw new Error('Service name or log directory already exists');
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
        }
      }
      const sh = path.join(PREFIX, 'bin', 'sh');
      const env = path.join(PREFIX, 'bin', 'env');
      const node = path.join(PREFIX, 'bin', 'node');
      const python = path.join(PREFIX, 'bin', 'python');
      const svlogd = path.join(PREFIX, 'bin', 'svlogd');
      const runtime = template !== 'heartbeat-worker-v1' ? python : node;
      for (const binary of [sh, env, runtime, svlogd]) {
        const st = statSync(binary);
        if (!st.isFile() || (st.mode & 0o111) === 0)
          throw new Error('Termux runtime unavailable');
      }
      const runScript = builtinWorkerRunScript(template, target);
      const logScript = builtinWorkerLogScript(name);
      const digest = createHash('sha256').update(runScript).digest('hex');
      mkdirSync(target, { mode: 0o700 });
      // Runit sees a stopped service immediately, never an incomplete
      // executable definition or implicitly enabled autostart policy.
      writeFileSync(path.join(target, 'down'), '', { flag: 'wx', mode: 0o600 });
      mkdirSync(path.join(target, 'log'), { mode: 0o700 });
      mkdirSync(logTarget, { mode: 0o700 });
      writeFileSync(path.join(target, 'log', 'run'), logScript, { flag: 'wx', mode: 0o700 });
      writeFileSync(path.join(target, 'run'), runScript, { flag: 'wx', mode: 0o700 });
      const sourceSha256 = template === 'python-source-v1' && source !== undefined
        ? createHash('sha256').update(source).digest('hex') : null;
      if (sourceSha256) {
        writeFileSync(path.join(target, 'worker.py'), source!, { flag: 'wx', mode: 0o600 });
        if (pythonWorkerSourceHash(target) !== sourceSha256)
          throw new Error('Python source readback does not match staged bytes');
      }
      writeFileSync(path.join(target, '.pockethost-service.json'), JSON.stringify({
        schema: 1, owner: 'pockethost', name, template,
        runSha256: digest, ...(sourceSha256 ? { sourceSha256 } : {}),
        instanceId: randomUUID(),
      }) + '\n', { flag: 'wx', mode: 0o600 });
      symlinkSync(target, published);
      this.registerProvisioned(name, { target, runSha256: digest });
      return { changed: true, name, template };
    } finally {
      release();
    }

  }

  /**
   * A service can be archived only if it was created by the built-in
   * standalone provisioner. An enrolled Node project, name prefix, or
   * readable foreign marker never grants archive authority.
   */
  private managedWorkerTemplate(
    name: string,
    target: string,
    registrations: Registration[],
  ): WorkerTemplate | null {
    if (this.identity(name, target, registrations) !== 'verified') return null;
    const sourceRoot = path.join(PREFIX, 'var', 'sv');
    if (target !== path.join(sourceRoot, name)) return null;
    try {
      const published = lstatSync(path.join(this.serviceRoot, name));
      const directory = lstatSync(target);
      if (!published.isSymbolicLink() ||
          readlinkSync(path.join(this.serviceRoot, name)) !== target ||
          !directory.isDirectory() || directory.isSymbolicLink() ||
          directory.uid !== process.getuid?.() || (directory.mode & 0o022) !== 0) {
        return null;
      }
      const markerFile = path.join(target, '.pockethost-service.json');
      const markerStat = lstatSync(markerFile);
      if (!markerStat.isFile() || markerStat.isSymbolicLink() ||
          markerStat.nlink !== 1 || markerStat.uid !== process.getuid?.() ||
          (markerStat.mode & 0o077) !== 0) return null;
      const raw = safeFile(markerFile);
      if (!raw) return null;
      const marker: unknown = JSON.parse(raw);
      if (!marker || typeof marker !== 'object' || Array.isArray(marker)) return null;
      const proof = marker as Record<string, unknown>;
      const record = registrations.find((entry) => entry.name === name);
      const validProof = ['instanceId,name,owner,runSha256,schema,template',
          'instanceId,name,owner,runSha256,schema,sourceSha256,template'].includes(
            Object.keys(proof).sort().join(',')) &&
        proof.schema === 1 && proof.owner === 'pockethost' &&
        proof.name === name &&
        ['heartbeat-worker-v1', 'python-heartbeat-v1', 'python-source-v1'].includes(
          proof.template as string) &&
        (proof.template === 'python-source-v1'
          ? typeof proof.sourceSha256 === 'string' &&
            /^[a-f0-9]{64}$/.test(proof.sourceSha256) &&
            pythonWorkerSourceHash(target) === proof.sourceSha256
          : proof.sourceSha256 === undefined) &&
        typeof proof.instanceId === 'string' &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(proof.instanceId) &&
        proof.runSha256 === record?.runSha256 &&
        this.runSha256(target) === proof.runSha256;
      const expectedDigest = (proof.template === 'heartbeat-worker-v1' ||
        proof.template === 'python-heartbeat-v1' || proof.template === 'python-source-v1')
        ? createHash('sha256')
            .update(builtinWorkerRunScript(proof.template, target)).digest('hex')
        : null;
      return validProof && proof.runSha256 === expectedDigest &&
        this.fixedWorkerLogIdentity(name, target)
        ? (proof.template as WorkerTemplate) : null;
    } catch {
      return null;
    }
  }

  /**
   * Non-destructive retirement: exit the owned runsv supervisor, unpublish
   * the exact original symlink and revoke registry authority. The worker's
   * scripts and logs remain in the private Termux roots for explicit later
   * cleanup; we do not recursively delete any service tree.
   */
  async archiveManagedWorker(
    name: string,
    run: Exec = executeFixed,
  ): Promise<{ changed: boolean; archived: boolean; retainedFiles: boolean }> {
    valid(name);
    if (isReserved(name)) throw new Error('Protected service');
    const release = this.acquireStandaloneLifecycleLock();
    try {
      const registrations = this.registry();
      const target = this.target(name);
      if (!this.managedWorkerTemplate(name, target, registrations)) {
        throw new Error('Only an attested PocketHost template worker can be archived');
      }
      if (this.probe(name) !== 'stopped' || this.enabled(name, true) !== false) {
        throw new Error('Archive requires a stopped worker with autostart disabled');
      }
      const published = path.join(this.serviceRoot, name);
      const result = await run(path.join(PREFIX, 'bin', 'sv'), ['exit', published], {
        timeout: 20000, maxBuffer: 12000,
      });
      if (result.exit !== 0) throw new Error('Runit supervisor refused exit');
      if (this.probe(name) === 'running' ||
          this.enabled(name, true) !== false ||
          !this.managedWorkerTemplate(name, target, this.registry())) {
        throw new Error('Worker identity or stopped state changed during retirement');
      }
      // Remove only the exact symlink, never the directory it points to.
      if (!lstatSync(published).isSymbolicLink() || readlinkSync(published) !== target) {
        throw new Error('Published worker symlink identity changed');
      }
      const rawMarker = safeFile(path.join(target, '.pockethost-service.json'));
      if (!rawMarker) throw new Error('Worker archive marker missing');
      const marker: unknown = JSON.parse(rawMarker);
      if (!marker || typeof marker !== 'object' || Array.isArray(marker))
        throw new Error('Invalid worker archive marker');
      const proof = marker as Record<string, unknown>;
      const archived = this.archivedRegistry();
      if (archived.some((item) => item.name === name) ||
          archived.length >= MAX_TEMPLATE_WORKERS ||
          !this.managedWorkerTemplate(name, target, this.registry()) ||
          typeof proof.instanceId !== 'string' ||
          typeof proof.runSha256 !== 'string' ||
          !['heartbeat-worker-v1', 'python-heartbeat-v1', 'python-source-v1'].includes(
            proof.template as string)) {
        throw new Error('Worker archiving identity or quota changed');
      }
      // Stage the immutable recovery record before unlinking the unit.
      this.saveArchived([...archived, {
        name, target, template: proof.template,
        instanceId: proof.instanceId, runSha256: proof.runSha256,
        ...(proof.template === 'python-source-v1' &&
            typeof proof.sourceSha256 === 'string'
          ? { sourceSha256: proof.sourceSha256 } : {}),
        archivedAt: new Date().toISOString(),
      }]);
      unlinkSync(published);
      this.save(registrations.filter((entry) => entry.name !== name));
      return { changed: true, archived: true, retainedFiles: true };
    } finally {
      release();
    }

  }

  /** No digest or script validation means no lifecycle authority. */
  private runSha256(target: string): string | null {
    try {
      const file = path.join(target, 'run');
      const stat = lstatSync(file);
      if (
        !stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 ||
        stat.uid !== process.getuid?.() || (stat.mode & 0o022) !== 0 ||
        (stat.mode & 0o111) === 0 || stat.size > 20000
      ) return null;
      return createHash('sha256').update(readFileSync(file)).digest('hex');
    } catch {
      return null;
    }
  }

  private identity(
    name: string,
    target: string | undefined,
    registrations: Registration[],
  ): ServiceIdentity {
    if (isReserved(name, target)) return 'reserved';
    // A pending archive and a live published unit must never both confer
    // management capabilities. Both sides remain read-only after a crash.
    // The ledger is private and independently validated; an unreadable
    // ledger fails closed rather than silently granting service control.
    if (this.archivedRegistry().some((item) => item.name === name))
      return 'archive-conflict';
    const entry = registrations.find((item) => item.name === name);
    if (!entry) return 'unregistered';
    if (!target || entry.target !== target) return 'changed';
    if (!entry.runSha256) return 'legacy';
    return this.runSha256(target) === entry.runSha256 ? 'verified' : 'changed';
  }

  /**
   * Only trusted PocketHost service creators may invoke this internal method.
   * It is deliberately not exposed by the H3 HTTP API: a browser cannot
   * establish process provenance by supplying a name or a path.
   *
   * The caller must create the unit itself and supply the exact canonical
   * directory and expected source hash, independently established at creation.
   * Runit remains responsible for process supervision after enrollment.
   */
  registerProvisioned(
    name: string,
    provenance: { target: string; runSha256: string },
  ): { changed: boolean } {
    valid(name);
    if (
      !provenance ||
      typeof provenance.target !== 'string' ||
      typeof provenance.runSha256 !== 'string' ||
      !/^[a-f0-9]{64}$/.test(provenance.runSha256)
    ) throw new RangeError('Invalid service provenance');
    const registrations = this.registry();
    if (registrations.some((entry) => entry.name === name))
      throw new Error('Already registered');
    const target = this.target(name);
    if (target !== provenance.target)
      throw new Error('Service provenance target mismatch');
    const current = lstatSync(target);
    if (
      !current.isDirectory() || current.isSymbolicLink() ||
      current.uid !== process.getuid?.() || (current.mode & 0o022) !== 0
    ) throw new Error('Untrusted provisioned service directory');
    if (this.runSha256(target) !== provenance.runSha256)
      throw new Error('Provisioned run script identity mismatch');
    this.save([...registrations, {
      name, target, runSha256: provenance.runSha256,
      addedAt: new Date().toISOString(),
    }]);
    return { changed: true };
  }

  /**
   * Trusted creator-only update for an existing, already-enrolled runit unit.
   * The caller has just replaced the script while performing its own
   * lifecycle/rollback gate. Require both previous recorded digest and
   * new on-disk digest, so name reuse or foreign service drift cannot pass.
   * This method is never reachable through the admin HTTP actions.
   */
  refreshProvisioned(
    name: string,
    provenance: { target: string; previousRunSha256: string; runSha256: string },
  ): { changed: boolean } {
    valid(name);
    const registrations = this.registry();
    const existing = registrations.find((entry) => entry.name === name);
    if (!existing || !existing.runSha256 ||
        existing.runSha256 !== provenance.previousRunSha256) {
      throw new Error('Previous provisioned identity unverified');
    }
    const target = this.target(name);
    if (target !== provenance.target || target !== existing.target ||
        !/^[a-f0-9]{64}$/.test(provenance.runSha256) ||
        this.runSha256(target) !== provenance.runSha256) {
      throw new Error('Changed provisioned identity unverified');
    }
    this.save(registrations.map((entry) =>
      entry.name === name ? { ...entry, runSha256: provenance.runSha256 } : entry));
    return { changed: true };
  }

  private probe(name: string): TermuxService['state'] {
    try {
      const result = spawnSync(
        path.join(PREFIX, 'bin', 'sv'),
        ['status', path.join(this.serviceRoot, name)],
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

  list(
    probe: (name: string) => TermuxService['state'] = (name) => this.probe(name),
  ): TermuxService[] {
    const registrations = this.registry();
    let names: string[];
    try {
      const stat = lstatSync(this.serviceRoot);
      if (!stat.isDirectory() || stat.isSymbolicLink())
        throw new Error('Invalid service directory');
      names = readdirSync(this.serviceRoot)
        .filter((name) => SERVICE_NAME.test(name))
        .slice(0, MAX_ENTRIES);
    } catch {
      names = [];
    }
    return names.sort().map((name) => {
      let resolved: string | undefined;
      try {
        resolved = realpathSync(path.join(this.serviceRoot, name));
      } catch {
        /* Missing/dangling entry remains unknown and cannot be controlled. */
      }
      const identity = this.identity(name, resolved, registrations);
      const registered = identity === 'verified';
      const template = registered && resolved
        ? this.managedWorkerTemplate(name, resolved, registrations) : null;
      // Enrollment is not authority for every frontend. Node Hosting has
      // its own release/nonce/lock/port safety gates and must not be driven
      // by the generic Services runit buttons.
      const control: TermuxService['control'] = !registered ? 'read-only'
        : template ? 'standalone' : 'delegated';
      return {
        name,
        registered,
        protected: !registered,
        identity,
        control,
        ...(template ? { template } : {}),
        state: probe(name),
        enabled: this.enabled(name, registered),
      };
    });
  }

  private enabled(name: string, registered: boolean): boolean | null {
    try {
      // Protected services remain read-only, but a fixed real runit
      // directory can reveal the autostart marker without granting control.
      const root = lstatSync(this.serviceRoot);
      const target = path.join(this.serviceRoot, name);
      const entry = lstatSync(target);
      if (!root.isDirectory() || root.isSymbolicLink()) return null;
      // termux-services commonly publishes its units as symlinks from
      // var/service to var/sv. A verified registered unit may use this
      // canonical form, but an unregistered alias remains read-only.
      if (entry.isSymbolicLink()) {
        if (!registered) return null;
      } else if (!entry.isDirectory()) return null;
      // Re-attest the exact symlink target before reading its down marker.
      if (registered) this.target(name);
      const marker = path.join(this.serviceRoot, name, 'down');
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

  /** Exact named registration check: never scan or infer ownership from other services. */
  isRegistered(name: string): boolean {
    valid(name);
    const target = this.target(name);
    return this.identity(name, target, this.registry()) === 'verified';
  }

  /** Only this provisioner and its exact immutable script may configure a heartbeat. */
  private builtinHeartbeatIdentity(name: string): {
    template: WorkerTemplate;
    instanceId: string;
    target: string;
  } {
    valid(name);
    if (isReserved(name)) throw new Error('Protected service');
    const target = this.target(name);
    const template = this.managedWorkerTemplate(name, target, this.registry());
    if (!template || template === 'python-source-v1' ||
        !this.fixedWorkerLogIdentity(name, target))
      throw new Error('Only fixed builtin heartbeat workers can configure heartbeat');
    const markerRaw = safeFile(path.join(target, '.pockethost-service.json'));
    if (!markerRaw) throw new Error('Worker instance marker unavailable');
    const marker: unknown = JSON.parse(markerRaw);
    if (!marker || typeof marker !== 'object' || Array.isArray(marker))
      throw new Error('Untrusted worker marker');
    const instanceId = (marker as Record<string, unknown>).instanceId;
    if (typeof instanceId !== 'string' ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(instanceId))
      throw new Error('Untrusted worker instance');
    return { template, instanceId, target };
  }

  /**
   * Policy changes only: no process restart, no network probes and no shell.
   * Binding the policy to the instance blocks a replaced worker from using
   * the old heartbeat configuration.
   */
  configureWorkerHeartbeat(name: string, seconds: HeartbeatThresholdSeconds | null):
    { changed: boolean; heartbeat: HeartbeatReadback } {
    const worker = this.builtinHeartbeatIdentity(name);
    const changed = this.heartbeatPolicy.configure(name, worker.instanceId, seconds);
    const after = this.builtinHeartbeatIdentity(name);
    if (after.instanceId !== worker.instanceId ||
        after.target !== worker.target || after.template !== worker.template)
      throw new Error('Worker identity changed during heartbeat policy update');
    return {
      changed,
      heartbeat: this.heartbeatPolicy.observe(name, after.instanceId, after.template,
        this.probe(name), path.join(PREFIX, 'var', 'log', 'sv', name)),
    };
  }

  /**
   * Read-only activation preflight for owner-staged Python. No source text,
   * authorization token, execution command or process identifier is exposed.
   * In particular, a browser TTY is not on-device owner authentication.
   */
  inspectPythonSource(name: string): {
    name: string;
    template: 'python-source-v1';
    sourceSha256: string;
    sourceBytes: number;
    observed: 'running' | 'stopped' | 'unknown';
    autostart: boolean | null;
    canStartFromLan: false;
    ownerApproval: 'not-configured';
    checkedAt: string;
  } {
    valid(name);
    if (isReserved(name)) throw new Error('Protected service');
    const target = this.target(name);
    const registration = this.registry();
    if (this.managedWorkerTemplate(name, target, registration) !== 'python-source-v1')
      throw new Error('Only attested owner-staged Python source can be reviewed');
    const sourcePath = path.join(target, 'worker.py');
    const initial = lstatSync(sourcePath);
    if (!initial.isFile() || initial.isSymbolicLink() ||
        initial.nlink !== 1 || initial.uid !== process.getuid?.() ||
        (initial.mode & 0o077) !== 0 ||
        initial.size === 0 || initial.size > 32 * 1024)
      throw new Error('Python source file not owner-private');
    const fd = openSync(sourcePath, constants.O_RDONLY | constants.O_NOFOLLOW);
    let bytes: Buffer;
    try {
      const before = fstatSync(fd);
      if (!before.isFile() || before.nlink !== 1 ||
          before.dev !== initial.dev || before.ino !== initial.ino ||
          before.uid !== initial.uid || (before.mode & 0o077) !== 0 ||
          before.size !== initial.size || before.mtimeMs !== initial.mtimeMs)
        throw new Error('Python source changed while opening');
      bytes = readFileSync(fd);
      const after = fstatSync(fd);
      const current = lstatSync(sourcePath);
      if (bytes.length !== before.size ||
          after.dev !== before.dev || after.ino !== before.ino ||
          after.size !== before.size || after.mtimeMs !== before.mtimeMs ||
          current.dev !== before.dev || current.ino !== before.ino ||
          current.size !== before.size || current.mtimeMs !== before.mtimeMs ||
          current.nlink !== 1 || current.uid !== before.uid ||
          (current.mode & 0o077) !== 0)
        throw new Error('Python source changed while reading');
    } finally {
      closeSync(fd);
    }
    const markerRaw = safeFile(path.join(target, '.pockethost-service.json'));
    if (!markerRaw) throw new Error('Python worker identity unavailable');
    const marker: unknown = JSON.parse(markerRaw);
    if (!marker || typeof marker !== 'object' || Array.isArray(marker))
      throw new Error('Python worker identity invalid');
    const expected = (marker as Record<string, unknown>).sourceSha256;
    const sourceSha256 = createHash('sha256').update(bytes).digest('hex');
    if (typeof expected !== 'string' || !/^[a-f0-9]{64}$/.test(expected) ||
        expected !== sourceSha256)
      throw new Error('Python source fingerprint changed');
    const observed = this.probe(name);
    const autostart = this.enabled(name, true);
    if (this.target(name) !== target ||
        this.managedWorkerTemplate(name, target, this.registry()) !== 'python-source-v1')
      throw new Error('Python worker identity changed during review');
    return {
      name, template: 'python-source-v1', sourceSha256,
      sourceBytes: bytes.length, observed, autostart,
      canStartFromLan: false, ownerApproval: 'not-configured',
      checkedAt: new Date().toISOString(),
    };
  }

  /**
   * Manual, read-only runit health observation for attested services.
   * Unlike Node hosting readiness, this does not claim application health
   * from runit PID or from logs. Never checks or acts on a foreign service.
   * The log mtime is only evidence of output, not a readiness signal.
   */
  inspectHealth(name: string): RunitHealthReadback {
    valid(name);
    if (isReserved(name)) throw new Error('Protected service');
    const registrations = this.registry();
    const current = this.target(name);
    if (this.identity(name, current, registrations) !== 'verified')
      throw new Error('Service identity unverified; health inspection refused');
    const observed = this.probe(name);
    const autostart = this.enabled(name, true);
    const template = this.managedWorkerTemplate(name, current, registrations);
    const heartbeat: HeartbeatReadback = template && template !== 'python-source-v1'
      ? (() => {
          const worker = this.builtinHeartbeatIdentity(name);
          return this.heartbeatPolicy.observe(name, worker.instanceId, worker.template,
            observed, path.join(PREFIX, 'var', 'log', 'sv', name));
        })()
      : { mode: 'disabled', staleAfterSeconds: null,
          status: 'disabled', lastOutputAt: null };
    let logEvidence: RunitHealthReadback['logEvidence'] = 'no-log';
    let lastLogWriteAt: string | null = null;
    const logRoot = path.join(PREFIX, 'var', 'log', 'sv', name);
    try {
      const folder = lstatSync(logRoot);
      if (!folder.isDirectory() || folder.isSymbolicLink() ||
          folder.uid !== process.getuid?.() || (folder.mode & 0o022) !== 0) {
        logEvidence = 'untrusted';
      } else {
        const logFile = path.join(logRoot, 'current');
        try {
          const stat = lstatSync(logFile);
          if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 ||
              stat.uid !== process.getuid?.() || (stat.mode & 0o022) !== 0 ||
              stat.size > 4 * 1024 * 1024 ||
              !Number.isFinite(stat.mtimeMs) || stat.mtimeMs < 0 ||
              stat.mtimeMs > Date.now() + 120000) {
            logEvidence = 'untrusted';
          } else {
            logEvidence = 'log-write';
            lastLogWriteAt = new Date(stat.mtimeMs).toISOString();
          }
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT')
            logEvidence = 'untrusted';
        }
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT')
        logEvidence = 'untrusted';
    }
    // Re-attest the identity *after* observing state. Concurrent archives,
    // script drift or registry changes invalidate the entire observation.
    if (this.target(name) !== current ||
        this.identity(name, current, this.registry()) !== 'verified')
      throw new Error('Service identity changed during health inspection');
    return {
      name, identity: 'verified', observed, readiness: 'not-verified',
      heartbeat, autostart, logEvidence, lastLogWriteAt,
      checkedAt: new Date().toISOString(),
    };
  }

  /**
   * Read the retained log of a registered service OR an exact, independently
   * attested archived builtin worker. Archived units have no published runit
   * symlink or registration, so ordinary live ownership would reject them.
   * This grants read-only log access, never lifecycle or archive restoration.
   */
  logs(name: string): { lines: string[] } {
    valid(name);
    if (isReserved(name)) throw new Error('Protected service');
    let liveTarget: string | null = null;
    try {
      const target = this.target(name);
      if (this.identity(name, target, this.registry()) === 'verified')
        liveTarget = target;
    } catch {
      // A missing or changed live unit must independently prove an archive.
    }
    const archived = liveTarget === null
      ? this.archivedRegistry().find((entry) => entry.name === name)
      : undefined;
    if (liveTarget === null && (!archived || !this.offlineWorkerIdentity(archived)))
      throw new Error('Service or archived worker identity not verified');
    const reattest = (): boolean => {
      if (liveTarget !== null) {
        try {
          return this.target(name) === liveTarget &&
            this.identity(name, liveTarget, this.registry()) === 'verified';
        } catch {
          return false;
        }
      }
      if (!archived) return false;
      const record = this.archivedRegistry().find((entry) => entry.name === name);
      return !!record && record.template === archived.template &&
        record.instanceId === archived.instanceId &&
        record.runSha256 === archived.runSha256 &&
        record.target === archived.target &&
        this.offlineWorkerIdentity(record);
    };
    const root = path.join(PREFIX, 'var', 'log', 'sv', name);
    const file = path.join(root, 'current');
    let raw = '';
    try {
      const folder = lstatSync(root);
      if (!folder.isDirectory() || folder.isSymbolicLink() ||
          folder.uid !== process.getuid?.() || (folder.mode & 0o022) !== 0 ||
          realpathSync(root) !== root)
        throw new Error('Unsafe service log directory');
      try {
        const initial = lstatSync(file);
        if (!initial.isFile() || initial.isSymbolicLink() ||
            initial.nlink !== 1 || initial.uid !== process.getuid?.() ||
            (initial.mode & 0o022) !== 0 || initial.size > 4 * 1024 * 1024)
          throw new Error('Unsafe service log');
        const fd = openSync(file, constants.O_RDONLY | constants.O_NOFOLLOW);
        try {
          const before = fstatSync(fd);
          if (!before.isFile() || before.nlink !== 1 ||
              before.uid !== initial.uid || before.dev !== initial.dev ||
              before.ino !== initial.ino || before.size > 4 * 1024 * 1024)
            throw new Error('Service log changed during opening');
          raw = readFileSync(fd, 'utf8');
          const after = fstatSync(fd);
          const current = lstatSync(file);
          if (after.dev !== before.dev || after.ino !== before.ino ||
              current.dev !== before.dev || current.ino !== before.ino ||
              after.size > 4 * 1024 * 1024 || current.nlink !== 1)
            throw new Error('Service log changed during reading');
        } finally {
          closeSync(fd);
        }
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    if (!reattest()) throw new Error('Service identity changed during log read');
    const lines = raw.length === 0 ? [] : raw.slice(-20000)
      .split(/\r?\n/)
      .slice(-100)
      .map((line) =>
        line
          .replace(/(password|secret|token|api[_-]?key)\s*[:=]\s*\S+/gi, '$1=[redacted]')
          .split('')
          .filter((char) => {
            const code = char.charCodeAt(0);
            return code >= 32 && code !== 127;
          })
          .join('')
          .slice(0, 240),
      );
    return { lines };
  }

  /**
   * Browser H3 capability: commands are restricted to immutable, attested
   * standalone templates. A service registered by Node Hosting (or another
   * trusted provisioner) keeps its lifecycle with that provisioner.
   * The internal apply method stays available for NodeRunitHost under its
   * stronger process/release/health gates.
   */
  async applyStandalone(
    operation: 'start' | 'stop' | 'restart' | 'enable' | 'disable',
    name: string,
    run: Exec = executeFixed,
  ): Promise<{ changed: boolean; result?: HostCommandResult }> {
    valid(name);
    if (!['start', 'stop', 'restart', 'enable', 'disable'].includes(operation))
      throw new RangeError('Unsupported standalone runit operation');
    if (isReserved(name)) throw new Error('Protected service');
    const release = this.acquireStandaloneLifecycleLock();
    try {
      const target = this.target(name);
      const template = this.managedWorkerTemplate(name, target, this.registry());
      if (!template)
        throw new Error('Use the owning project provisioner for this service');
      if (template === 'python-source-v1' &&
          ['start', 'restart', 'enable'].includes(operation))
        throw new Error('Python source execution not authorized by unauthenticated LAN Services');
      const result = await this.apply(operation, name, run);
      // Enrollment alone does not confer standalone authority. A concurrent
      // archive, source change or marker replacement revokes the capability
      // even if runit already acknowledged the command.
      if (this.target(name) !== target ||
          !this.managedWorkerTemplate(name, target, this.registry())) {
        throw new Error('Standalone worker identity changed during lifecycle action');
      }
      return result;
    } finally {
      release();
    }

  }

  async apply(
    operation: ServiceOperation,
    name: string,
    run: Exec = executeFixed,
  ): Promise<{ changed: boolean; result?: HostCommandResult }> {
    valid(name);
    if (
      !['register', 'unregister', 'start', 'stop', 'restart', 'once', 'enable', 'disable'].includes(
        operation,
      )
    )
      throw new RangeError('Unsupported runit action');
    if (isReserved(name)) throw new Error('Protected service');
    if (operation === 'register')
      throw new Error('Registration requires an attested PocketHost provisioner');
    const registrations = this.registry();
    if (operation === 'unregister')
      throw new Error('Unregister refused: use attested worker archive; project services remain owned');
    const target = this.target(name);
    if (this.identity(name, target, registrations) !== 'verified')
      throw new Error('Service not explicitly registered or identity changed');
    if (operation === 'enable' || operation === 'disable') {
      // The official Termux sv-enable/sv-disable scripts persist desired
      // runit state by removing/creating the "down" marker. A zero exit
      // code does not itself prove the requested policy is now recorded.
      const desired = operation === 'enable';
      const before = this.enabled(name, true);
      if (before === null) throw new Error('Autostart state cannot be attested');
      const result = await run(
        path.join(PREFIX, 'bin', desired ? 'sv-enable' : 'sv-disable'),
        [name],
        { timeout: 20000, maxBuffer: 12000, env: { ...process.env, SVDIR: this.serviceRoot } },
      );
      if (result.exit !== 0) throw new Error('Termux autostart action failed');
      // Recheck ownership and exact target as well as persistent on-disk
      // state before acknowledging. Fail closed on partial or drifted writes.
      if (this.target(name) !== target ||
          this.identity(name, target, this.registry()) !== 'verified' ||
          this.enabled(name, true) !== desired) {
        throw new Error('Autostart write acknowledged but persistent readback unverified');
      }
      return { changed: before !== desired, result };
    }
    const command =
      operation === 'start'
        ? 'up'
        : operation === 'stop'
          ? 'down'
          : operation === 'once'
            ? 'once'
            : 'restart';
    const result = await run(
      path.join(PREFIX, 'bin', 'sv'),
      [command, path.join(this.serviceRoot, name)],
      {
        timeout: 20000,
        maxBuffer: 12000,
      },
    );
    if (result.exit !== 0) throw new Error('Runit lifecycle action failed');
    // A successful sv exit only acknowledges a command. It cannot prove
    // application readiness, and a changed unit must not be reported as
    // a successful operation under the original ownership grant.
    if (this.target(name) !== target ||
        this.identity(name, target, this.registry()) !== 'verified') {
      throw new Error('Runit service identity changed during lifecycle action');
    }
    return { changed: true, result };
  }
}
