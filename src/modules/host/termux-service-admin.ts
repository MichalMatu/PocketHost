import { createHash, randomUUID } from 'node:crypto';
import { observeRunitProcess, readRunitState, readRunitAutostart } from './termux-runit-process.ts';
import type {
  WorkerTemplate, StagedWorkerTemplate, FixedWorkerTemplate, Registration, ArchivedWorker, ArchivedWorkerSummary, ServiceIdentity, ServiceIdentityReason, ServiceOperation, RecoveryAttemptRecord, RunitRecoveryReview, RunitProcessObservation, RunitHealthReadback, WorkerHealthOverview, TermuxService,
} from './termux-service-models.ts';
export type {
  WorkerTemplate, ArchivedWorkerSummary, ServiceIdentityReason, ServiceOperation, RunitRecoveryReview, RunitProcessObservation, RunitHealthReadback, WorkerHealthOverview, TermuxService,
} from './termux-service-models.ts';

import {
  stagedWorkerSourceHash, pythonWorkerSourceHash, safeFile, releaseRecoveryLock, runSha256,
  acquireStandaloneLifecycleLock,
} from './termux-file-attestation.ts';
import {
  PREFIX, SERVICE_NAME, isStagedWorker, builtinWorkerRunScript,
  builtinWorkerLogScript, valid,
} from './termux-worker-scripts.ts';
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
  probeOwnedWorkerHttp,
  validHttpPort,
  validHttpPath,
  type WorkerHttpReadiness,
} from './worker-loopback-readiness.ts';
import {
  WorkerHeartbeatPolicy,
  type HeartbeatThresholdSeconds,
} from './worker-heartbeat-policy.ts';

// A service name or the existence of a runit directory is never evidence of
// PocketHost ownership. Only a trusted in-process provisioner can enroll a new
// unit, and every subsequent operation re-attests its canonical target.
// Preexisting service registrations keep their exact-target constraint.
const SYSTEM_SERVICE_NAMES = new Set([
  'sshd',
  'ssh-agent',
  'termux-agent',
  'pockethost-panel',
  'pockethost-panel-watch',
]);
const MAX_ENTRIES = 100;
const MAX_MANAGED = 32;
const MAX_TEMPLATE_WORKERS = 4;
const RECOVERY_WINDOW_MS = 60 * 60 * 1000;
const RECOVERY_COOLDOWN_MS = 2 * 60 * 1000;
const RECOVERY_MAX_ATTEMPTS = 2;
function isReserved(name: string, resolved?: string): boolean {
  return (
    SYSTEM_SERVICE_NAMES.has(name) ||
    (resolved !== undefined && SYSTEM_SERVICE_NAMES.has(path.basename(resolved)))
  );
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
      if (
        !file.isFile() ||
        file.isSymbolicLink() ||
        file.nlink !== 1 ||
        file.uid !== process.getuid?.() ||
        (file.mode & 0o077) !== 0
      )
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
      if (
        ![
          'archivedAt,instanceId,name,runSha256,target,template',
          'archivedAt,instanceId,name,runSha256,sourceSha256,target,template',
        ].includes(Object.keys(v).sort().join(',')) ||
        typeof v.name !== 'string' ||
        typeof v.target !== 'string' ||
        typeof v.instanceId !== 'string' ||
        typeof v.runSha256 !== 'string' ||
        typeof v.archivedAt !== 'string' ||
        ![
          'heartbeat-worker-v1',
          'python-heartbeat-v1',
          'python-source-v1',
          'node-source-v1',
        ].includes(v.template as string) ||
        (isStagedWorker(v.template as WorkerTemplate)
          ? typeof v.sourceSha256 !== 'string' || !/^[a-f0-9]{64}$/.test(v.sourceSha256)
          : v.sourceSha256 !== undefined) ||
        !/^[0-9a-f-]{36}$/.test(v.instanceId) ||
        !/^[a-f0-9]{64}$/.test(v.runSha256) ||
        !Number.isFinite(Date.parse(v.archivedAt)) ||
        v.target !== path.join(PREFIX, 'var', 'sv', v.name) ||
        seen.has(v.name)
      )
        throw new Error('Untrusted archived worker entry');
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
    if (
      !parent.isDirectory() ||
      parent.isSymbolicLink() ||
      parent.uid !== process.getuid?.() ||
      (parent.mode & 0o077) !== 0
    )
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
        if (
          !stat.isDirectory() ||
          stat.isSymbolicLink() ||
          stat.uid !== process.getuid?.() ||
          (stat.mode & 0o077) !== 0
        )
          return false;
      }
      const script = path.join(logDir, 'run');
      const stat = lstatSync(script);
      if (
        !stat.isFile() ||
        stat.isSymbolicLink() ||
        stat.nlink !== 1 ||
        stat.uid !== process.getuid?.() ||
        (stat.mode & 0o022) !== 0 ||
        (stat.mode & 0o111) === 0 ||
        stat.size > 20000
      )
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
      if (
        !root.isDirectory() ||
        root.isSymbolicLink() ||
        !dir.isDirectory() ||
        dir.isSymbolicLink() ||
        dir.uid !== process.getuid?.() ||
        (dir.mode & 0o077) !== 0 ||
        realpathSync(target) !== target ||
        runSha256(target) !== record.runSha256 ||
        createHash('sha256')
          .update(builtinWorkerRunScript(record.template, target))
          .digest('hex') !== record.runSha256 ||
        !this.fixedWorkerLogIdentity(name, target) ||
        (isStagedWorker(record.template) &&
          (!record.sourceSha256 ||
            stagedWorkerSourceHash(target, record.template) !== record.sourceSha256))
      )
        return false;
      const down = lstatSync(path.join(target, 'down'));
      if (
        !down.isFile() ||
        down.isSymbolicLink() ||
        down.uid !== process.getuid?.() ||
        (down.mode & 0o077) !== 0
      )
        return false;
      const markerFile = path.join(target, '.pockethost-service.json');
      const markerStat = lstatSync(markerFile);
      if (
        !markerStat.isFile() ||
        markerStat.isSymbolicLink() ||
        markerStat.nlink !== 1 ||
        markerStat.uid !== process.getuid?.() ||
        (markerStat.mode & 0o077) !== 0
      )
        return false;
      const markerRaw = safeFile(markerFile);
      if (!markerRaw) return false;
      const marker: unknown = JSON.parse(markerRaw);
      if (!marker || typeof marker !== 'object' || Array.isArray(marker)) return false;
      const m = marker as Record<string, unknown>;
      return (
        [
          'instanceId,name,owner,runSha256,schema,template',
          'instanceId,name,owner,runSha256,schema,sourceSha256,template',
        ].includes(Object.keys(m).sort().join(',')) &&
        (isStagedWorker(record.template)
          ? m.sourceSha256 === record.sourceSha256
          : m.sourceSha256 === undefined) &&
        m.schema === 1 &&
        m.owner === 'pockethost' &&
        m.name === name &&
        m.template === record.template &&
        m.instanceId === record.instanceId &&
        m.runSha256 === record.runSha256
      );
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
      const conflict = published || registrations.some((entry) => entry.name === item.name);
      return {
        name: item.name,
        template: item.template,
        identity: conflict
          ? ('conflict' as const)
          : this.offlineWorkerIdentity(item)
            ? ('restorable' as const)
            : ('changed' as const),
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
    if (
      ![
        'heartbeat-worker-v1',
        'python-heartbeat-v1',
        'python-source-v1',
        'node-source-v1',
      ].includes(template)
    )
      throw new RangeError('Invalid archived worker template');
    const release = acquireStandaloneLifecycleLock(this.registerFile);
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
        if (
          !st.isDirectory() ||
          st.isSymbolicLink() ||
          st.uid !== owner ||
          (st.mode & (privateOnly ? 0o077 : 0o022)) !== 0 ||
          realpathSync(folder) !== folder
        )
          throw new Error('Untrusted retirement directory');
      };
      for (const folder of [this.serviceRoot, sourceRoot, logRoot]) trustedDirectory(folder, false);
      for (const folder of [source, logs]) trustedDirectory(folder, true);
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
      if (
        entries.length >= MAX_TEMPLATE_WORKERS ||
        entries.some(
          (entry) => !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(entry),
        )
      )
        throw new Error('Retired worker quarantine full or untrusted');
      const tombstone = path.join(this.retiredRoot, record.instanceId);
      const sourceProof = lstatSync(source);
      const logProof = lstatSync(logs);
      // A fixed instance-specific tombstone prevents accidental overwrites.
      // No recursive copy, tree deletion or implicit rollback on ambiguity.
      mkdirSync(tombstone, { mode: 0o700 });
      writeFileSync(
        path.join(tombstone, 'retirement.json'),
        JSON.stringify({
          schema: 1,
          name,
          template,
          instanceId: record.instanceId,
          runSha256: record.runSha256,
          ...(record.sourceSha256 ? { sourceSha256: record.sourceSha256 } : {}),
          archivedAt: record.archivedAt,
          retiredAt: new Date().toISOString(),
        }) + '\n',
        { flag: 'wx', mode: 0o600 },
      );
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
    if (
      ![
        'heartbeat-worker-v1',
        'python-heartbeat-v1',
        'python-source-v1',
        'node-source-v1',
      ].includes(template)
    )
      throw new RangeError('Invalid archived worker template');
    const release = acquireStandaloneLifecycleLock(this.registerFile);
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
        target: record.target,
        runSha256: record.runSha256,
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
    if (!template || isStagedWorker(template))
      throw new Error('Recovery only available for fixed builtin heartbeat worker');
    const raw = safeFile(path.join(target, '.pockethost-service.json'));
    if (!raw) throw new Error('Worker identity marker missing');
    const marker: unknown = JSON.parse(raw);
    if (!marker || typeof marker !== 'object' || Array.isArray(marker))
      throw new Error('Untrusted worker identity marker');
    const instanceId = (marker as Record<string, unknown>).instanceId;
    if (
      typeof instanceId !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(instanceId)
    )
      throw new Error('Invalid worker instance identity');
    const nowMs = Date.now();
    const records = this.recoveryJournal();
    const item = records.find((entry) => entry.name === name);
    // Instance mismatch is not a route for bypassing retry limits.
    if (item && item.instanceId !== instanceId)
      throw new Error('Recovery history belongs to a different worker instance');
    if (item && item.attemptedAtMs.some((at) => at > nowMs))
      throw new Error('Recovery clock moved backwards; manual inspection required');
    const recent = item ? item.attemptedAtMs.filter((at) => nowMs - at < RECOVERY_WINDOW_MS) : [];
    const attempts = recent.length;
    const lastAttemptAtMs = recent.at(-1) ?? null;
    const observed = readRunitState(this.serviceRoot, name);
    const autostart = readRunitAutostart(this.serviceRoot, name, true, () => this.target(name));
    const decision = evaluateHealthPolicy(
      {
        readinessTimeoutMs: 5000,
        cooldownMs: RECOVERY_COOLDOWN_MS,
        maxAttempts: RECOVERY_MAX_ATTEMPTS,
      },
      {
        desired: autostart === true ? 'running' : 'stopped',
        observed,
        ready: null,
        requestedAtMs: null,
        lastAttemptAtMs,
        attempts,
        nowMs,
        owned: true,
        manuallyDisabled: autostart !== true,
      },
    );
    if (
      this.target(name) !== target ||
      this.managedWorkerTemplate(name, target, this.registry()) !== template
    )
      throw new Error('Worker changed during recovery assessment');
    return {
      name,
      template,
      observed,
      readiness: 'not-verified',
      action:
        decision.action === 'start' ? 'start' : decision.action === 'blocked' ? 'blocked' : 'none',
      reason: decision.reason,
      attempts,
      maxAttempts: RECOVERY_MAX_ATTEMPTS,
      nextEligibleAt:
        decision.nextEligibleAtMs === null
          ? null
          : new Date(decision.nextEligibleAtMs).toISOString(),
      windowEndsAt: recent.length ? new Date(recent[0]! + RECOVERY_WINDOW_MS).toISOString() : null,
      checkedAt: new Date(nowMs).toISOString(),
    };
  }

  /** Explicit, once-only recovery attempt. No timer or background worker. */
  async recoverWorkerOnce(
    name: string,
    run: Exec = executeFixed,
  ): Promise<{ requested: true; result: HostCommandResult; review: RunitRecoveryReview }> {
    // A per-process promise queue does not serialize another panel instance
    // or an independently invoked trusted host adapter. The fixed private
    // O_EXCL lock holds across policy review, journal write and runit command.
    // A crash leaves a lock and intentionally requires explicit inspection.
    const folder = path.dirname(this.recoveryFile);
    mkdirSync(folder, { recursive: true, mode: 0o700 });
    const folderStat = lstatSync(folder);
    if (
      !folderStat.isDirectory() ||
      folderStat.isSymbolicLink() ||
      folderStat.uid !== process.getuid?.() ||
      (folderStat.mode & 0o077) !== 0 ||
      realpathSync(folder) !== folder
    )
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
      if (typeof instanceId !== 'string') throw new Error('Recovery instance invalid');
      // Reassess immediately and consume the budget *before* sending sv up,
      // ensuring a crash or a failed command never triggers an unbounded retry.
      const fresh = this.reviewWorkerRecovery(name);
      if (fresh.action !== 'start' || fresh.observed !== 'stopped')
        throw new Error('Recovery state changed before attempt');
      if (old && old.instanceId !== instanceId)
        throw new Error('Recovery journal instance changed');
      if (old && old.attemptedAtMs.some((at) => at > nowMs))
        throw new Error('Recovery clock moved backwards');
      const recent = old ? old.attemptedAtMs.filter((at) => nowMs - at < RECOVERY_WINDOW_MS) : [];
      if (
        recent.length >= RECOVERY_MAX_ATTEMPTS ||
        (recent.length > 0 && nowMs < recent[recent.length - 1]! + RECOVERY_COOLDOWN_MS)
      )
        throw new Error('Recovery attempt budget or cooldown changed');
      const next: RecoveryAttemptRecord = {
        name,
        instanceId,
        attemptedAtMs: [...recent, nowMs],
      };
      this.saveRecoveryJournal([...records.filter((item) => item.name !== name), next]);
      const result = await run(
        path.join(PREFIX, 'bin', 'sv'),
        ['up', path.join(this.serviceRoot, name)],
        { timeout: 20000, maxBuffer: 12000 },
      );
      if (result.exit !== 0)
        throw new Error('Runit rejected the recovery start; attempt budget was consumed');
      return { requested: true, result, review: this.reviewWorkerRecovery(name) };
    } finally {
      // A replaced lock is never unlinked; explicit reconciliation remains
      // required. No return or throw statement inside the finally block.
      try {
        releaseRecoveryLock(lockFd, lockPath);
      } finally {
        closeSync(lockFd);
      }
    }
  }

  private recoveryJournal(): RecoveryAttemptRecord[] {
    let raw: string | null;
    try {
      const st = lstatSync(this.recoveryFile);
      if (
        !st.isFile() ||
        st.isSymbolicLink() ||
        st.nlink !== 1 ||
        st.uid !== process.getuid?.() ||
        (st.mode & 0o077) !== 0
      )
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
      const attempted = v.attemptedAtMs;
      if (
        Object.keys(v).sort().join(',') !== 'attemptedAtMs,instanceId,name' ||
        typeof v.name !== 'string' ||
        typeof v.instanceId !== 'string' ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(v.instanceId) ||
        !Array.isArray(attempted) ||
        attempted.length < 1 ||
        attempted.length > RECOVERY_MAX_ATTEMPTS ||
        !attempted.every(
          (at: unknown, i: number) =>
            typeof at === 'number' &&
            Number.isSafeInteger(at) &&
            at >= 0 &&
            (i === 0 || (typeof attempted[i - 1] === 'number' && at > attempted[i - 1])),
        ) ||
        names.has(v.name)
      )
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
    if (
      !parent.isDirectory() ||
      parent.isSymbolicLink() ||
      parent.uid !== process.getuid?.() ||
      (parent.mode & 0o077) !== 0
    )
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
    if (
      ![
        'heartbeat-worker-v1',
        'python-heartbeat-v1',
        'python-source-v1',
        'node-source-v1',
      ].includes(template)
    )
      throw new RangeError('Unsupported owned service template');
    if (isStagedWorker(template)) {
      // Source is staged, not executed. Browser Start/Restart/Enable are denied.
      if (
        typeof source !== 'string' ||
        !source.trim() ||
        source.includes(String.fromCharCode(0)) ||
        Buffer.byteLength(source) > 32 * 1024
      )
        throw new RangeError('Invalid staged source or 32 KB limit exceeded');
    } else if (source !== undefined) {
      throw new RangeError('Custom source refused by fixed templates');
    }
    if (isReserved(name)) throw new Error('Protected service');
    const release = acquireStandaloneLifecycleLock(this.registerFile);
    try {
      if (this.registry().length >= MAX_MANAGED)
        throw new RangeError('Managed service quota reached');
      const sourceRoot = path.join(PREFIX, 'var', 'sv');
      const logRoot = path.join(PREFIX, 'var', 'log', 'sv');
      const varRoot = path.join(PREFIX, 'var');
      const trustedDirectory = (folder: string): void => {
        const st = lstatSync(folder);
        if (
          !st.isDirectory() ||
          st.isSymbolicLink() ||
          st.uid !== process.getuid?.() ||
          (st.mode & 0o022) !== 0 ||
          realpathSync(folder) !== folder
        ) {
          throw new Error('Untrusted Termux service directory');
        }
      };
      // Termux/runit does not create var/sv until a service provisioner
      // needs it. Create only PocketHost's own definition root, never a
      // missing runit supervisor or logger root.
      for (const folder of [varRoot, this.serviceRoot, logRoot]) trustedDirectory(folder);
      try {
        mkdirSync(sourceRoot, { mode: 0o700 });
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      }
      trustedDirectory(sourceRoot);
      // Both templates share a quota, including already archived definitions,
      // so LAN clients cannot repeatedly archive and allocate more services.
      const templateCount = readdirSync(sourceRoot).filter((unit) => {
        if (!SERVICE_NAME.test(unit)) return false;
        const marker = path.join(sourceRoot, unit, '.pockethost-service.json');
        try {
          const raw = safeFile(marker);
          if (!raw) return false;
          const data: unknown = JSON.parse(raw);
          return (
            !!data &&
            typeof data === 'object' &&
            (data as { template?: string }).template !== undefined &&
            [
              'heartbeat-worker-v1',
              'python-heartbeat-v1',
              'python-source-v1',
              'node-source-v1',
            ].includes((data as { template: string }).template)
          );
        } catch {
          throw new Error('Managed worker inventory unverified');
        }
      }).length;
      if (templateCount >= MAX_TEMPLATE_WORKERS)
        throw new RangeError('Managed worker quota reached');
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
      const runtime =
        template === 'python-heartbeat-v1' || template === 'python-source-v1' ? python : node;
      for (const binary of [sh, env, runtime, svlogd]) {
        const st = statSync(binary);
        if (!st.isFile() || (st.mode & 0o111) === 0) throw new Error('Termux runtime unavailable');
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
      const sourceSha256 =
        isStagedWorker(template) && source !== undefined
          ? createHash('sha256').update(source).digest('hex')
          : null;
      if (sourceSha256) {
        writeFileSync(
          path.join(target, template === 'python-source-v1' ? 'worker.py' : 'worker.mjs'),
          source!,
          { flag: 'wx', mode: 0o600 },
        );
        if (!isStagedWorker(template) || stagedWorkerSourceHash(target, template) !== sourceSha256)
          throw new Error('Staged source readback does not match written bytes');
      }
      writeFileSync(
        path.join(target, '.pockethost-service.json'),
        JSON.stringify({
          schema: 1,
          owner: 'pockethost',
          name,
          template,
          runSha256: digest,
          ...(sourceSha256 ? { sourceSha256 } : {}),
          instanceId: randomUUID(),
        }) + '\n',
        { flag: 'wx', mode: 0o600 },
      );
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
      if (
        !published.isSymbolicLink() ||
        readlinkSync(path.join(this.serviceRoot, name)) !== target ||
        !directory.isDirectory() ||
        directory.isSymbolicLink() ||
        directory.uid !== process.getuid?.() ||
        (directory.mode & 0o022) !== 0
      ) {
        return null;
      }
      const markerFile = path.join(target, '.pockethost-service.json');
      const markerStat = lstatSync(markerFile);
      if (
        !markerStat.isFile() ||
        markerStat.isSymbolicLink() ||
        markerStat.nlink !== 1 ||
        markerStat.uid !== process.getuid?.() ||
        (markerStat.mode & 0o077) !== 0
      )
        return null;
      const raw = safeFile(markerFile);
      if (!raw) return null;
      const marker: unknown = JSON.parse(raw);
      if (!marker || typeof marker !== 'object' || Array.isArray(marker)) return null;
      const proof = marker as Record<string, unknown>;
      const record = registrations.find((entry) => entry.name === name);
      const validProof =
        [
          'instanceId,name,owner,runSha256,schema,template',
          'instanceId,name,owner,runSha256,schema,sourceSha256,template',
        ].includes(Object.keys(proof).sort().join(',')) &&
        proof.schema === 1 &&
        proof.owner === 'pockethost' &&
        proof.name === name &&
        [
          'heartbeat-worker-v1',
          'python-heartbeat-v1',
          'python-source-v1',
          'node-source-v1',
        ].includes(proof.template as string) &&
        (isStagedWorker(proof.template as WorkerTemplate)
          ? typeof proof.sourceSha256 === 'string' &&
            /^[a-f0-9]{64}$/.test(proof.sourceSha256) &&
            stagedWorkerSourceHash(target, proof.template as StagedWorkerTemplate) ===
              proof.sourceSha256
          : proof.sourceSha256 === undefined) &&
        typeof proof.instanceId === 'string' &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(proof.instanceId) &&
        proof.runSha256 === record?.runSha256 &&
        runSha256(target) === proof.runSha256;
      const expectedDigest =
        proof.template === 'heartbeat-worker-v1' ||
        proof.template === 'python-heartbeat-v1' ||
        proof.template === 'python-source-v1' ||
        proof.template === 'node-source-v1'
          ? createHash('sha256')
              .update(builtinWorkerRunScript(proof.template, target))
              .digest('hex')
          : null;
      return validProof &&
        proof.runSha256 === expectedDigest &&
        this.fixedWorkerLogIdentity(name, target)
        ? (proof.template as WorkerTemplate)
        : null;
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
    const release = acquireStandaloneLifecycleLock(this.registerFile);
    try {
      const registrations = this.registry();
      const target = this.target(name);
      if (!this.managedWorkerTemplate(name, target, registrations)) {
        throw new Error('Only an attested PocketHost template worker can be archived');
      }
      if (readRunitState(this.serviceRoot, name) !== 'stopped' || readRunitAutostart(this.serviceRoot, name, true, () => this.target(name)) !== false) {
        throw new Error('Archive requires a stopped worker with autostart disabled');
      }
      const published = path.join(this.serviceRoot, name);
      const result = await run(path.join(PREFIX, 'bin', 'sv'), ['exit', published], {
        timeout: 20000,
        maxBuffer: 12000,
      });
      if (result.exit !== 0) throw new Error('Runit supervisor refused exit');
      if (
        readRunitState(this.serviceRoot, name) === 'running' ||
        readRunitAutostart(this.serviceRoot, name, true, () => this.target(name)) !== false ||
        !this.managedWorkerTemplate(name, target, this.registry())
      ) {
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
      const archiveTemplate = proof.template;
      const archived = this.archivedRegistry();
      if (
        archived.some((item) => item.name === name) ||
        archived.length >= MAX_TEMPLATE_WORKERS ||
        !this.managedWorkerTemplate(name, target, this.registry()) ||
        typeof proof.instanceId !== 'string' ||
        typeof proof.runSha256 !== 'string' ||
        (archiveTemplate !== 'heartbeat-worker-v1' &&
          archiveTemplate !== 'python-heartbeat-v1' &&
          archiveTemplate !== 'python-source-v1' &&
          archiveTemplate !== 'node-source-v1')
      ) {
        throw new Error('Worker archiving identity or quota changed');
      }
      // Stage the immutable recovery record before unlinking the unit.
      this.saveArchived([
        ...archived,
        {
          name,
          target,
          template: archiveTemplate,
          instanceId: proof.instanceId,
          runSha256: proof.runSha256,
          ...(isStagedWorker(archiveTemplate) && typeof proof.sourceSha256 === 'string'
            ? { sourceSha256: proof.sourceSha256 }
            : {}),
          archivedAt: new Date().toISOString(),
        },
      ]);
      unlinkSync(published);
      this.save(registrations.filter((entry) => entry.name !== name));
      return { changed: true, archived: true, retainedFiles: true };
    } finally {
      release();
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
    if (this.archivedRegistry().some((item) => item.name === name)) return 'archive-conflict';
    const entry = registrations.find((item) => item.name === name);
    if (!entry) return 'unregistered';
    if (!target || entry.target !== target) return 'changed';
    if (!entry.runSha256) return 'legacy';
    return runSha256(target) === entry.runSha256 ? 'verified' : 'changed';
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
    )
      throw new RangeError('Invalid service provenance');
    const registrations = this.registry();
    if (registrations.some((entry) => entry.name === name)) throw new Error('Already registered');
    const target = this.target(name);
    if (target !== provenance.target) throw new Error('Service provenance target mismatch');
    const current = lstatSync(target);
    if (
      !current.isDirectory() ||
      current.isSymbolicLink() ||
      current.uid !== process.getuid?.() ||
      (current.mode & 0o022) !== 0
    )
      throw new Error('Untrusted provisioned service directory');
    if (runSha256(target) !== provenance.runSha256)
      throw new Error('Provisioned run script identity mismatch');
    this.save([
      ...registrations,
      {
        name,
        target,
        runSha256: provenance.runSha256,
        addedAt: new Date().toISOString(),
      },
    ]);
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
    if (!existing || !existing.runSha256 || existing.runSha256 !== provenance.previousRunSha256) {
      throw new Error('Previous provisioned identity unverified');
    }
    const target = this.target(name);
    if (
      target !== provenance.target ||
      target !== existing.target ||
      !/^[a-f0-9]{64}$/.test(provenance.runSha256) ||
      runSha256(target) !== provenance.runSha256
    ) {
      throw new Error('Changed provisioned identity unverified');
    }
    this.save(
      registrations.map((entry) =>
        entry.name === name ? { ...entry, runSha256: provenance.runSha256 } : entry,
      ),
    );
    return { changed: true };
  }

  /** Explain failed enrollment without exposing a run path or source material. */
  private identityReason(
    name: string,
    target: string | undefined,
    registrations: Registration[],
    identity: ServiceIdentity,
    published: boolean,
  ): ServiceIdentityReason {
    if (identity === 'reserved') return 'reserved-system-service';
    if (identity === 'archive-conflict') return 'archive-live-conflict';
    if (identity === 'unregistered') return 'no-enrollment';
    if (identity === 'legacy') return 'legacy-without-sha';
    if (identity === 'verified') return 'run-sha-attested';
    if (!published) return 'service-not-published';
    const recorded = registrations.find((entry) => entry.name === name);
    return !target || recorded?.target !== target ? 'service-target-changed' : 'run-script-changed';
  }

  list(
    probe: (name: string) => TermuxService['state'] = (name) => readRunitState(this.serviceRoot, name),
  ): TermuxService[] {
    const registrations = this.registry();
    let published: string[];
    try {
      const stat = lstatSync(this.serviceRoot);
      if (!stat.isDirectory() || stat.isSymbolicLink())
        throw new Error('Invalid service directory');
      published = readdirSync(this.serviceRoot)
        .filter((name) => SERVICE_NAME.test(name))
        .sort()
        .slice(0, MAX_ENTRIES);
    } catch {
      published = [];
    }
    const visible = new Set(published);
    // Never hide an enrolled unit merely because its runit link disappeared.
    // Missing units are diagnostic rows, not executable capabilities.
    // Prefer at most 32 registry entries over unregistered discovery when the
    // inventory reaches its 100-entry UI/API cap.
    const enrolled = registrations.map((item) => item.name).sort();
    const names = [...enrolled, ...published.filter((name) => !enrolled.includes(name))]
      .slice(0, MAX_ENTRIES)
      .sort();
    return names.map((name) => {
      let resolved: string | undefined;
      if (visible.has(name)) {
        try {
          resolved = realpathSync(path.join(this.serviceRoot, name));
        } catch {
          /* Missing/dangling entry remains unknown and cannot be controlled. */
        }
      }
      const runIdentity = this.identity(name, resolved, registrations);
      const template =
        runIdentity === 'verified' && resolved
          ? this.managedWorkerTemplate(name, resolved, registrations)
          : null;
      // The built-in standalone creator publishes ONLY var/sv/<name>. An
      // intact run SHA does not suffice if the private creator marker, fixed
      // logger, source or publication symlink is gone or modified. Never
      // silently relabel that unit as delegated to another provisioner.
      // Node Hosting's independently-owned runit units live under the
      // service root and keep their existing delegated control boundary.
      const workerProvenanceChanged =
        runIdentity === 'verified' &&
        resolved === path.join(PREFIX, 'var', 'sv', name) &&
        template === null;
      const identity: ServiceIdentity = workerProvenanceChanged ? 'changed' : runIdentity;
      const registered = identity === 'verified';
      const control: TermuxService['control'] = !registered
        ? 'read-only'
        : template
          ? 'standalone'
          : 'delegated';
      return {
        name,
        registered,
        protected: !registered,
        identity,
        identityReason: workerProvenanceChanged
          ? 'worker-provenance-changed'
          : this.identityReason(name, resolved, registrations, identity, visible.has(name)),
        control,
        ...(template ? { template } : {}),
        // Never probe a vanished or unresolved service or report persisted
        // autostart from its stale registry record.
        state: resolved ? probe(name) : 'unknown',
        enabled: resolved ? readRunitAutostart(this.serviceRoot, name, registered, () => this.target(name)) : null,
      };
    });
  }

  /** Exact named registration check: never scan or infer ownership from other services. */
  isRegistered(name: string): boolean {
    valid(name);
    const target = this.target(name);
    return this.identity(name, target, this.registry()) === 'verified';
  }

  /** Only this provisioner and its exact immutable script may configure a heartbeat. */
  private builtinHeartbeatIdentity(name: string): {
    template: FixedWorkerTemplate;
    instanceId: string;
    target: string;
  } {
    valid(name);
    if (isReserved(name)) throw new Error('Protected service');
    const target = this.target(name);
    const template = this.managedWorkerTemplate(name, target, this.registry());
    if (!template || isStagedWorker(template) || !this.fixedWorkerLogIdentity(name, target))
      throw new Error('Only fixed builtin heartbeat workers can configure heartbeat');
    const markerRaw = safeFile(path.join(target, '.pockethost-service.json'));
    if (!markerRaw) throw new Error('Worker instance marker unavailable');
    const marker: unknown = JSON.parse(markerRaw);
    if (!marker || typeof marker !== 'object' || Array.isArray(marker))
      throw new Error('Untrusted worker marker');
    const instanceId = (marker as Record<string, unknown>).instanceId;
    if (
      typeof instanceId !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(instanceId)
    )
      throw new Error('Untrusted worker instance');
    return { template, instanceId, target };
  }

  /**
   * Policy changes only: no process restart, no network probes and no shell.
   * Binding the policy to the instance blocks a replaced worker from using
   * the old heartbeat configuration.
   */
  configureWorkerHeartbeat(
    name: string,
    seconds: HeartbeatThresholdSeconds | null,
  ): { changed: boolean; heartbeat: HeartbeatReadback } {
    const worker = this.builtinHeartbeatIdentity(name);
    const changed = this.heartbeatPolicy.configure(name, worker.instanceId, seconds);
    const after = this.builtinHeartbeatIdentity(name);
    if (
      after.instanceId !== worker.instanceId ||
      after.target !== worker.target ||
      after.template !== worker.template
    )
      throw new Error('Worker identity changed during heartbeat policy update');
    return {
      changed,
      heartbeat: this.heartbeatPolicy.observe(
        name,
        after.instanceId,
        after.template,
        readRunitState(this.serviceRoot, name),
        path.join(PREFIX, 'var', 'log', 'sv', name),
      ),
    };
  }

  /**
   * Replace a stopped, owner-staged Python file only with an exact expected
   * SHA. Keep one bounded private previous revision per update. No execution,
   * package scripts, runit commands or inferred ownership is permitted.
   * A crash between the two atomic renames leaves the unit unverified until
   * manual reconciliation; it must never silently run a mismatched source.
   */
  updatePythonSource(
    name: string,
    expectedSha256: string,
    source: string,
  ): { changed: boolean; sourceSha256: string; sourceBytes: number; execution: 'blocked' } {
    valid(name);
    if (
      isReserved(name) ||
      !/^[a-f0-9]{64}$/.test(expectedSha256) ||
      typeof source !== 'string' ||
      !source.trim() ||
      source.includes(String.fromCharCode(0)) ||
      Buffer.byteLength(source) > 32 * 1024
    )
      throw new RangeError('Invalid Python revision request');
    const release = acquireStandaloneLifecycleLock(this.registerFile);
    try {
      const review = this.inspectPythonSource(name);
      if (review.sourceSha256 !== expectedSha256)
        throw new Error('Python source revision changed; review latest SHA before retry');
      if (review.observed !== 'stopped' || review.autostart !== false)
        throw new Error('Python replacement requires a stopped, autostart-disabled worker');
      const target = this.target(name);
      if (this.managedWorkerTemplate(name, target, this.registry()) !== 'python-source-v1')
        throw new Error('Python source ownership changed');

      const nextSha256 = createHash('sha256').update(source).digest('hex');
      if (nextSha256 === expectedSha256)
        return {
          changed: false,
          sourceSha256: nextSha256,
          sourceBytes: Buffer.byteLength(source),
          execution: 'blocked',
        };

      const sourcePath = path.join(target, 'worker.py');
      const markerPath = path.join(target, '.pockethost-service.json');
      const initial = lstatSync(sourcePath);
      if (
        !initial.isFile() ||
        initial.isSymbolicLink() ||
        initial.nlink !== 1 ||
        initial.uid !== process.getuid?.() ||
        (initial.mode & 0o077) !== 0 ||
        initial.size > 32 * 1024
      )
        throw new Error('Untrusted old Python source');
      const fd = openSync(sourcePath, constants.O_RDONLY | constants.O_NOFOLLOW);
      let oldBytes: Buffer;
      try {
        const opened = fstatSync(fd);
        if (
          opened.dev !== initial.dev ||
          opened.ino !== initial.ino ||
          opened.nlink !== 1 ||
          opened.size !== initial.size ||
          opened.mtimeMs !== initial.mtimeMs
        )
          throw new Error('Python source changed while opening');
        oldBytes = readFileSync(fd);
        const after = fstatSync(fd);
        const current = lstatSync(sourcePath);
        if (
          after.dev !== initial.dev ||
          after.ino !== initial.ino ||
          current.dev !== initial.dev ||
          current.ino !== initial.ino ||
          after.size !== initial.size ||
          current.size !== initial.size ||
          after.mtimeMs !== initial.mtimeMs ||
          current.mtimeMs !== initial.mtimeMs ||
          createHash('sha256').update(oldBytes).digest('hex') !== expectedSha256
        )
          throw new Error('Python source changed while copying previous revision');
      } finally {
        closeSync(fd);
      }
      const markerRaw = safeFile(markerPath);
      if (!markerRaw) throw new Error('Python owner marker missing');
      const marker: unknown = JSON.parse(markerRaw);
      if (
        !marker ||
        typeof marker !== 'object' ||
        Array.isArray(marker) ||
        (marker as Record<string, unknown>).template !== 'python-source-v1' ||
        (marker as Record<string, unknown>).sourceSha256 !== expectedSha256
      )
        throw new Error('Python owner marker changed');
      const history = path.join(target, '.python-source-history');
      try {
        mkdirSync(history, { mode: 0o700 });
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      }
      const directory = lstatSync(history);
      if (
        !directory.isDirectory() ||
        directory.isSymbolicLink() ||
        directory.uid !== process.getuid?.() ||
        (directory.mode & 0o077) !== 0 ||
        realpathSync(history) !== history
      )
        throw new Error('Unsafe Python source history');
      const revisions = readdirSync(history);
      if (revisions.length >= 8 || revisions.some((file) => !/^[0-9a-f-]{36}\.py$/.test(file)))
        throw new Error('Python source revision history full or untrusted');
      const nonce = randomUUID();
      const backup = path.join(history, nonce + '.py');
      const newSource = path.join(target, '.worker-' + nonce + '.tmp');
      const newMarker = path.join(target, '.marker-' + nonce + '.tmp');
      writeFileSync(backup, oldBytes, { flag: 'wx', mode: 0o600 });
      writeFileSync(newSource, source, { flag: 'wx', mode: 0o600 });
      writeFileSync(
        newMarker,
        JSON.stringify({
          ...(marker as Record<string, unknown>),
          sourceSha256: nextSha256,
        }) + '\n',
        { flag: 'wx', mode: 0o600 },
      );
      // One last active-source and runit readback under the lifecycle lock.
      // A failed second rename is deliberately not auto-retried.
      if (
        this.target(name) !== target ||
        this.managedWorkerTemplate(name, target, this.registry()) !== 'python-source-v1' ||
        readRunitState(this.serviceRoot, name) !== 'stopped' ||
        readRunitAutostart(this.serviceRoot, name, true, () => this.target(name)) !== false ||
        pythonWorkerSourceHash(target) !== expectedSha256
      )
        throw new Error('Python source changed before revision commit');
      renameSync(newSource, sourcePath);
      renameSync(newMarker, markerPath);
      const updated = this.inspectPythonSource(name);
      if (
        updated.sourceSha256 !== nextSha256 ||
        updated.observed !== 'stopped' ||
        updated.autostart !== false
      )
        throw new Error('Python source revision write not attested');
      return {
        changed: true,
        sourceSha256: nextSha256,
        sourceBytes: updated.sourceBytes,
        execution: 'blocked',
      };
    } finally {
      release();
    }
  }

  /**
   * Inventory at most eight private previous versions of an attested Python
   * worker. Never expose source bytes, arbitrary paths, or execution rights.
   */
  inspectPythonSourceHistory(name: string): {
    name: string;
    currentSha256: string;
    revisions: { id: string; sourceSha256: string; bytes: number; savedAt: string }[];
    execution: 'blocked';
  } {
    const active = this.inspectPythonSource(name);
    const target = this.target(name);
    const folder = path.join(target, '.python-source-history');
    let names: string[];
    try {
      const dir = lstatSync(folder);
      if (
        !dir.isDirectory() ||
        dir.isSymbolicLink() ||
        dir.uid !== process.getuid?.() ||
        (dir.mode & 0o077) !== 0 ||
        realpathSync(folder) !== folder
      )
        throw new Error('Untrusted Python revision history');
      names = readdirSync(folder);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      names = [];
    }
    if (
      names.length > 8 ||
      names.some(
        (entry) =>
          !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.py$/.test(entry),
      )
    )
      throw new Error('Unexpected Python revision history contents');
    const revisions = names
      .map((filename) => {
        const file = path.join(folder, filename);
        const initial = lstatSync(file);
        if (
          !initial.isFile() ||
          initial.isSymbolicLink() ||
          initial.nlink !== 1 ||
          initial.uid !== process.getuid?.() ||
          (initial.mode & 0o077) !== 0 ||
          initial.size < 1 ||
          initial.size > 32 * 1024 ||
          !Number.isFinite(initial.mtimeMs)
        )
          throw new Error('Unsafe Python revision');
        const fd = openSync(file, constants.O_RDONLY | constants.O_NOFOLLOW);
        let bytes: Buffer;
        try {
          const before = fstatSync(fd);
          if (
            !before.isFile() ||
            before.dev !== initial.dev ||
            before.ino !== initial.ino ||
            before.nlink !== 1 ||
            before.size !== initial.size ||
            before.mtimeMs !== initial.mtimeMs ||
            before.uid !== initial.uid ||
            (before.mode & 0o077) !== 0
          )
            throw new Error('Python revision replaced during opening');
          bytes = readFileSync(fd);
          const after = fstatSync(fd);
          const current = lstatSync(file);
          if (
            bytes.length !== initial.size ||
            after.dev !== initial.dev ||
            after.ino !== initial.ino ||
            current.dev !== initial.dev ||
            current.ino !== initial.ino ||
            after.size !== initial.size ||
            current.size !== initial.size ||
            after.mtimeMs !== initial.mtimeMs ||
            current.mtimeMs !== initial.mtimeMs ||
            current.nlink !== 1 ||
            current.uid !== initial.uid ||
            (current.mode & 0o077) !== 0
          )
            throw new Error('Python revision changed while reading');
        } finally {
          closeSync(fd);
        }
        return {
          id: filename.slice(0, -3),
          sourceSha256: createHash('sha256').update(bytes).digest('hex'),
          bytes: bytes.length,
          savedAt: new Date(initial.mtimeMs).toISOString(),
        };
      })
      .sort((a, b) => b.savedAt.localeCompare(a.savedAt) || a.id.localeCompare(b.id));
    const confirmed = this.inspectPythonSource(name);
    if (
      this.target(name) !== target ||
      active.sourceSha256 !== confirmed.sourceSha256 ||
      active.observed !== confirmed.observed ||
      active.autostart !== confirmed.autostart
    )
      throw new Error('Python worker identity changed while listing revisions');
    return {
      name,
      currentSha256: confirmed.sourceSha256,
      revisions,
      execution: 'blocked',
    };
  }

  /**
   * Restore a selected private snapshot through the existing digest-checked
   * stopped-source updater. No direct mutation of runit or launch path.
   */
  restorePythonSourceRevision(
    name: string,
    revisionId: string,
    expectedCurrentSha256: string,
    expectedRevisionSha256: string,
  ): { changed: boolean; sourceSha256: string; sourceBytes: number; execution: 'blocked' } {
    valid(name);
    if (
      !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(revisionId) ||
      !/^[a-f0-9]{64}$/.test(expectedCurrentSha256) ||
      !/^[a-f0-9]{64}$/.test(expectedRevisionSha256)
    )
      throw new RangeError('Invalid Python revision selector');
    const record = this.inspectPythonSourceHistory(name);
    if (
      record.currentSha256 !== expectedCurrentSha256 ||
      !record.revisions.some(
        (item) => item.id === revisionId && item.sourceSha256 === expectedRevisionSha256,
      )
    )
      throw new Error('Python revision selection is stale');
    const folder = path.join(this.target(name), '.python-source-history');
    const file = path.join(folder, revisionId + '.py');
    const initial = lstatSync(file);
    if (
      !initial.isFile() ||
      initial.isSymbolicLink() ||
      initial.nlink !== 1 ||
      initial.uid !== process.getuid?.() ||
      (initial.mode & 0o077) !== 0 ||
      initial.size < 1 ||
      initial.size > 32 * 1024
    )
      throw new Error('Invalid retained Python file');
    const fd = openSync(file, constants.O_RDONLY | constants.O_NOFOLLOW);
    let bytes: Buffer;
    try {
      const before = fstatSync(fd);
      if (
        before.dev !== initial.dev ||
        before.ino !== initial.ino ||
        before.nlink !== 1 ||
        before.size !== initial.size ||
        before.mtimeMs !== initial.mtimeMs ||
        before.uid !== initial.uid ||
        (before.mode & 0o077) !== 0
      )
        throw new Error('Retained Python file changed during opening');
      bytes = readFileSync(fd);
      const after = fstatSync(fd);
      const current = lstatSync(file);
      if (
        bytes.length !== initial.size ||
        after.dev !== initial.dev ||
        after.ino !== initial.ino ||
        current.dev !== initial.dev ||
        current.ino !== initial.ino ||
        after.size !== initial.size ||
        current.size !== initial.size ||
        after.mtimeMs !== initial.mtimeMs ||
        current.mtimeMs !== initial.mtimeMs ||
        current.nlink !== 1 ||
        current.uid !== initial.uid ||
        (current.mode & 0o077) !== 0 ||
        createHash('sha256').update(bytes).digest('hex') !== expectedRevisionSha256
      )
        throw new Error('Retained Python source fingerprint changed');
    } finally {
      closeSync(fd);
    }
    const text = bytes.toString('utf8');
    if (
      !text.trim() ||
      text.includes(String.fromCharCode(0)) ||
      !Buffer.from(text, 'utf8').equals(bytes)
    )
      throw new Error('Retained Python source is not valid UTF-8 text');
    const result = this.updatePythonSource(name, expectedCurrentSha256, text);
    if (result.sourceSha256 !== expectedRevisionSha256)
      throw new Error('Restored Python source not attested');
    return result;
  }

  /**
   * Replace a stopped, owner-staged Node.js file only with an exact expected
   * SHA. Keep one bounded private previous revision per update. No execution,
   * package scripts, runit commands or inferred ownership is permitted.
   * A crash between the two atomic renames leaves the unit unverified until
   * manual reconciliation; it must never silently run a mismatched source.
   */
  updateNodeSource(
    name: string,
    expectedSha256: string,
    source: string,
  ): { changed: boolean; sourceSha256: string; sourceBytes: number; execution: 'blocked' } {
    valid(name);
    if (
      isReserved(name) ||
      !/^[a-f0-9]{64}$/.test(expectedSha256) ||
      typeof source !== 'string' ||
      !source.trim() ||
      source.includes(String.fromCharCode(0)) ||
      Buffer.byteLength(source) > 32 * 1024
    )
      throw new RangeError('Invalid Node.js revision request');
    const release = acquireStandaloneLifecycleLock(this.registerFile);
    try {
      const review = this.inspectNodeSource(name);
      if (review.sourceSha256 !== expectedSha256)
        throw new Error('Node.js source revision changed; review latest SHA before retry');
      if (review.observed !== 'stopped' || review.autostart !== false)
        throw new Error('Node.js replacement requires a stopped, autostart-disabled worker');
      const target = this.target(name);
      if (this.managedWorkerTemplate(name, target, this.registry()) !== 'node-source-v1')
        throw new Error('Node.js source ownership changed');

      const nextSha256 = createHash('sha256').update(source).digest('hex');
      if (nextSha256 === expectedSha256)
        return {
          changed: false,
          sourceSha256: nextSha256,
          sourceBytes: Buffer.byteLength(source),
          execution: 'blocked',
        };

      const sourcePath = path.join(target, 'worker.mjs');
      const markerPath = path.join(target, '.pockethost-service.json');
      const initial = lstatSync(sourcePath);
      if (
        !initial.isFile() ||
        initial.isSymbolicLink() ||
        initial.nlink !== 1 ||
        initial.uid !== process.getuid?.() ||
        (initial.mode & 0o077) !== 0 ||
        initial.size > 32 * 1024
      )
        throw new Error('Untrusted old Node.js source');
      const fd = openSync(sourcePath, constants.O_RDONLY | constants.O_NOFOLLOW);
      let oldBytes: Buffer;
      try {
        const opened = fstatSync(fd);
        if (
          opened.dev !== initial.dev ||
          opened.ino !== initial.ino ||
          opened.nlink !== 1 ||
          opened.size !== initial.size ||
          opened.mtimeMs !== initial.mtimeMs
        )
          throw new Error('Node.js source changed while opening');
        oldBytes = readFileSync(fd);
        const after = fstatSync(fd);
        const current = lstatSync(sourcePath);
        if (
          after.dev !== initial.dev ||
          after.ino !== initial.ino ||
          current.dev !== initial.dev ||
          current.ino !== initial.ino ||
          after.size !== initial.size ||
          current.size !== initial.size ||
          after.mtimeMs !== initial.mtimeMs ||
          current.mtimeMs !== initial.mtimeMs ||
          createHash('sha256').update(oldBytes).digest('hex') !== expectedSha256
        )
          throw new Error('Node.js source changed while copying previous revision');
      } finally {
        closeSync(fd);
      }
      const markerRaw = safeFile(markerPath);
      if (!markerRaw) throw new Error('Node.js owner marker missing');
      const marker: unknown = JSON.parse(markerRaw);
      if (
        !marker ||
        typeof marker !== 'object' ||
        Array.isArray(marker) ||
        (marker as Record<string, unknown>).template !== 'node-source-v1' ||
        (marker as Record<string, unknown>).sourceSha256 !== expectedSha256
      )
        throw new Error('Node.js owner marker changed');
      const history = path.join(target, '.node-source-history');
      try {
        mkdirSync(history, { mode: 0o700 });
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      }
      const directory = lstatSync(history);
      if (
        !directory.isDirectory() ||
        directory.isSymbolicLink() ||
        directory.uid !== process.getuid?.() ||
        (directory.mode & 0o077) !== 0 ||
        realpathSync(history) !== history
      )
        throw new Error('Unsafe Node.js source history');
      const revisions = readdirSync(history);
      if (revisions.length >= 8 || revisions.some((file) => !/^[0-9a-f-]{36}\.mjs$/.test(file)))
        throw new Error('Node.js source revision history full or untrusted');
      const nonce = randomUUID();
      const backup = path.join(history, nonce + '.mjs');
      const newSource = path.join(target, '.worker-' + nonce + '.tmp');
      const newMarker = path.join(target, '.marker-' + nonce + '.tmp');
      writeFileSync(backup, oldBytes, { flag: 'wx', mode: 0o600 });
      writeFileSync(newSource, source, { flag: 'wx', mode: 0o600 });
      writeFileSync(
        newMarker,
        JSON.stringify({
          ...(marker as Record<string, unknown>),
          sourceSha256: nextSha256,
        }) + '\n',
        { flag: 'wx', mode: 0o600 },
      );
      // One last active-source and runit readback under the lifecycle lock.
      // A failed second rename is deliberately not auto-retried.
      if (
        this.target(name) !== target ||
        this.managedWorkerTemplate(name, target, this.registry()) !== 'node-source-v1' ||
        readRunitState(this.serviceRoot, name) !== 'stopped' ||
        readRunitAutostart(this.serviceRoot, name, true, () => this.target(name)) !== false ||
        stagedWorkerSourceHash(target, 'node-source-v1') !== expectedSha256
      )
        throw new Error('Node.js source changed before revision commit');
      renameSync(newSource, sourcePath);
      renameSync(newMarker, markerPath);
      const updated = this.inspectNodeSource(name);
      if (
        updated.sourceSha256 !== nextSha256 ||
        updated.observed !== 'stopped' ||
        updated.autostart !== false
      )
        throw new Error('Node.js source revision write not attested');
      return {
        changed: true,
        sourceSha256: nextSha256,
        sourceBytes: updated.sourceBytes,
        execution: 'blocked',
      };
    } finally {
      release();
    }
  }

  /**
   * Inventory at most eight private previous versions of an attested Python
   * worker. Never expose source bytes, arbitrary paths, or execution rights.
   */
  inspectNodeSourceHistory(name: string): {
    name: string;
    currentSha256: string;
    revisions: { id: string; sourceSha256: string; bytes: number; savedAt: string }[];
    execution: 'blocked';
  } {
    const active = this.inspectNodeSource(name);
    const target = this.target(name);
    const folder = path.join(target, '.node-source-history');
    let names: string[];
    try {
      const dir = lstatSync(folder);
      if (
        !dir.isDirectory() ||
        dir.isSymbolicLink() ||
        dir.uid !== process.getuid?.() ||
        (dir.mode & 0o077) !== 0 ||
        realpathSync(folder) !== folder
      )
        throw new Error('Untrusted Node.js revision history');
      names = readdirSync(folder);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      names = [];
    }
    if (
      names.length > 8 ||
      names.some(
        (entry) =>
          !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.mjs$/.test(entry),
      )
    )
      throw new Error('Unexpected Node.js revision history contents');
    const revisions = names
      .map((filename) => {
        const file = path.join(folder, filename);
        const initial = lstatSync(file);
        if (
          !initial.isFile() ||
          initial.isSymbolicLink() ||
          initial.nlink !== 1 ||
          initial.uid !== process.getuid?.() ||
          (initial.mode & 0o077) !== 0 ||
          initial.size < 1 ||
          initial.size > 32 * 1024 ||
          !Number.isFinite(initial.mtimeMs)
        )
          throw new Error('Unsafe Node.js revision');
        const fd = openSync(file, constants.O_RDONLY | constants.O_NOFOLLOW);
        let bytes: Buffer;
        try {
          const before = fstatSync(fd);
          if (
            !before.isFile() ||
            before.dev !== initial.dev ||
            before.ino !== initial.ino ||
            before.nlink !== 1 ||
            before.size !== initial.size ||
            before.mtimeMs !== initial.mtimeMs ||
            before.uid !== initial.uid ||
            (before.mode & 0o077) !== 0
          )
            throw new Error('Node.js revision replaced during opening');
          bytes = readFileSync(fd);
          const after = fstatSync(fd);
          const current = lstatSync(file);
          if (
            bytes.length !== initial.size ||
            after.dev !== initial.dev ||
            after.ino !== initial.ino ||
            current.dev !== initial.dev ||
            current.ino !== initial.ino ||
            after.size !== initial.size ||
            current.size !== initial.size ||
            after.mtimeMs !== initial.mtimeMs ||
            current.mtimeMs !== initial.mtimeMs ||
            current.nlink !== 1 ||
            current.uid !== initial.uid ||
            (current.mode & 0o077) !== 0
          )
            throw new Error('Node.js revision changed while reading');
        } finally {
          closeSync(fd);
        }
        return {
          id: filename.slice(0, -4),
          sourceSha256: createHash('sha256').update(bytes).digest('hex'),
          bytes: bytes.length,
          savedAt: new Date(initial.mtimeMs).toISOString(),
        };
      })
      .sort((a, b) => b.savedAt.localeCompare(a.savedAt) || a.id.localeCompare(b.id));
    const confirmed = this.inspectNodeSource(name);
    if (
      this.target(name) !== target ||
      active.sourceSha256 !== confirmed.sourceSha256 ||
      active.observed !== confirmed.observed ||
      active.autostart !== confirmed.autostart
    )
      throw new Error('Node.js worker identity changed while listing revisions');
    return {
      name,
      currentSha256: confirmed.sourceSha256,
      revisions,
      execution: 'blocked',
    };
  }

  /**
   * Restore a selected private snapshot through the existing digest-checked
   * stopped-source updater. No direct mutation of runit or launch path.
   */
  restoreNodeSourceRevision(
    name: string,
    revisionId: string,
    expectedCurrentSha256: string,
    expectedRevisionSha256: string,
  ): { changed: boolean; sourceSha256: string; sourceBytes: number; execution: 'blocked' } {
    valid(name);
    if (
      !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(revisionId) ||
      !/^[a-f0-9]{64}$/.test(expectedCurrentSha256) ||
      !/^[a-f0-9]{64}$/.test(expectedRevisionSha256)
    )
      throw new RangeError('Invalid Node.js revision selector');
    const record = this.inspectNodeSourceHistory(name);
    if (
      record.currentSha256 !== expectedCurrentSha256 ||
      !record.revisions.some(
        (item) => item.id === revisionId && item.sourceSha256 === expectedRevisionSha256,
      )
    )
      throw new Error('Node.js revision selection is stale');
    const folder = path.join(this.target(name), '.node-source-history');
    const file = path.join(folder, revisionId + '.mjs');
    const initial = lstatSync(file);
    if (
      !initial.isFile() ||
      initial.isSymbolicLink() ||
      initial.nlink !== 1 ||
      initial.uid !== process.getuid?.() ||
      (initial.mode & 0o077) !== 0 ||
      initial.size < 1 ||
      initial.size > 32 * 1024
    )
      throw new Error('Invalid retained Node.js file');
    const fd = openSync(file, constants.O_RDONLY | constants.O_NOFOLLOW);
    let bytes: Buffer;
    try {
      const before = fstatSync(fd);
      if (
        before.dev !== initial.dev ||
        before.ino !== initial.ino ||
        before.nlink !== 1 ||
        before.size !== initial.size ||
        before.mtimeMs !== initial.mtimeMs ||
        before.uid !== initial.uid ||
        (before.mode & 0o077) !== 0
      )
        throw new Error('Retained Node.js file changed during opening');
      bytes = readFileSync(fd);
      const after = fstatSync(fd);
      const current = lstatSync(file);
      if (
        bytes.length !== initial.size ||
        after.dev !== initial.dev ||
        after.ino !== initial.ino ||
        current.dev !== initial.dev ||
        current.ino !== initial.ino ||
        after.size !== initial.size ||
        current.size !== initial.size ||
        after.mtimeMs !== initial.mtimeMs ||
        current.mtimeMs !== initial.mtimeMs ||
        current.nlink !== 1 ||
        current.uid !== initial.uid ||
        (current.mode & 0o077) !== 0 ||
        createHash('sha256').update(bytes).digest('hex') !== expectedRevisionSha256
      )
        throw new Error('Retained Node.js source fingerprint changed');
    } finally {
      closeSync(fd);
    }
    const text = bytes.toString('utf8');
    if (
      !text.trim() ||
      text.includes(String.fromCharCode(0)) ||
      !Buffer.from(text, 'utf8').equals(bytes)
    )
      throw new Error('Retained Node.js source is not valid UTF-8 text');
    const result = this.updateNodeSource(name, expectedCurrentSha256, text);
    if (result.sourceSha256 !== expectedRevisionSha256)
      throw new Error('Restored Node.js source not attested');
    return result;
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
    if (
      !initial.isFile() ||
      initial.isSymbolicLink() ||
      initial.nlink !== 1 ||
      initial.uid !== process.getuid?.() ||
      (initial.mode & 0o077) !== 0 ||
      initial.size === 0 ||
      initial.size > 32 * 1024
    )
      throw new Error('Python source file not owner-private');
    const fd = openSync(sourcePath, constants.O_RDONLY | constants.O_NOFOLLOW);
    let bytes: Buffer;
    try {
      const before = fstatSync(fd);
      if (
        !before.isFile() ||
        before.nlink !== 1 ||
        before.dev !== initial.dev ||
        before.ino !== initial.ino ||
        before.uid !== initial.uid ||
        (before.mode & 0o077) !== 0 ||
        before.size !== initial.size ||
        before.mtimeMs !== initial.mtimeMs
      )
        throw new Error('Python source changed while opening');
      bytes = readFileSync(fd);
      const after = fstatSync(fd);
      const current = lstatSync(sourcePath);
      if (
        bytes.length !== before.size ||
        after.dev !== before.dev ||
        after.ino !== before.ino ||
        after.size !== before.size ||
        after.mtimeMs !== before.mtimeMs ||
        current.dev !== before.dev ||
        current.ino !== before.ino ||
        current.size !== before.size ||
        current.mtimeMs !== before.mtimeMs ||
        current.nlink !== 1 ||
        current.uid !== before.uid ||
        (current.mode & 0o077) !== 0
      )
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
    if (
      typeof expected !== 'string' ||
      !/^[a-f0-9]{64}$/.test(expected) ||
      expected !== sourceSha256
    )
      throw new Error('Python source fingerprint changed');
    const observed = readRunitState(this.serviceRoot, name);
    const autostart = readRunitAutostart(this.serviceRoot, name, true, () => this.target(name));
    if (
      this.target(name) !== target ||
      this.managedWorkerTemplate(name, target, this.registry()) !== 'python-source-v1'
    )
      throw new Error('Python worker identity changed during review');
    return {
      name,
      template: 'python-source-v1',
      sourceSha256,
      sourceBytes: bytes.length,
      observed,
      autostart,
      canStartFromLan: false,
      ownerApproval: 'not-configured',
      checkedAt: new Date().toISOString(),
    };
  }

  /** Read-only SHA and state for a staged Node app; source never leaves the host. */
  inspectNodeSource(name: string): {
    name: string;
    template: 'node-source-v1';
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
    if (this.managedWorkerTemplate(name, target, this.registry()) !== 'node-source-v1')
      throw new Error('Only attested owner-staged Node source can be reviewed');
    const sourceSha256 = stagedWorkerSourceHash(target, 'node-source-v1');
    const file = lstatSync(path.join(target, 'worker.mjs'));
    if (!sourceSha256 || !file.isFile() || file.size === 0 || file.size > 32 * 1024)
      throw new Error('Node source identity changed');
    const observed = readRunitState(this.serviceRoot, name);
    const autostart = readRunitAutostart(this.serviceRoot, name, true, () => this.target(name));
    if (
      this.target(name) !== target ||
      stagedWorkerSourceHash(target, 'node-source-v1') !== sourceSha256 ||
      this.managedWorkerTemplate(name, target, this.registry()) !== 'node-source-v1'
    )
      throw new Error('Node source identity changed during review');
    return {
      name,
      template: 'node-source-v1',
      sourceSha256,
      sourceBytes: file.size,
      observed,
      autostart,
      canStartFromLan: false,
      ownerApproval: 'not-configured',
      checkedAt: new Date().toISOString(),
    };
  }

  /**
   * Manual snapshot of PocketHost standalone worker health. Never probes a
   * delegated project through the generic Services authority or exposes
   * unregistered/foreign service names. Failed re-attestation is an unavailable
   * row, never a success or trigger for automatic repair.
   */
  inspectHealthOverview(): WorkerHealthOverview {
    const inventory = this.list();
    const registeredNames = new Set(this.registry().map((item) => item.name));
    const blockedRegistrations = inventory.filter(
      (item) => registeredNames.has(item.name) && !item.registered,
    ).length;
    const workers = inventory.filter(
      (item) =>
        item.control === 'standalone' && item.registered && !item.protected && !!item.template,
    );
    const rows: WorkerHealthOverview['rows'] = workers
      .slice(0, MAX_TEMPLATE_WORKERS)
      .map((item) => {
        const name = item.name;
        const template = item.template!;
        try {
          const health = this.inspectHealth(name);
          if (this.managedWorkerTemplate(name, this.target(name), this.registry()) !== template)
            throw new Error('Worker changed during batch readback');
          return { name, template, status: 'observed' as const, health };
        } catch {
          return { name, template, status: 'unavailable' as const };
        }
      });
    return {
      checkedAt: new Date().toISOString(),
      blockedRegistrations,
      truncated: workers.length > MAX_TEMPLATE_WORKERS,
      rows,
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
    const observed = readRunitState(this.serviceRoot, name);
    const runitProcess = observeRunitProcess(this.serviceRoot, name, observed);
    const autostart = readRunitAutostart(this.serviceRoot, name, true, () => this.target(name));
    const template = this.managedWorkerTemplate(name, current, registrations);
    const heartbeat: HeartbeatReadback =
      template && !isStagedWorker(template)
        ? (() => {
            const worker = this.builtinHeartbeatIdentity(name);
            return this.heartbeatPolicy.observe(
              name,
              worker.instanceId,
              worker.template,
              observed,
              path.join(PREFIX, 'var', 'log', 'sv', name),
            );
          })()
        : { mode: 'disabled', staleAfterSeconds: null, status: 'disabled', lastOutputAt: null };
    let logEvidence: RunitHealthReadback['logEvidence'] = 'no-log';
    let lastLogWriteAt: string | null = null;
    const logRoot = path.join(PREFIX, 'var', 'log', 'sv', name);
    try {
      const folder = lstatSync(logRoot);
      if (
        !folder.isDirectory() ||
        folder.isSymbolicLink() ||
        folder.uid !== process.getuid?.() ||
        (folder.mode & 0o022) !== 0
      ) {
        logEvidence = 'untrusted';
      } else {
        const logFile = path.join(logRoot, 'current');
        try {
          const stat = lstatSync(logFile);
          if (
            !stat.isFile() ||
            stat.isSymbolicLink() ||
            stat.nlink !== 1 ||
            stat.uid !== process.getuid?.() ||
            (stat.mode & 0o022) !== 0 ||
            stat.size > 4 * 1024 * 1024 ||
            !Number.isFinite(stat.mtimeMs) ||
            stat.mtimeMs < 0 ||
            stat.mtimeMs > Date.now() + 120000
          ) {
            logEvidence = 'untrusted';
          } else {
            logEvidence = 'log-write';
            lastLogWriteAt = new Date(stat.mtimeMs).toISOString();
          }
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') logEvidence = 'untrusted';
        }
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') logEvidence = 'untrusted';
    }
    // Re-attest the identity *after* observing state. Concurrent archives,
    // script drift or registry changes invalidate the entire observation.
    if (
      this.target(name) !== current ||
      this.identity(name, current, this.registry()) !== 'verified'
    )
      throw new Error('Service identity changed during health inspection');
    return {
      name,
      identity: 'verified',
      observed,
      readiness: 'not-verified',
      process: runitProcess,
      heartbeat,
      autostart,
      logEvidence,
      lastLogWriteAt,
      checkedAt: new Date().toISOString(),
    };
  }

  /**
   * Explicit, on-demand HTTP check for an attested standalone worker.
   * The browser never supplies a hostname, PID, scheme, shell command or
   * arbitrary URL. The probe itself verifies the 127.0.0.1 listener belongs
   * to this worker's corroborated same-UID PID; unavailable proof means no GET.
   * The worker identity and PID start ticks are checked again afterward.
   * This request never saves a policy or starts a background check.
   */
  async inspectWorkerHttp(
    name: string,
    port: number,
    urlPath: string,
  ): Promise<WorkerHttpReadiness> {
    valid(name);
    if (isReserved(name) || !validHttpPort(port) || !validHttpPath(urlPath))
      throw new RangeError('Unsafe worker HTTP readiness request');
    const registrations = this.registry();
    const target = this.target(name);
    const template = this.managedWorkerTemplate(name, target, registrations);
    if (!template) throw new Error('HTTP readiness requires an attested standalone worker');
    const before = this.inspectHealth(name);
    if (before.process.status !== 'observed' || !before.process.pid) {
      return {
        name,
        status: 'unverified',
        httpStatus: null,
        reason: 'process-unverified',
        checkedAt: new Date().toISOString(),
      };
    }
    let check: WorkerHttpReadiness;
    try {
      check = await probeOwnedWorkerHttp(name, before.process.pid, port, urlPath);
    } catch {
      check = {
        name,
        status: 'unverified',
        httpStatus: null,
        reason: 'transport-unverified',
        checkedAt: new Date().toISOString(),
      };
    }
    try {
      const after = this.inspectHealth(name);
      if (
        after.process.status !== 'observed' ||
        after.process.pid !== before.process.pid ||
        after.process.startTicks !== before.process.startTicks ||
        after.process.uptimeSeconds === null ||
        before.process.uptimeSeconds === null ||
        after.process.uptimeSeconds < before.process.uptimeSeconds ||
        this.target(name) !== target ||
        this.managedWorkerTemplate(name, target, this.registry()) !== template
      )
        throw new Error('Worker identity changed during HTTP readiness check');
      return check;
    } catch {
      return {
        name,
        status: 'unverified',
        httpStatus: null,
        reason: 'worker-changed',
        checkedAt: new Date().toISOString(),
      };
    }
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
      if (this.identity(name, target, this.registry()) === 'verified') liveTarget = target;
    } catch {
      // A missing or changed live unit must independently prove an archive.
    }
    const archived =
      liveTarget === null
        ? this.archivedRegistry().find((entry) => entry.name === name)
        : undefined;
    if (liveTarget === null && (!archived || !this.offlineWorkerIdentity(archived)))
      throw new Error('Service or archived worker identity not verified');
    const reattest = (): boolean => {
      if (liveTarget !== null) {
        try {
          return (
            this.target(name) === liveTarget &&
            this.identity(name, liveTarget, this.registry()) === 'verified'
          );
        } catch {
          return false;
        }
      }
      if (!archived) return false;
      const record = this.archivedRegistry().find((entry) => entry.name === name);
      return (
        !!record &&
        record.template === archived.template &&
        record.instanceId === archived.instanceId &&
        record.runSha256 === archived.runSha256 &&
        record.target === archived.target &&
        this.offlineWorkerIdentity(record)
      );
    };
    const root = path.join(PREFIX, 'var', 'log', 'sv', name);
    const file = path.join(root, 'current');
    let raw = '';
    try {
      const folder = lstatSync(root);
      if (
        !folder.isDirectory() ||
        folder.isSymbolicLink() ||
        folder.uid !== process.getuid?.() ||
        (folder.mode & 0o022) !== 0 ||
        realpathSync(root) !== root
      )
        throw new Error('Unsafe service log directory');
      try {
        const initial = lstatSync(file);
        if (
          !initial.isFile() ||
          initial.isSymbolicLink() ||
          initial.nlink !== 1 ||
          initial.uid !== process.getuid?.() ||
          (initial.mode & 0o022) !== 0 ||
          initial.size > 4 * 1024 * 1024
        )
          throw new Error('Unsafe service log');
        const fd = openSync(file, constants.O_RDONLY | constants.O_NOFOLLOW);
        try {
          const before = fstatSync(fd);
          if (
            !before.isFile() ||
            before.nlink !== 1 ||
            before.uid !== initial.uid ||
            before.dev !== initial.dev ||
            before.ino !== initial.ino ||
            before.size > 4 * 1024 * 1024
          )
            throw new Error('Service log changed during opening');
          raw = readFileSync(fd, 'utf8');
          const after = fstatSync(fd);
          const current = lstatSync(file);
          if (
            after.dev !== before.dev ||
            after.ino !== before.ino ||
            current.dev !== before.dev ||
            current.ino !== before.ino ||
            after.size > 4 * 1024 * 1024 ||
            current.nlink !== 1
          )
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
    const lines =
      raw.length === 0
        ? []
        : raw
            .slice(-20000)
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
    const release = acquireStandaloneLifecycleLock(this.registerFile);
    try {
      const target = this.target(name);
      const template = this.managedWorkerTemplate(name, target, this.registry());
      if (!template) throw new Error('Use the owning project provisioner for this service');
      if (isStagedWorker(template) && ['start', 'restart', 'enable'].includes(operation))
        throw new Error('Custom source execution not authorized by unauthenticated LAN Services');
      const result = await this.apply(operation, name, run);
      // Enrollment alone does not confer standalone authority. A concurrent
      // archive, source change or marker replacement revokes the capability
      // even if runit already acknowledged the command.
      if (
        this.target(name) !== target ||
        !this.managedWorkerTemplate(name, target, this.registry())
      ) {
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
      throw new Error(
        'Unregister refused: use attested worker archive; project services remain owned',
      );
    const target = this.target(name);
    if (this.identity(name, target, registrations) !== 'verified')
      throw new Error('Service not explicitly registered or identity changed');
    if (operation === 'enable' || operation === 'disable') {
      // The official Termux sv-enable/sv-disable scripts persist desired
      // runit state by removing/creating the "down" marker. A zero exit
      // code does not itself prove the requested policy is now recorded.
      const desired = operation === 'enable';
      const before = readRunitAutostart(this.serviceRoot, name, true, () => this.target(name));
      if (before === null) throw new Error('Autostart state cannot be attested');
      const result = await run(
        path.join(PREFIX, 'bin', desired ? 'sv-enable' : 'sv-disable'),
        [name],
        { timeout: 20000, maxBuffer: 12000, env: { ...process.env, SVDIR: this.serviceRoot } },
      );
      if (result.exit !== 0) throw new Error('Termux autostart action failed');
      // Recheck ownership and exact target as well as persistent on-disk
      // state before acknowledging. Fail closed on partial or drifted writes.
      if (
        this.target(name) !== target ||
        this.identity(name, target, this.registry()) !== 'verified' ||
        readRunitAutostart(this.serviceRoot, name, true, () => this.target(name)) !== desired
      ) {
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
    if (
      this.target(name) !== target ||
      this.identity(name, target, this.registry()) !== 'verified'
    ) {
      throw new Error('Runit service identity changed during lifecycle action');
    }
    return { changed: true, result };
  }
}
