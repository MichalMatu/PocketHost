import { existsSync, lstatSync, readFileSync, realpathSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  MANAGED_PHOTOMAP_ID,
  type ManagedProjectPort,
  type ManagedProjectSnapshot,
} from '../../shared/managed-project.ts';

const RELEASE_PATTERN = /^[a-z0-9][a-z0-9-]{1,63}$/;
const MAX_MANIFEST_BYTES = 65536;
const MAX_INVENTORY_BYTES = 2097152;
const TOOL_NAMES = ['node', 'npm', 'git', 'python3', 'proot', 'proot-distro'] as const;

function sanitizedToolVersions(value: unknown): ManagedProjectSnapshot['tools'] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Managed PhotoMap tool inventory missing');
  }
  const record = value as Record<string, unknown>;
  return TOOL_NAMES.map((name) => {
    const item = record[name];
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new Error('Invalid managed tool record');
    }
    const entry = item as { available?: unknown; version?: unknown };
    if (typeof entry.available !== 'boolean') throw new Error('Invalid tool availability');
    const first = Array.isArray(entry.version) ? entry.version[0] : null;
    const version =
      entry.available &&
      typeof first === 'string' &&
      first.length <= 100 &&
      /\d/.test(first) &&
      /^[a-z0-9 ._+()-]+$/i.test(first)
        ? first
        : null;
    return {
      name,
      state: entry.available ? ('available' as const) : ('unavailable' as const),
      version,
    };
  });
}

function sanitizedLocks(value: unknown): ManagedProjectSnapshot['lockfiles'] {
  if (!Array.isArray(value) || value.length > 100) {
    throw new Error('Invalid managed PhotoMap lock inventory');
  }
  return value.map((entry: unknown) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new Error('Invalid lock entry');
    }
    const item = entry as { path?: unknown; sha256?: unknown };
    if (
      typeof item.path !== 'string' ||
      item.path.length > 180 ||
      !/^[a-z0-9._/-]+$/i.test(item.path) ||
      item.path.split('/').some((part) => part === '..' || part === '.' || part === '') ||
      typeof item.sha256 !== 'string' ||
      !/^[a-f0-9]{64}$/.test(item.sha256)
    ) {
      throw new Error('Unsafe managed lock entry');
    }
    return { path: item.path, sha256: item.sha256 };
  });
}

function plainDirectory(directory: string): void {
  const stat = lstatSync(directory);
  if (!stat.isDirectory() || stat.isSymbolicLink() || realpathSync(directory) !== directory) {
    throw new Error('Managed project directory is not canonical');
  }
}

function manifest(file: string, limit = MAX_MANIFEST_BYTES): Record<string, unknown> {
  const stat = lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > limit) {
    throw new Error('Unsafe managed project manifest');
  }
  const raw: unknown = JSON.parse(readFileSync(file, 'utf8'));
  if (!raw || Array.isArray(raw) || typeof raw !== 'object') {
    throw new Error('Invalid managed project manifest');
  }
  return raw as Record<string, unknown>;
}

function checkedOwner(value: Record<string, unknown>): void {
  if (
    value.schema_version !== 1 ||
    value.owner !== 'pockethost' ||
    value.instance_id !== MANAGED_PHOTOMAP_ID
  ) {
    throw new Error('Managed PhotoMap ownership mismatch');
  }
}

function nonnegativeInteger(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new Error('Invalid managed PhotoMap inventory');
  }
  return value;
}

/**
 * Reads the one explicitly imported Samsung instance. Never discovers or adopts
 * another project, follows a symlink, starts a process or changes dependencies.
 * Root injection is for isolated, temporary native test fixtures only.
 */
export class ManagedPhotoMapHost implements ManagedProjectPort {
  private readonly root: string;

  constructor(root = path.join(realpathSync(os.homedir()), 'Projects', 'PocketHost-Managed')) {
    this.root = root;
  }

  inspect(): ManagedProjectSnapshot {
    const absent: ManagedProjectSnapshot = {
      version: 1,
      id: MANAGED_PHOTOMAP_ID,
      label: 'PhotoMap TEST',
      ownership: 'none',
      importState: 'absent',
      runtimeState: 'disabled',
      release: null,
      port: 8010,
      tools: [],
      lockfiles: [],
      data: null,
      dependencies: null,
      capabilities: { startStop: false, packages: false, rollback: false },
    };
    if (!existsSync(this.root) && !lstatLink(this.root)) return absent;
    plainDirectory(this.root);

    const instanceDir = path.join(this.root, 'instances', MANAGED_PHOTOMAP_ID);
    const registryFile = path.join(this.root, 'registry', MANAGED_PHOTOMAP_ID + '.json');
    const instancesDir = path.join(this.root, 'instances');
    const registryDir = path.join(this.root, 'registry');
    for (const directory of [registryDir, instancesDir, instanceDir]) plainDirectory(directory);
    const metaDir = path.join(instanceDir, 'manifests');
    plainDirectory(metaDir);

    const registry = manifest(registryFile);
    const instance = manifest(path.join(metaDir, 'instance.json'));
    const runtime = manifest(path.join(metaDir, 'runtime.json'));
    const packages = manifest(path.join(metaDir, 'packages.json'));
    const current = manifest(path.join(instanceDir, 'current.json'));
    const entries = [registry, instance, runtime, packages, current];
    for (const entry of entries) checkedOwner(entry);
    const release = current.selected_release;
    if (
      typeof release !== 'string' ||
      !RELEASE_PATTERN.test(release) ||
      instance.release_id !== release ||
      packages.release_id !== release ||
      registry.managed_version !== release ||
      registry.instance_path !== 'instances/photomap-test' ||
      registry.runtime_enabled !== false ||
      registry.status !== 'imported-stopped' ||
      runtime.enabled !== false ||
      runtime.autostart !== false ||
      runtime.launch_allowed !== false ||
      runtime.port !== 8010 ||
      runtime.runtime_kind !== 'debian-proot' ||
      runtime.managed_proot_snapshot !== false ||
      current.active_process !== null ||
      current.status !== 'stopped' ||
      packages.allow_package_update !== false ||
      packages.allow_package_rollback !== false ||
      packages.proot_python_environment !== 'external-unfrozen'
    ) {
      throw new Error('Managed PhotoMap import is not in a safe stopped state');
    }

    const releases = path.join(instanceDir, 'releases');
    plainDirectory(releases);
    plainDirectory(path.join(releases, release));
    plainDirectory(path.join(releases, release, 'source'));
    const sourceManifest = manifest(path.join(releases, release, 'source-manifest.json'));
    checkedOwner(sourceManifest);
    if (sourceManifest.release_id !== release) throw new Error('Source release mismatch');

    const snapshots = path.join(instanceDir, 'snapshots');
    plainDirectory(snapshots);
    plainDirectory(path.join(snapshots, release));
    const inventory = manifest(
      path.join(snapshots, release, 'data-manifest.json'),
      MAX_INVENTORY_BYTES,
    );
    checkedOwner(inventory);
    if (inventory.release_id !== release) throw new Error('Data release mismatch');
    const database = inventory.database as Record<string, unknown> | null;
    const media = inventory.media as Record<string, unknown> | null;
    const privateMedia = media?.private as Record<string, unknown> | undefined;
    const publicMedia = media?.public as Record<string, unknown> | undefined;
    if (!database || !privateMedia || !publicMedia) {
      throw new Error('Managed PhotoMap data inventory missing');
    }

    return {
      ...absent,
      ownership: 'pockethost',
      importState: 'verified-copy',
      runtimeState: 'disabled',
      release,
      tools: sanitizedToolVersions(packages.termux_tool_versions),
      lockfiles: sanitizedLocks(packages.lockfiles),
      data: {
        databaseBytes: nonnegativeInteger(database.bytes),
        privateMediaFiles: nonnegativeInteger(privateMedia.files),
        publicMediaFiles: nonnegativeInteger(publicMedia.files),
      },
      dependencies: { prootEnvironment: 'external-unfrozen', isolatedRollback: false },
    };
  }
}

function lstatLink(file: string): boolean {
  try {
    return lstatSync(file).isSymbolicLink();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw error;
  }
}
