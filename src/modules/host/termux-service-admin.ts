import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  realpathSync,
  renameSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { executeFixed, type Exec, type HostCommandResult } from './termux-admin.ts';

const PREFIX = '/data/data/com.termux/files/usr';
const SERVICE_NAME = /^[a-z][a-z0-9-]{1,63}$/;
const PROTECTED = new Set([
  'wreckscanner',
  'cloudflared',
  'sshd',
  'mosquitto',
  'ilestoi-healthwatch',
  'termux-agent',
]);
const MAX_ENTRIES = 100;
const MAX_MANAGED = 32;

interface Registration {
  name: string;
  target: string;
  addedAt: string;
}
export type ServiceOperation = 'register' | 'unregister' | 'start' | 'stop' | 'restart' | 'enable' | 'disable';
export interface TermuxService {
  name: string;
  registered: boolean;
  protected: boolean;
  state: 'running' | 'stopped' | 'unknown';
  enabled?: boolean | null;
}

function valid(name: string): void {
  if (typeof name !== 'string' || !SERVICE_NAME.test(name))
    throw new RangeError('Invalid runit service name');
}
function isProtected(name: string, resolved?: string): boolean {
  return PROTECTED.has(name) || (resolved !== undefined && PROTECTED.has(path.basename(resolved)));
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
        Object.keys(value).sort().join(',') !== 'addedAt,name,target' ||
        typeof value.name !== 'string' ||
        typeof value.target !== 'string' ||
        typeof value.addedAt !== 'string' ||
        !/^\d{4}-\d\d-\d\dT/.test(value.addedAt) ||
        isProtected(value.name, value.target) ||
        names.has(value.name)
      )
        throw new Error('Unsafe runit registration');
      valid(value.name);
      names.add(value.name);
      return { name: value.name, target: value.target, addedAt: value.addedAt };
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
    if (isProtected(name, resolved)) throw new Error('Protected service');
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
      const protectedService = isProtected(name, resolved);
      const registered =
        !protectedService &&
        registrations.some((item) => item.name === name && item.target === resolved);
      return {
        name,
        registered,
        protected: protectedService,
        state: probe(name),
        enabled: this.enabled(name),
      };
    });
  }

  private enabled(name: string): boolean | null {
    try {
      this.target(name);
      const marker = path.join(this.serviceRoot, name, 'down');
      if (!existsSync(marker)) return true;
      return lstatSync(marker).isSymbolicLink() ? null : false;
    } catch { return null; }
  }

  logs(name: string): { lines: string[] } {
    valid(name);
    const registrations = this.registry();
    const current = this.target(name);
    if (!registrations.some(entry => entry.name === name && entry.target === current))
      throw new Error('Service not registered');
    const root = path.join(PREFIX, 'var', 'log', 'sv', name);
    const file = path.join(root, 'current');
    if (!existsSync(root)) return { lines: [] };
    if (!lstatSync(root).isDirectory() || lstatSync(root).isSymbolicLink())
      throw new Error('Unsafe log folder');
    if (!existsSync(file)) return { lines: [] };
    const stat = lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 4 * 1024 * 1024)
      throw new Error('Unsafe service log');
    const lines = readFileSync(file, 'utf8').slice(-20000).split(/\r?\n/).slice(-100)
      .map(line => line.replace(/(password|secret|token|api[_-]?key)\s*[:=]\s*\S+/gi,
        '$1=[redacted]').split('').filter(char => { const code = char.charCodeAt(0); return code >= 32 && code !== 127; }).join('').slice(0, 240));
    return { lines };
  }

  async apply(
    operation: ServiceOperation,
    name: string,
    run: Exec = executeFixed,
  ): Promise<{ changed: boolean; result?: HostCommandResult }> {
    valid(name);
    if (!['register', 'unregister', 'start', 'stop', 'restart', 'enable', 'disable'].includes(operation))
      throw new RangeError('Unsupported runit action');
    if (isProtected(name)) throw new Error('Protected service');
    const registrations = this.registry();
    const existing = registrations.find((item) => item.name === name);
    if (operation === 'unregister') {
      if (!existing) throw new Error('Service not registered');
      this.save(registrations.filter((item) => item.name !== name));
      return { changed: true };
    }
    const target = this.target(name);
    if (operation === 'register') {
      if (existing) throw new Error('Already registered');
      this.save([...registrations, { name, target, addedAt: new Date().toISOString() }]);
      return { changed: true };
    }
    if (!existing || existing.target !== target)
      throw new Error('Service not explicitly registered or identity changed');
    if (operation === 'enable' || operation === 'disable') {
      const result = await run(
        path.join(PREFIX, 'bin', operation === 'enable' ? 'sv-enable' : 'sv-disable'),
        [name], { timeout: 20000, maxBuffer: 12000, env: { ...process.env, SVDIR: this.serviceRoot } },
      );
      return { changed: true, result };
    }
    const command = operation === 'start' ? 'up' : operation === 'stop' ? 'down' : 'restart';
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
