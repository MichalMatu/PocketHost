import { createHash } from 'node:crypto';
import { existsSync, lstatSync, readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { OWNED_PHOTOMAP_ID, OWNED_PHOTOMAP_PORT } from '../../shared/photomap-runtime.ts';
import { directory, json } from './managed-runtime-files.ts';
import { buildManagedProotArgs } from './managed-proot-plan.ts';

export const RELEASE = 'import-20261106';
const MAX_MANIFEST = 65536;
const VERSION = /^[a-z0-9][a-z0-9-]{1,63}$/;
const GUEST_PYTHON = '/opt/photomap-venv/bin/python';
type RecordData = Record<string, unknown>;

export interface LaunchPlan {
  version: string;
  versionRoot: string;
  executable: string;
  args: string[];
  source: string;
}

function owner(item: RecordData): void {
  if (
    item.schema_version !== 1 ||
    item.owner !== 'pockethost' ||
    item.instance_id !== OWNED_PHOTOMAP_ID
  ) {
    throw new Error('PhotoMap runtime ownership mismatch');
  }
}

function metadata(root: string, instance: string): { runtime: RecordData; current: RecordData } {
  directory(root);
  directory(path.join(root, 'instances'));
  directory(instance);
  directory(path.join(instance, 'manifests'));
  const runtime = json(path.join(instance, 'manifests', 'runtime.json'));
  const current = json(path.join(instance, 'current.json'));
  owner(runtime);
  owner(current);
  if (
    current.selected_release !== RELEASE ||
    runtime.runtime_kind !== 'debian-proot' ||
    runtime.port !== OWNED_PHOTOMAP_PORT ||
    runtime.autostart !== false
  ) {
    throw new Error('Managed PhotoMap release or runtime changed');
  }
  return { runtime, current };
}

export function loadPhotoMapPlan(root: string, instance: string): LaunchPlan | null {
  const { runtime } = metadata(root, instance);
  if (
    runtime.enabled !== true ||
    runtime.launch_allowed !== true ||
    runtime.managed_proot_snapshot !== true
  ) {
    return null;
  }
  directory(path.join(instance, 'runtime'));
  const active = json(path.join(instance, 'runtime', 'active-version.json'));
  owner(active);
  const version = active.selected_runtime;
  if (typeof version !== 'string' || !VERSION.test(version)) {
    throw new Error('Unsafe runtime version');
  }
  const base = path.join(instance, 'runtime', 'versions');
  directory(base);
  const versionRoot = path.join(base, version);
  directory(versionRoot);
  const profile = json(path.join(versionRoot, 'profile.json'));
  owner(profile);
  if (
    profile.source_release !== RELEASE ||
    profile.runtime_version !== version ||
    profile.isolated_rootfs !== true ||
    profile.status !== 'approved-manual' ||
    profile.launch_allowed !== true ||
    profile.activation_approved !== true ||
    profile.python_executable !== GUEST_PYTHON ||
    profile.autostart !== false ||
    profile.port !== OWNED_PHOTOMAP_PORT ||
    typeof profile.requirements_sha256 !== 'string' ||
    !/^[a-f0-9]{64}$/.test(profile.requirements_sha256)
  ) {
    throw new Error('Unsafe runtime version profile');
  }
  const preservedSource = path.join(instance, 'releases', RELEASE, 'source');
  directory(path.join(instance, 'releases'));
  directory(path.join(instance, 'releases', RELEASE));
  directory(preservedSource);
  if (lstatSync(path.join(preservedSource, '.env'), { throwIfNoEntry: false })) {
    throw new Error('Preserved PhotoMap source contains an unapproved environment file');
  }
  const rootfs = path.join(versionRoot, 'rootfs');
  const work = path.join(versionRoot, 'work');
  const source = path.join(work, 'source');
  for (const folder of [
    rootfs,
    work,
    source,
    path.join(work, 'database'),
    path.join(work, 'storage'),
    path.join(work, 'storage', 'private'),
    path.join(work, 'storage', 'public'),
  ]) {
    directory(folder);
  }
  // Guest code may only write to the disposable work-source copy, never to the sealed import.
  for (const relative of ['server.py', 'backend/requirements.txt', 'frontend/dist/index.html']) {
    if (
      digestFile(path.join(preservedSource, relative)) !== digestFile(path.join(source, relative))
    ) {
      throw new Error('PhotoMap work-source copy does not match the preserved release');
    }
  }
  if (
    digestFile(path.join(source, 'backend', 'requirements.txt')) !==
      profile.requirements_sha256 ||
    lstatSync(path.join(source, '.env'), { throwIfNoEntry: false }) ||
    !existsSync(path.join(work, 'database', 'app.db'))
  ) {
    throw new Error('PhotoMap work dependencies, database or environment invalid');
  }
  const prefix = process.env.PREFIX ?? '';
  if (
    prefix !== '/data/data/com.termux/files/usr' &&
    prefix !== '/data/user/0/com.termux/files/usr'
  ) {
    throw new Error('This runtime requires an exact Termux installation');
  }
  const executable = realpathSync(path.join(prefix, 'bin', 'proot'));
  const args = buildManagedProotArgs({
    rootfs,
    binds: [
      { source, target: '/mnt/source' },
      { source: path.join(work, 'database'), target: '/mnt/data' },
      { source: path.join(work, 'storage'), target: '/mnt/storage' },
    ],
    workdir: '/mnt/source',
    command: [
      GUEST_PYTHON,
      '-m',
      'uvicorn',
      'server:create_app',
      '--factory',
      '--host',
      '127.0.0.1',
      '--port',
      String(OWNED_PHOTOMAP_PORT),
      '--lifespan',
      'off',
      '--no-server-header',
    ],
  });
  return { version, versionRoot, executable, args, source };
}

function digestFile(file: string): string {
  const stat = lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > MAX_MANIFEST) {
    throw new Error('Unsafe requirements file');
  }
  return createHash('sha256').update(readFileSync(file)).digest('hex');
}
