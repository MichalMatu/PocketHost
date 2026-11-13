import { createHash, randomUUID } from 'node:crypto';
import {
  closeSync,
  constants,
  existsSync,
  fstatSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  planNodeDependencies,
  type NodeDependencyPlan,
} from '../../shared/node-dependency-plan.ts';

const PROJECT = /^node-[a-f0-9]{32}$/;
const RELEASE = /^r-[a-f0-9]{32}$/;
const MAX_PROJECTS = 8;
const MAX_RELEASES = 12;
const MAX_INPUT = 1100 * 1024;
const MARKER = '.pockethost-node.json';
const RELEASE_PROOF = '.pockethost-node-source.json';
const EXTRA_MANIFEST = '.pockethost-node-extra-files.json';
const ASSET_MANIFEST = '.pockethost-node-asset-files.json';
const MAX_ASSET_FILES = 12;
const MAX_ASSET_BYTES = 128 * 1024;
const MAX_ASSET_TOTAL = 512 * 1024;
const MAX_EXTRA_FILES = 32;
const MAX_EXTRA_TOTAL = 96 * 1024;
/** Text-only source allowlist. No dotfiles, absolute paths or executable hooks. */
export function validNodeExtraPath(name: string): boolean {
  return name.length <= 160 && (
    /^(?:src|public)\/(?:[A-Za-z0-9_-]+\/){0,6}[A-Za-z0-9_-][A-Za-z0-9._-]{0,79}\.(?:js|jsx|ts|tsx|css|html|json|svg|txt|md)$/.test(name) ||
    /^(?:index\.html|vite\.config\.(?:js|mjs|ts)|tsconfig(?:\.[a-z0-9_-]+)?\.json|postcss\.config\.(?:js|cjs)|tailwind\.config\.(?:js|ts))$/.test(name)
  );
}
function cleanExtras(input: unknown): Record<string, string> {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new RangeError('Invalid extra Node source files');
  const source = input as Record<string, unknown>;
  const names = Object.keys(source).sort();
  if (names.length > MAX_EXTRA_FILES) throw new RangeError('Extra Node file count exceeds limit');
  const result: Record<string, string> = {};
  let total = 0;
  for (const name of names) {
    const value = source[name];
    if (!validNodeExtraPath(name) ||
        typeof value !== 'string' || !value.trim() || value.includes('\0') ||
        Buffer.byteLength(value) > 32 * 1024)
      throw new RangeError('Unsafe extra Node source path or content');
    total += Buffer.byteLength(name) + Buffer.byteLength(value);
    if (total > MAX_EXTRA_TOTAL) throw new RangeError('Extra Node source exceeds 96 KB');
    result[name] = value;
  }
  return result;
}

/** Strict binary-only asset allowlist; never permits nested project hooks or dotfiles. */
export function validNodeAssetPath(name: string): boolean {
  return name.length <= 160 &&
    /^(?:public|src\/assets)\/(?:[A-Za-z0-9_-]+\/){0,5}[A-Za-z0-9_-][A-Za-z0-9._-]{0,79}\.(?:png|jpg|jpeg|webp|gif|ico|woff2)$/.test(name);
}
export function decodeNodeAsset(name: string, encoded: unknown): Buffer {
  if (!validNodeAssetPath(name) || typeof encoded !== 'string' ||
      encoded.length < 8 || encoded.length > Math.ceil(MAX_ASSET_BYTES / 3) * 4 + 4 ||
      !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded))
    throw new RangeError('Unsafe Node binary asset path or encoding');
  const bytes = Buffer.from(encoded, 'base64');
  if (bytes.length < 12 || bytes.length > MAX_ASSET_BYTES ||
      bytes.toString('base64') !== encoded)
    throw new RangeError('Invalid or oversized Node binary asset');
  const ext = name.split('.').at(-1);
  const matching = ext === 'png' ? bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')) :
    ext === 'jpg' || ext === 'jpeg' ? bytes.subarray(0, 3).equals(Buffer.from('ffd8ff', 'hex')) :
    ext === 'webp' ? bytes.toString('ascii', 0, 4) === 'RIFF' &&
      bytes.toString('ascii', 8, 12) === 'WEBP' :
    ext === 'gif' ? ['GIF87a', 'GIF89a'].includes(bytes.toString('ascii', 0, 6)) :
    ext === 'ico' ? bytes.subarray(0, 4).equals(Buffer.from('00000100', 'hex')) :
    ext === 'woff2' ? bytes.toString('ascii', 0, 4) === 'wOF2' : false;
  if (!matching) throw new RangeError('Node binary asset format mismatch');
  return bytes;
}
function cleanAssets(input: unknown): Record<string, string> {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new RangeError('Invalid Node binary asset manifest');
  const names = Object.keys(input).sort();
  if (names.length > MAX_ASSET_FILES) throw new RangeError('Node asset file budget exceeded');
  const normalized: Record<string, string> = {};
  let bytes = 0;
  for (const name of names) {
    const content = decodeNodeAsset(name, (input as Record<string, unknown>)[name]);
    bytes += content.length;
    if (bytes > MAX_ASSET_TOTAL) throw new RangeError('Node binary assets exceed 512 KB');
    normalized[name] = content.toString('base64');
  }
  return normalized;
}
function privateBytes(filename: string): Buffer {
  const stat = lstatSync(filename);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 ||
      stat.uid !== process.getuid?.() || (stat.mode & 0o077) !== 0 ||
      stat.size < 12 || stat.size > MAX_ASSET_BYTES)
    throw new Error('Unsafe private Node binary asset file');
  const fd = openSync(filename, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const live = fstatSync(fd);
    if (live.ino !== stat.ino || live.dev !== stat.dev || live.size !== stat.size ||
        live.nlink !== 1 || !live.isFile())
      throw new Error('Node binary asset changed during read');
    const bytes = readFileSync(fd);
    if (bytes.length !== live.size || fstatSync(fd).mtimeMs !== live.mtimeMs)
      throw new Error('Node binary asset changed during read');
    return bytes;
  } finally { closeSync(fd); }
}

function digest(contents: string): string {
  return createHash('sha256').update(contents).digest('hex');
}

interface NodeProjectRecord {
  schema: 1;
  owner: 'pockethost-node';
  id: string;
  name: string;
  createdAt: string;
  candidateRelease: string | null;
  previousCandidate: string | null;
  history: { at: string; action: 'stage' | 'restore-candidate'; from: string | null; to: string }[];
}
export interface NodeProjectSummary {
  id: string;
  name: string;
  kind: 'node';
  state: 'created' | 'source-staged';
  runtime: 'not-provisioned';
  activeRelease: null;
  candidateRelease: string | null;
  previousCandidate: string | null;
  deploymentCount: number;
  createdAt: string;
}
export interface NodeSourceInput {
  packageJson: unknown;
  packageLock: unknown;
  serverSource: string;
  extraFiles?: Record<string, string>;
  assetFiles?: Record<string, string>;
}
export interface NodeCandidateRelease {
  id: string;
  active: false;
  candidate: boolean;
  previousCandidate: boolean;
  dependencyPlan: NodeDependencyPlan;
  sourceIntegrity: 'verified' | 'legacy-needs-restaging';
}

function ownedDirectory(location: string): void {
  if (!path.isAbsolute(location)) throw new Error('Owned node root must be absolute');
  const s = lstatSync(location);
  if (
    !s.isDirectory() ||
    s.isSymbolicLink() ||
    realpathSync(location) !== location ||
    s.uid !== process.getuid?.() ||
    (s.mode & 0o077) !== 0
  ) {
    throw new Error('Unsafe private Node project directory');
  }
}
function privateFile(filename: string, maximum = MAX_INPUT): string {
  const s = lstatSync(filename);
  if (
    !s.isFile() ||
    s.isSymbolicLink() ||
    s.nlink !== 1 ||
    s.uid !== process.getuid?.() ||
    (s.mode & 0o077) !== 0 ||
    s.size > maximum
  ) {
    throw new Error('Unsafe private Node project file');
  }
  const fd = openSync(filename, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const live = fstatSync(fd);
    if (
      !live.isFile() ||
      live.nlink !== 1 ||
      live.uid !== s.uid ||
      live.ino !== s.ino ||
      live.size > maximum
    )
      throw new Error('Unsafe Node file identity');
    return readFileSync(fd, 'utf8');
  } finally {
    closeSync(fd);
  }
}
function identifier(): string {
  return randomUUID().replaceAll('-', '');
}
function writeAtomic(folder: string, filename: string, value: string): void {
  ownedDirectory(folder);
  if (existsSync(path.join(folder, filename))) privateFile(path.join(folder, filename));
  const staging = path.join(folder, '.' + identifier() + '.tmp');
  const fd = openSync(staging, 'wx', 0o600);
  try {
    writeFileSync(fd, value);
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
  try {
    renameSync(staging, path.join(folder, filename));
  } finally {
    if (existsSync(staging)) rmSync(staging);
  }
}
function safeName(name: unknown): string {
  if (typeof name !== 'string' || !/^[\p{L}\p{N}][\p{L}\p{N} ._-]{1,59}$/u.test(name.trim())) {
    throw new RangeError('Invalid Node project name');
  }
  return name.trim();
}
function cleanSource(input: unknown): {
  manifest: string;
  lock: string;
  source: string;
  plan: NodeDependencyPlan;
  extraFiles: Record<string, string>;
  assetFiles: Record<string, string>;
} {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new RangeError('Invalid Node source envelope');
  const keys = Object.keys(input);
  if (keys.length < 3 || keys.length > 5 ||
      !['packageJson', 'packageLock', 'serverSource'].every(k => Object.hasOwn(input, k)) ||
      keys.some(k => !['packageJson', 'packageLock', 'serverSource', 'extraFiles', 'assetFiles'].includes(k)))
    throw new RangeError('Invalid Node source envelope');
  const source = input as NodeSourceInput;
  const extraFiles = source.extraFiles === undefined ? {} : cleanExtras(source.extraFiles);
  const assetFiles = source.assetFiles === undefined ? {} : cleanAssets(source.assetFiles);
  if (
    typeof source.serverSource !== 'string' ||
    !source.serverSource.trim() ||
    source.serverSource.includes('\0') ||
    Buffer.byteLength(source.serverSource) > 64 * 1024
  ) {
    throw new RangeError('Invalid or oversized Node entry source');
  }
  const manifest = JSON.stringify(source.packageJson);
  const lock = JSON.stringify(source.packageLock);
  if (
    typeof manifest !== 'string' ||
    typeof lock !== 'string' ||
    Buffer.byteLength(manifest) + Buffer.byteLength(lock) + Buffer.byteLength(source.serverSource) +
      Buffer.byteLength(JSON.stringify(extraFiles)) +
      Buffer.byteLength(JSON.stringify(assetFiles)) > MAX_INPUT
  ) {
    throw new RangeError('Node project payload exceeds limit');
  }
  const plan = planNodeDependencies(source.packageJson, source.packageLock);
  const pkg = source.packageJson as { scripts?: { start?: unknown } };
  // First vertical slice accepts only one known entrypoint; no caller-supplied
  // paths, postinstall or arbitrary start command are executed by this store.
  if (pkg.scripts?.start !== 'node server.mjs') {
    throw new RangeError('Node starter must use node server.mjs');
  }
  return { manifest, lock, source: source.serverSource, plan, extraFiles, assetFiles };
}

/** An immutable source release cannot silently gain new modules/config files.
 * Dependency packages and built dist have their own independent attestations.
 */
function verifySourceLayout(folder: string, extras: Readonly<Record<string, string>>,
  assets: Readonly<Record<string, string>>): void {
  const expected = new Map<string, Set<string>>();
  const at = (location: string, entry: string) => {
    if (!expected.has(location)) expected.set(location, new Set());
    expected.get(location)!.add(entry);
  };
  for (const name of [
    'package.json', 'package-lock.json', 'server.mjs', RELEASE_PROOF,
    ...(Object.keys(extras).length || Object.keys(assets).length ? [EXTRA_MANIFEST] : []),
    ...(Object.keys(assets).length ? [ASSET_MANIFEST] : []),
  ]) at('', name);
  for (const name of [...Object.keys(extras), ...Object.keys(assets)]) {
    const parts = name.split('/');
    for (let i = 0; i < parts.length; i++) {
      at(parts.slice(0, i).join('/'), parts[i]!);
    }
  }
  for (const [relative, entries] of expected) {
    const target = relative ? path.join(folder, relative) : folder;
    const actual = readdirSync(target);
    // npm and a verified build may publish their own reserved directories,
    // but only at the release root and never inside user source folders.
    const allowed = relative === '' ?
      new Set([...entries, 'node_modules', 'dist']) : entries;
    if (actual.some(name => !allowed.has(name)))
      throw new Error('Unexpected file in attested Node source release');
    if (relative === '') {
      for (const name of ['node_modules', 'dist']) {
        const candidate = path.join(folder, name);
        if (!existsSync(candidate)) continue;
        const stat = lstatSync(candidate);
        if (stat.isSymbolicLink() || !stat.isDirectory() || stat.uid !== process.getuid?.())
          throw new Error('Unsafe Node release dependency or build directory');
      }
    }
  }
}

function validateMarker(raw: string, id: string): NodeProjectRecord {
  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Invalid Node marker');
  const v = value as Record<string, unknown>;
  if (
    Object.keys(v).sort().join(',') !==
      'candidateRelease,createdAt,history,id,name,owner,previousCandidate,schema' ||
    v.schema !== 1 ||
    v.owner !== 'pockethost-node' ||
    v.id !== id ||
    typeof v.createdAt !== 'string' ||
    !Number.isFinite(Date.parse(v.createdAt)) ||
    typeof v.name !== 'string' ||
    safeName(v.name) !== v.name ||
    (v.candidateRelease !== null &&
      (typeof v.candidateRelease !== 'string' || !RELEASE.test(v.candidateRelease))) ||
    (v.previousCandidate !== null &&
      (typeof v.previousCandidate !== 'string' || !RELEASE.test(v.previousCandidate))) ||
    !Array.isArray(v.history) ||
    v.history.length > 30
  ) {
    throw new Error('Unsafe Node project identity');
  }
  for (const h of v.history as unknown[]) {
    if (!h || typeof h !== 'object' || Array.isArray(h))
      throw new Error('Invalid Node release history');
    const e = h as Record<string, unknown>;
    if (
      Object.keys(e).sort().join(',') !== 'action,at,from,to' ||
      !['stage', 'restore-candidate'].includes(e.action as string) ||
      typeof e.at !== 'string' ||
      !Number.isFinite(Date.parse(e.at)) ||
      (e.from !== null && (typeof e.from !== 'string' || !RELEASE.test(e.from))) ||
      typeof e.to !== 'string' ||
      !RELEASE.test(e.to)
    ) {
      throw new Error('Invalid Node release history');
    }
  }
  return v as unknown as NodeProjectRecord;
}

/**
 * M3 pre-execution source store. A release is a CANDIDATE, not a live
 * deployment; this class never installs npm packages, binds ports,
 * starts daemons or signals any process. The later runit adapter must
 * separately verify provenance, source and effective ownership.
 */
export class NodeProjectHost {
  private readonly root: string;
  constructor(root = path.join(os.homedir(), 'PocketHost-NodeProjects')) {
    this.root = root;
  }

  /** Same exclusive project root lock as runit lifecycle and scoped Restic. */
  private mutation<T>(action: () => T): T {
    ownedDirectory(this.root);
    const lock = path.join(this.root, '.node-ports.lock');
    const fd = openSync(lock, 'wx', 0o600);
    closeSync(fd);
    try {
      return action();
    } finally {
      rmSync(lock);
    }
  }

  private projectPath(id: string): string {
    if (!PROJECT.test(id)) throw new RangeError('Invalid Node project ID');
    const folder = path.join(this.root, id);
    ownedDirectory(this.root);
    ownedDirectory(folder);
    ownedDirectory(path.join(folder, 'releases'));
    return folder;
  }
  private record(id: string): NodeProjectRecord {
    const folder = this.projectPath(id);
    const record = validateMarker(privateFile(path.join(folder, MARKER), 64 * 1024), id);
    for (const release of [record.candidateRelease, record.previousCandidate]) {
      if (release) ownedDirectory(path.join(folder, 'releases', release));
    }
    return record;
  }
  private summary(record: NodeProjectRecord): NodeProjectSummary {
    return {
      id: record.id,
      name: record.name,
      kind: 'node',
      state: record.candidateRelease ? 'source-staged' : 'created',
      runtime: 'not-provisioned',
      activeRelease: null,
      candidateRelease: record.candidateRelease,
      previousCandidate: record.previousCandidate,
      deploymentCount: record.history.length,
      createdAt: record.createdAt,
    };
  }
  list(): NodeProjectSummary[] {
    if (!existsSync(this.root)) return [];
    ownedDirectory(this.root);
    const ids = readdirSync(this.root).filter((name) => PROJECT.test(name));
    if (ids.length > MAX_PROJECTS) throw new Error('Node project budget exceeded');
    return ids.sort().map((id) => this.summary(this.record(id)));
  }
  inspect(id: string): NodeProjectSummary {
    return this.summary(this.record(id));
  }
  create(name: unknown): NodeProjectSummary {
    const title = safeName(name);
    if (!existsSync(this.root)) mkdirSync(this.root, { mode: 0o700 });
    ownedDirectory(this.root);
    return this.mutation(() => {
      if (this.list().length >= MAX_PROJECTS) throw new RangeError('Node project limit reached');
      const id = 'node-' + identifier();
      const folder = path.join(this.root, id);
      mkdirSync(folder, { mode: 0o700 });
      mkdirSync(path.join(folder, 'releases'), { mode: 0o700 });
      const marker: NodeProjectRecord = {
        schema: 1,
        owner: 'pockethost-node',
        id,
        name: title,
        createdAt: new Date().toISOString(),
        candidateRelease: null,
        previousCandidate: null,
        history: [],
      };
      writeAtomic(folder, MARKER, JSON.stringify(marker) + '\n');
      return this.summary(marker);
    });
  }
  stage(
    id: string,
    input: unknown,
    expectedCandidate?: string | null,
    expectedRevision?: number,
  ): {
    project: NodeProjectSummary;
    plan: NodeDependencyPlan;
    unchanged: boolean;
  } {
    if (expectedCandidate !== undefined && expectedCandidate !== null &&
        !RELEASE.test(expectedCandidate))
      throw new RangeError('Invalid expected Node candidate');
    if (expectedRevision !== undefined &&
        (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0 || expectedRevision > 30))
      throw new RangeError('Invalid expected Node revision');
    const source = cleanSource(input);
    return this.mutation(() => {
      const marker = this.record(id);
      // Check both identity and monotonic history under the exclusive lock.
      // The history revision prevents A -> B -> A from bypassing conflict checks.
      if ((expectedCandidate !== undefined && marker.candidateRelease !== expectedCandidate) ||
          (expectedRevision !== undefined && marker.history.length !== expectedRevision))
        throw new Error('Node candidate changed; reload before staging');
      const releases = path.join(this.projectPath(id), 'releases');
      if (marker.candidateRelease) {
        // Retry-safe under the same project mutation lock. Never trust only
        // filenames or a candidate ID: re-attest the stored source digests.
        const proof = path.join(releases, marker.candidateRelease, RELEASE_PROOF);
        let proven = true;
        try {
          lstatSync(proof);
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
          proven = false; // Historic unproven source must be re-staged.
        }
        if (proven) {
          const current = this.release(id, marker.candidateRelease);
          if (
            current.source.manifest === source.manifest &&
            current.source.lock === source.lock &&
            current.source.server === source.source &&
            JSON.stringify(current.source.extraFiles ?? {}) === JSON.stringify(source.extraFiles) &&
            JSON.stringify(current.source.assetFiles ?? {}) === JSON.stringify(source.assetFiles)
          ) {
            return { project: this.summary(marker), plan: source.plan, unchanged: true };
          }
        }
      }
      if (
        readdirSync(releases).filter((name) => RELEASE.test(name)).length >= MAX_RELEASES ||
        marker.history.length >= 30
      )
        throw new RangeError('Node release budget reached');
      const release = 'r-' + identifier();
      const stage = path.join(releases, '.stage-' + identifier());
      mkdirSync(stage, { mode: 0o700 });
      try {
        for (const [name, content] of [
          ['package.json', source.manifest],
          ['package-lock.json', source.lock],
          ['server.mjs', source.source],
        ] as const) {
          writeFileSync(path.join(stage, name), content, { flag: 'wx', mode: 0o600 });
        }
        const extraNames = Object.keys(source.extraFiles);
        const assetNames = Object.keys(source.assetFiles);
        if (extraNames.length || assetNames.length) {
          const extras = JSON.stringify(source.extraFiles);
          writeFileSync(path.join(stage, EXTRA_MANIFEST), extras, { flag: 'wx', mode: 0o600 });
          for (const name of extraNames) {
            const filename = path.join(stage, name);
            mkdirSync(path.dirname(filename), { recursive: true, mode: 0o700 });
            writeFileSync(filename, source.extraFiles[name]!, { flag: 'wx', mode: 0o600 });
          }
        }
        if (assetNames.length) {
          writeFileSync(path.join(stage, ASSET_MANIFEST),
            JSON.stringify(source.assetFiles), { flag: 'wx', mode: 0o600 });
          for (const name of assetNames) {
            const filename = path.join(stage, name);
            mkdirSync(path.dirname(filename), { recursive: true, mode: 0o700 });
            writeFileSync(filename, decodeNodeAsset(name, source.assetFiles[name]),
              { flag: 'wx', mode: 0o600 });
          }
        }
        writeFileSync(
          path.join(stage, RELEASE_PROOF),
          JSON.stringify({
            schema: assetNames.length ? 3 : extraNames.length ? 2 : 1,
            owner: 'pockethost-node-source',
            id: release,
            manifestDigest: digest(source.manifest),
            lockDigest: digest(source.lock),
            sourceDigest: digest(source.source),
            ...(extraNames.length || assetNames.length ?
              { extraFilesDigest: digest(JSON.stringify(source.extraFiles)) } : {}),
            ...(assetNames.length ?
              { assetFilesDigest: digest(JSON.stringify(source.assetFiles)) } : {}),
          }) + '\n',
          { flag: 'wx', mode: 0o600 },
        );
        ownedDirectory(stage);
        renameSync(stage, path.join(releases, release));
        const previous = marker.candidateRelease;
        marker.previousCandidate = previous;
        marker.candidateRelease = release;
        marker.history.push({
          at: new Date().toISOString(),
          action: 'stage',
          from: previous,
          to: release,
        });
        writeAtomic(this.projectPath(id), MARKER, JSON.stringify(marker) + '\n');
        return { project: this.summary(marker), plan: source.plan, unchanged: false };
      } finally {
        if (existsSync(stage)) rmSync(stage, { recursive: true });
      }
    });
  }
  candidates(id: string): NodeCandidateRelease[] {
    const marker = this.record(id);
    const releases = path.join(this.projectPath(id), 'releases');
    return readdirSync(releases)
      .filter((name) => RELEASE.test(name))
      .sort()
      .map((name) => {
        const folder = path.join(releases, name);
        ownedDirectory(folder);
        const plan = planNodeDependencies(
          JSON.parse(privateFile(path.join(folder, 'package.json'))),
          JSON.parse(privateFile(path.join(folder, 'package-lock.json'))),
        );
        privateFile(path.join(folder, 'server.mjs'), 64 * 1024);
        const proofFile = path.join(folder, RELEASE_PROOF);
        let sourceIntegrity: NodeCandidateRelease['sourceIntegrity'] = 'verified';
        try {
          lstatSync(proofFile);
          // Presence alone is not proof: verify all three source digests.
          this.release(id, name);
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
          sourceIntegrity = 'legacy-needs-restaging';
        }
        return {
          id: name,
          sourceIntegrity,
          active: false,
          candidate: marker.candidateRelease === name,
          previousCandidate: marker.previousCandidate === name,
          dependencyPlan: plan,
        };
      });
  }
  /** Re-attest source and immutable release files immediately before a host operation. */
  release(
    id: string,
    releaseId: string,
  ): {
    project: NodeProjectSummary;
    folder: string;
    projectFolder: string;
    plan: NodeDependencyPlan;
    source: { manifest: string; lock: string; server: string;
      extraFiles?: Record<string, string>; assetFiles?: Record<string, string> };
  } {
    if (!RELEASE.test(releaseId)) throw new RangeError('Invalid Node release');
    const marker = this.record(id);
    const projectFolder = this.projectPath(id);
    const folder = path.join(projectFolder, 'releases', releaseId);
    ownedDirectory(folder);
    const manifestText = privateFile(path.join(folder, 'package.json'));
    const lockText = privateFile(path.join(folder, 'package-lock.json'));
    const sourceText = privateFile(path.join(folder, 'server.mjs'), 64 * 1024);
    // The source proof is generated at staging time. Older unproven candidates
    // remain inspectable, but must be re-staged before runtime execution.
    const rawProof: unknown = JSON.parse(privateFile(path.join(folder, RELEASE_PROOF), 1024));
    if (!rawProof || typeof rawProof !== 'object' || Array.isArray(rawProof))
      throw new Error('Missing verified Node release source');
    const proof = rawProof as Record<string, unknown>;
    const assetExtended = proof.schema === 3;
    const extended = proof.schema === 2 || assetExtended;
    const expectedKeys = assetExtended ?
      'assetFilesDigest,extraFilesDigest,id,lockDigest,manifestDigest,owner,schema,sourceDigest' :
      extended ? 'extraFilesDigest,id,lockDigest,manifestDigest,owner,schema,sourceDigest' :
      'id,lockDigest,manifestDigest,owner,schema,sourceDigest';
    if (
      Object.keys(proof).sort().join(',') !== expectedKeys ||
      ![1, 2, 3].includes(proof.schema as number) ||
      proof.owner !== 'pockethost-node-source' ||
      proof.id !== releaseId ||
      proof.manifestDigest !== digest(manifestText) ||
      proof.lockDigest !== digest(lockText) ||
      proof.sourceDigest !== digest(sourceText)
    )
      throw new Error('Node release source digest mismatch');
    let extraFiles: Record<string, string> | undefined;
    if (extended) {
      const extraJson = privateFile(path.join(folder, EXTRA_MANIFEST), MAX_EXTRA_TOTAL + 4096);
      const extras = cleanExtras(JSON.parse(extraJson));
      if ((!Object.keys(extras).length && !assetExtended) ||
          digest(JSON.stringify(extras)) !== proof.extraFilesDigest ||
          extraJson !== JSON.stringify(extras))
        throw new Error('Node extra source manifest digest mismatch');
      for (const [name, expected] of Object.entries(extras)) {
        const parts = name.split('/');
        let current = folder;
        for (const part of parts.slice(0, -1)) {
          current = path.join(current, part);
          ownedDirectory(current);
        }
        if (privateFile(path.join(folder, name), 32 * 1024) !== expected)
          throw new Error('Node extra source file digest mismatch');
      }
      extraFiles = extras;
    }
    let assetFiles: Record<string, string> | undefined;
    if (assetExtended) {
      const assetsJson = privateFile(path.join(folder, ASSET_MANIFEST), 750 * 1024);
      const assets = cleanAssets(JSON.parse(assetsJson));
      if (!Object.keys(assets).length || assetsJson !== JSON.stringify(assets) ||
          digest(assetsJson) !== proof.assetFilesDigest)
        throw new Error('Node binary asset manifest digest mismatch');
      for (const [name, expected] of Object.entries(assets)) {
        let current = folder;
        for (const segment of name.split('/').slice(0, -1)) {
          current = path.join(current, segment);
          ownedDirectory(current);
        }
        if (privateBytes(path.join(folder, name)).toString('base64') !== expected)
          throw new Error('Node binary asset digest mismatch');
      }
      assetFiles = assets;
    }
    verifySourceLayout(folder, extraFiles ?? {}, assetFiles ?? {});
    const manifest = JSON.parse(manifestText);
    const lockfile = JSON.parse(lockText);
    const plan = planNodeDependencies(manifest, lockfile);
    if ((manifest as { scripts?: { start?: unknown } }).scripts?.start !== 'node server.mjs') {
      throw new Error('Unsupported Node release entrypoint');
    }
    return {
      project: this.summary(marker),
      folder,
      projectFolder,
      plan,
      source: { manifest: manifestText, lock: lockText, server: sourceText,
        ...(extraFiles ? { extraFiles } : {}),
        ...(assetFiles ? { assetFiles } : {}) },
    };
  }

  /** Only expose the verified current candidate; no arbitrary file reads. */
  candidateSource(id: string): {
    release: string;
    manifest: string;
    lockfile: string;
    serverSource: string;
    extraFiles?: Record<string, string>;
    assetFiles?: Record<string, string>;
  } {
    const marker = this.record(id);
    if (!marker.candidateRelease) throw new RangeError('No staged Node source candidate');
    const verified = this.release(id, marker.candidateRelease);
    return {
      release: marker.candidateRelease,
      manifest: verified.source.manifest,
      lockfile: verified.source.lock,
      serverSource: verified.source.server,
      ...(verified.source.extraFiles ? { extraFiles: verified.source.extraFiles } : {}),
      ...(verified.source.assetFiles ? { assetFiles: verified.source.assetFiles } : {}),
    };
  }

  restoreCandidate(
    id: string,
    expectedCandidate?: string,
    expectedRevision?: number,
  ): NodeProjectSummary {
    if (expectedCandidate !== undefined && !RELEASE.test(expectedCandidate))
      throw new RangeError('Invalid expected Node candidate');
    if (expectedRevision !== undefined &&
        (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0 || expectedRevision > 30))
      throw new RangeError('Invalid expected Node revision');
    return this.mutation(() => {
      const marker = this.record(id);
      if ((expectedCandidate !== undefined && marker.candidateRelease !== expectedCandidate) ||
          (expectedRevision !== undefined && marker.history.length !== expectedRevision))
        throw new Error('Node candidate changed; reload before restoring');
      if (!marker.previousCandidate) throw new RangeError('No previous source candidate');
      const old = marker.candidateRelease;
      const next = marker.previousCandidate;
      // Restoring a candidate must not resurrect tampered or legacy source.
      this.release(id, next);
      marker.candidateRelease = next;
      marker.previousCandidate = old;
      if (marker.history.length >= 30) throw new RangeError('Node release history budget reached');
      marker.history.push({
        at: new Date().toISOString(),
        action: 'restore-candidate',
        from: old,
        to: next,
      });
      writeAtomic(this.projectPath(id), MARKER, JSON.stringify(marker) + '\n');
      return this.summary(marker);
    });
  }
}
