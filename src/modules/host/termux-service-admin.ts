import { createHash, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import {
  existsSync,
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
export type WorkerTemplate = 'heartbeat-worker-v1' | 'python-heartbeat-v1';

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
export interface TermuxService {
  name: string;
  registered: boolean;
  protected: boolean;
  identity: ServiceIdentity;
  /** Only the fully attested built-in template grants archive capability. */
  template?: WorkerTemplate;
  state: 'running' | 'stopped' | 'unknown';
  enabled?: boolean | null;
}

/**
 * Fixed, exact source identity for both available standalone templates.
 * This function is the allowed execution policy, not merely a display
 * label; recovery re-computes the same SHA-256 before re-enrollment.
 */
function builtinWorkerRunScript(template: WorkerTemplate, target: string): string {
  if (template !== 'heartbeat-worker-v1' && template !== 'python-heartbeat-v1')
    throw new RangeError('Invalid builtin worker');
  if (target !== path.join(PREFIX, 'var', 'sv', path.basename(target)))
    throw new Error('Unexpected builtin target path');
  const sh = path.join(PREFIX, 'bin', 'sh');
  const env = path.join(PREFIX, 'bin', 'env');
  const runtime = path.join(PREFIX, 'bin', template === 'python-heartbeat-v1' ? 'python' : 'node');
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
      if (Object.keys(v).sort().join(',') !==
            'archivedAt,instanceId,name,runSha256,target,template' ||
          typeof v.name !== 'string' || typeof v.target !== 'string' ||
          typeof v.instanceId !== 'string' || typeof v.runSha256 !== 'string' ||
          typeof v.archivedAt !== 'string' ||
          (v.template !== 'heartbeat-worker-v1' && v.template !== 'python-heartbeat-v1') ||
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
          !this.fixedWorkerLogIdentity(name, target))
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
      return Object.keys(m).sort().join(',') ===
          'instanceId,name,owner,runSha256,schema,template' &&
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
    if (template !== 'heartbeat-worker-v1' && template !== 'python-heartbeat-v1')
      throw new RangeError('Invalid archived worker template');
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
  ): { changed: boolean; name: string; template: WorkerTemplate } {
    valid(name);
    if (template !== 'heartbeat-worker-v1' && template !== 'python-heartbeat-v1')
      throw new RangeError('Unsupported owned service template');
    if (isReserved(name)) throw new Error('Protected service');
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
          ['heartbeat-worker-v1', 'python-heartbeat-v1'].includes(
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
    const runtime = template === 'python-heartbeat-v1' ? python : node;
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
    writeFileSync(path.join(target, '.pockethost-service.json'), JSON.stringify({
      schema: 1, owner: 'pockethost', name, template,
      runSha256: digest, instanceId: randomUUID(),
    }) + '\n', { flag: 'wx', mode: 0o600 });
    symlinkSync(target, published);
    this.registerProvisioned(name, { target, runSha256: digest });
    return { changed: true, name, template };
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
      const validProof = Object.keys(proof).sort().join(',') ===
          'instanceId,name,owner,runSha256,schema,template' &&
        proof.schema === 1 && proof.owner === 'pockethost' &&
        proof.name === name &&
        (proof.template === 'heartbeat-worker-v1' ||
          proof.template === 'python-heartbeat-v1') &&
        typeof proof.instanceId === 'string' &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(proof.instanceId) &&
        proof.runSha256 === record?.runSha256 &&
        this.runSha256(target) === proof.runSha256;
      const expectedDigest = (proof.template === 'heartbeat-worker-v1' ||
        proof.template === 'python-heartbeat-v1')
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
        (proof.template !== 'heartbeat-worker-v1' &&
          proof.template !== 'python-heartbeat-v1')) {
      throw new Error('Worker archiving identity or quota changed');
    }
    // Stage the immutable recovery record before unlinking the unit.
    this.saveArchived([...archived, {
      name, target, template: proof.template,
      instanceId: proof.instanceId, runSha256: proof.runSha256,
      archivedAt: new Date().toISOString(),
    }]);
    unlinkSync(published);
    this.save(registrations.filter((entry) => entry.name !== name));
    return { changed: true, archived: true, retainedFiles: true };
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
      const protectedService = !registered;
      return {
        name,
        registered,
        protected: protectedService,
        identity,
        ...(registered && resolved
          ? (() => {
              const template = this.managedWorkerTemplate(name, resolved, registrations);
              return template ? { template } : {};
            })()
          : {}),
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

  logs(name: string): { lines: string[] } {
    valid(name);
    const registrations = this.registry();
    const current = this.target(name);
    if (this.identity(name, current, registrations) !== 'verified')
      throw new Error('Service identity not verified');
    const root = path.join(PREFIX, 'var', 'log', 'sv', name);
    const file = path.join(root, 'current');
    if (!existsSync(root)) return { lines: [] };
    if (!lstatSync(root).isDirectory() || lstatSync(root).isSymbolicLink())
      throw new Error('Unsafe log folder');
    if (!existsSync(file)) return { lines: [] };
    const stat = lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 4 * 1024 * 1024)
      throw new Error('Unsafe service log');
    const lines = readFileSync(file, 'utf8')
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
      const result = await run(
        path.join(PREFIX, 'bin', operation === 'enable' ? 'sv-enable' : 'sv-disable'),
        [name],
        { timeout: 20000, maxBuffer: 12000, env: { ...process.env, SVDIR: this.serviceRoot } },
      );
      return { changed: true, result };
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
    return { changed: true, result };
  }
}
