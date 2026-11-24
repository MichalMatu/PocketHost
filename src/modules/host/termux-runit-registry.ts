import { randomUUID } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { safeFile } from './termux-file-attestation.ts';
import { isReserved } from './termux-service-path.ts';
import { PREFIX, isStagedWorker, valid } from './termux-worker-scripts.ts';
import type { ArchivedWorker, Registration, WorkerTemplate } from './termux-service-models.ts';

export const MAX_MANAGED = 32;
export const MAX_TEMPLATE_WORKERS = 4;

export function readRunitRegistry(registerFile: string): Registration[] {
  const raw = safeFile(registerFile);
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

export function writeRunitRegistry(registerFile: string, registrations: Registration[]): void {
  if (registrations.length > MAX_MANAGED) throw new RangeError('Too many managed services');
  const folder = path.dirname(registerFile);
  mkdirSync(folder, { recursive: true, mode: 0o700 });
  if (lstatSync(folder).isSymbolicLink() || !lstatSync(folder).isDirectory())
    throw new Error('Unsafe runit registry parent');
  safeFile(registerFile); // refuse an existing symlink, directory or malformed filesystem object
  const temporary = path.join(folder, '.runit-registry-' + randomUUID());
  writeFileSync(temporary, JSON.stringify(registrations) + '\n', { flag: 'wx', mode: 0o600 });
  try {
    renameSync(temporary, registerFile);
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
export function readArchivedWorkers(archiveFile: string): ArchivedWorker[] {
  try {
    const file = lstatSync(archiveFile);
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
  const raw = safeFile(archiveFile);
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

export function writeArchivedWorkers(archiveFile: string, items: ArchivedWorker[]): void {
  if (items.length > MAX_TEMPLATE_WORKERS) throw new RangeError('Archive quota reached');
  const folder = path.dirname(archiveFile);
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
  readArchivedWorkers(archiveFile);
  const temporary = path.join(folder, '.archived-worker-' + randomUUID());
  writeFileSync(temporary, JSON.stringify(items) + '\n', { flag: 'wx', mode: 0o600 });
  try {
    renameSync(temporary, archiveFile);
  } finally {
    if (existsSync(temporary)) rmSync(temporary, { force: true });
  }
}
