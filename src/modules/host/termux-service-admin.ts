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

interface Registration {
  name: string;
  target: string;
  addedAt: string;
  /** Missing only for pre-S1 legacy entries: these are read-only. */
  runSha256?: string;
}
type ServiceIdentity = 'verified' | 'unregistered' | 'legacy' | 'changed' | 'reserved';
export type ServiceOperation =
  'register' | 'unregister' | 'start' | 'stop' | 'restart' | 'once' | 'enable' | 'disable';
export interface TermuxService {
  name: string;
  registered: boolean;
  protected: boolean;
  identity: ServiceIdentity;
  /** Only the fully attested built-in template grants archive capability. */
  template?: 'heartbeat-worker-v1';
  state: 'running' | 'stopped' | 'unknown';
  enabled?: boolean | null;
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
  createManagedWorker(name: string): { changed: boolean; name: string; template: 'heartbeat-worker-v1' } {
    valid(name);
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
    // Quota includes previously released definitions, so repeated
    // create/release cannot fill the Termux filesystem from the LAN.
    const templateCount = readdirSync(sourceRoot).filter((unit) => {
      if (!SERVICE_NAME.test(unit)) return false;
      const marker = path.join(sourceRoot, unit, '.pockethost-service.json');
      try {
        const raw = safeFile(marker);
        if (!raw) return false;
        const data: unknown = JSON.parse(raw);
        return !!data && typeof data === 'object' &&
          (data as { template?: string }).template === 'heartbeat-worker-v1';
      } catch {
        throw new Error('Managed worker inventory unverified');
      }
    }).length;
    if (templateCount >= MAX_TEMPLATE_WORKERS) throw new RangeError('Managed worker quota reached');
    const published = path.join(this.serviceRoot, name);
    const target = path.join(sourceRoot, name);
    const logTarget = path.join(logRoot, name);
    // Never overwrite, adopt, replace or repair existing directories.
    // A failed preparation leaves at most an isolated (unpublished) unit.
    for (const location of [published, target, logTarget]) {
      try {
        lstatSync(location);
        throw new Error('Service name or log directory already exists');
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      }
    }
    const sh = path.join(PREFIX, 'bin', 'sh');
    const node = path.join(PREFIX, 'bin', 'node');
    const svlogd = path.join(PREFIX, 'bin', 'svlogd');
    for (const binary of [sh, node, svlogd]) {
      const st = statSync(binary);
      if (!st.isFile() || (st.mode & 0o111) === 0) throw new Error('Termux runtime unavailable');
    }
    const runScript = '#!' + sh + '\n' +
      'exec ' + node + ' -e ' +
      "'console.log(\"PocketHost worker started\"); setInterval(() => console.log(\"PocketHost worker heartbeat\"), 60000)'\n";
    const logScript = '#!' + sh + '\nexec ' + svlogd + ' -tt ' + logTarget + '\n';
    const digest = createHash('sha256').update(runScript).digest('hex');
    mkdirSync(target, { mode: 0o700 });
    // Always materialize the runit down marker before the runnable script.
    writeFileSync(path.join(target, 'down'), '', { flag: 'wx', mode: 0o600 });
    mkdirSync(path.join(target, 'log'), { mode: 0o700 });
    mkdirSync(logTarget, { mode: 0o700 });
    writeFileSync(path.join(target, 'log', 'run'), logScript, { flag: 'wx', mode: 0o700 });
    writeFileSync(path.join(target, 'run'), runScript, { flag: 'wx', mode: 0o700 });
    writeFileSync(path.join(target, '.pockethost-service.json'), JSON.stringify({
      schema: 1, owner: 'pockethost', name, template: 'heartbeat-worker-v1',
      runSha256: digest, instanceId: randomUUID(),
    }) + '\n', { flag: 'wx', mode: 0o600 });
    symlinkSync(target, published);
    this.registerProvisioned(name, { target, runSha256: digest });
    return { changed: true, name, template: 'heartbeat-worker-v1' };
  }


  /**
   * A service can be archived only if it was created by the built-in
   * standalone provisioner. An enrolled Node project, name prefix, or
   * readable foreign marker never grants archive authority.
   */
  private isManagedWorker(
    name: string,
    target: string,
    registrations: Registration[],
  ): boolean {
    if (this.identity(name, target, registrations) !== 'verified') return false;
    const sourceRoot = path.join(PREFIX, 'var', 'sv');
    if (target !== path.join(sourceRoot, name)) return false;
    try {
      const published = lstatSync(path.join(this.serviceRoot, name));
      const directory = lstatSync(target);
      if (!published.isSymbolicLink() ||
          readlinkSync(path.join(this.serviceRoot, name)) !== target ||
          !directory.isDirectory() || directory.isSymbolicLink() ||
          directory.uid !== process.getuid?.() || (directory.mode & 0o022) !== 0) {
        return false;
      }
      const markerFile = path.join(target, '.pockethost-service.json');
      const markerStat = lstatSync(markerFile);
      if (!markerStat.isFile() || markerStat.isSymbolicLink() ||
          markerStat.nlink !== 1 || markerStat.uid !== process.getuid?.() ||
          (markerStat.mode & 0o077) !== 0) return false;
      const raw = safeFile(markerFile);
      if (!raw) return false;
      const marker: unknown = JSON.parse(raw);
      if (!marker || typeof marker !== 'object' || Array.isArray(marker)) return false;
      const proof = marker as Record<string, unknown>;
      const record = registrations.find((entry) => entry.name === name);
      return Object.keys(proof).sort().join(',') ===
          'instanceId,name,owner,runSha256,schema,template' &&
        proof.schema === 1 && proof.owner === 'pockethost' &&
        proof.name === name && proof.template === 'heartbeat-worker-v1' &&
        typeof proof.instanceId === 'string' &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(proof.instanceId) &&
        proof.runSha256 === record?.runSha256 &&
        this.runSha256(target) === proof.runSha256;
    } catch {
      return false;
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
    if (!this.isManagedWorker(name, target, registrations)) {
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
        !this.isManagedWorker(name, target, this.registry())) {
      throw new Error('Worker identity or stopped state changed during retirement');
    }
    // Remove only the exact symlink, never the directory it points to.
    if (!lstatSync(published).isSymbolicLink() || readlinkSync(published) !== target) {
      throw new Error('Published worker symlink identity changed');
    }
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
        ...(registered && resolved && this.isManagedWorker(name, resolved, registrations)
          ? { template: 'heartbeat-worker-v1' as const } : {}),
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
