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
import { planNodeDependencies, type NodeDependencyPlan } from '../../shared/node-dependency-plan.ts';

const PROJECT = /^node-[a-f0-9]{32}$/;
const RELEASE = /^r-[a-f0-9]{32}$/;
const MAX_PROJECTS = 8;
const MAX_RELEASES = 12;
const MAX_INPUT = 320 * 1024;
const MARKER = '.pockethost-node.json';
const RELEASE_PROOF = '.pockethost-node-source.json';
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
} {
  if (
    !input ||
    typeof input !== 'object' ||
    Array.isArray(input) ||
    Object.keys(input).sort().join(',') !== 'packageJson,packageLock,serverSource'
  ) {
    throw new RangeError('Invalid Node source envelope');
  }
  const source = input as NodeSourceInput;
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
    Buffer.byteLength(manifest) + Buffer.byteLength(lock) + Buffer.byteLength(source.serverSource) >
      MAX_INPUT
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
  return { manifest, lock, source: source.serverSource, plan };
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
  }
  stage(id: string, input: unknown): { project: NodeProjectSummary; plan: NodeDependencyPlan } {
    const source = cleanSource(input);
    const marker = this.record(id);
    const releases = path.join(this.projectPath(id), 'releases');
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
      writeFileSync(path.join(stage, RELEASE_PROOF), JSON.stringify({
        schema: 1,
        owner: 'pockethost-node-source',
        id: release,
        manifestDigest: digest(source.manifest),
        lockDigest: digest(source.lock),
        sourceDigest: digest(source.source),
      }) + '\n', { flag: 'wx', mode: 0o600 });
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
      return { project: this.summary(marker), plan: source.plan };
    } finally {
      if (existsSync(stage)) rmSync(stage, { recursive: true });
    }
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
  release(id: string, releaseId: string): {
    project: NodeProjectSummary;
    folder: string;
    projectFolder: string;
    plan: NodeDependencyPlan;
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
    if (
      Object.keys(proof).sort().join(',') !==
        'id,lockDigest,manifestDigest,owner,schema,sourceDigest' ||
      proof.schema !== 1 ||
      proof.owner !== 'pockethost-node-source' ||
      proof.id !== releaseId ||
      proof.manifestDigest !== digest(manifestText) ||
      proof.lockDigest !== digest(lockText) ||
      proof.sourceDigest !== digest(sourceText)
    ) throw new Error('Node release source digest mismatch');
    const manifest = JSON.parse(manifestText);
    const lockfile = JSON.parse(lockText);
    const plan = planNodeDependencies(manifest, lockfile);
    if ((manifest as { scripts?: { start?: unknown } }).scripts?.start !== 'node server.mjs') {
      throw new Error('Unsupported Node release entrypoint');
    }
    return { project: this.summary(marker), folder, projectFolder, plan };
  }

  restoreCandidate(id: string): NodeProjectSummary {
    const marker = this.record(id);
    if (!marker.previousCandidate) throw new RangeError('No previous source candidate');
    const old = marker.candidateRelease;
    const next = marker.previousCandidate;
    ownedDirectory(path.join(this.projectPath(id), 'releases', next));
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
  }
}
