import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import {
  closeSync, constants, existsSync, fstatSync, lstatSync, mkdirSync, openSync,
  readFileSync, readSync, readdirSync, realpathSync, renameSync, rmSync, writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { NodeProjectHost } from './node-project-host.ts';
import { SAFE_NPM_CI_COMMAND, SAFE_NPM_BUILD_CI_COMMAND } from '../../shared/node-dependency-plan.ts';

const PREFIX = '/data/data/com.termux/files/usr';
const RELEASE = /^r-[a-f0-9]{32}$/;
const LOCK_NAME = '.node-ports.lock';
const PROOF_NAME = '.pockethost-node-packages.json';
const ARGS: readonly string[] = SAFE_NPM_CI_COMMAND.slice(1);
const BUILD_ARGS: readonly string[] = SAFE_NPM_BUILD_CI_COMMAND.slice(1);
const MAX_PACKAGES_BYTES = 96 * 1024 * 1024;
const MAX_PACKAGES_ENTRIES = 16000;

type RunNpm = (directory: string, args: readonly string[]) => Promise<void>;

/** Fixed binary, bounded time and output, no inherited admin environment or shell. */
async function runNpm(directory: string, args: readonly string[]): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(PREFIX + '/bin/npm', [...args], {
      cwd: directory,
      shell: false,
      env: {
        PATH: PREFIX + '/bin',
        HOME: directory,
        TMPDIR: PREFIX + '/tmp',
        npm_config_cache: path.join(directory, '.npm-cache'),
        npm_config_ignore_scripts: 'true',
        npm_config_audit: 'false',
        npm_config_fund: 'false',
        npm_config_update_notifier: 'false',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = 0;
    let failed = false;
    const timeout = setTimeout(() => {
      failed = true;
      child.kill('SIGKILL');
    }, 120_000);
    const observe = (chunk: Buffer) => {
      output += chunk.byteLength;
      if (output > 128 * 1024) {
        failed = true;
        child.kill('SIGKILL');
      }
    };
    child.stdout?.on('data', observe);
    child.stderr?.on('data', observe);
    child.once('error', (error) => {
      clearTimeout(timeout);
      reject(new Error('Bounded npm dependency preparation unavailable', { cause: error }));
    });
    child.once('close', (status) => {
      clearTimeout(timeout);
      if (failed || status !== 0) reject(new Error('Bounded npm dependency preparation failed'));
      else resolve();
    });
  });
}

function privateDirectory(folder: string): void {
  const stat = lstatSync(folder);
  if (!path.isAbsolute(folder) || !stat.isDirectory() || stat.isSymbolicLink() ||
      realpathSync(folder) !== folder ||
      stat.uid !== process.getuid?.() || (stat.mode & 0o077) !== 0)
    throw new Error('Untrusted private Node dependency directory');
}

function checksum(source: string): string {
  return createHash('sha256').update(source).digest('hex');
}

/** Walk only the private npm output, disallow links/devices and cap disk usage.
 * Hash regular file bytes to detect changes when this release is later admitted.
 */
function attestPackageTree(root: string): { treeDigest: string; entries: number; bytes: number } {
  // npm creates node_modules with ordinary 0755 mode. Its 0700 parent
  // provides the private boundary, but ownership and symlinks still matter.
  const stat = lstatSync(root);
  if (!stat.isDirectory() || stat.isSymbolicLink() ||
      stat.uid !== process.getuid?.() || realpathSync(root) !== root)
    throw new Error('Untrusted Node dependency directory');
  const hash = createHash('sha256');
  const pending = [root];
  const chunk = Buffer.allocUnsafe(64 * 1024);
  let entries = 0;
  let bytes = 0;
  while (pending.length) {
    const folder = pending.pop()!;
    const names = readdirSync(folder).sort();
    for (const name of names) {
      // The proof travels inside the published directory; exclude only this
      // exact root-level metadata file from the content hash.
      if (folder === root && name === PROOF_NAME) continue;
      const file = path.join(folder, name);
      const relative = path.relative(root, file);
      const stat = lstatSync(file);
      entries++;
      if (entries > MAX_PACKAGES_ENTRIES || stat.uid !== process.getuid?.() ||
          stat.isSymbolicLink() || (!stat.isFile() && !stat.isDirectory()))
        throw new Error('Unsafe npm dependency tree');
      if (stat.isDirectory()) {
        hash.update('D\0' + relative + '\0');
        pending.push(file);
        continue;
      }
      if (stat.nlink !== 1 || stat.size < 0 || !Number.isSafeInteger(stat.size))
        throw new Error('Unsafe npm dependency file');
      bytes += stat.size;
      if (bytes > MAX_PACKAGES_BYTES)
        throw new RangeError('Node dependencies exceed 96 MiB');
      const fd = openSync(file, constants.O_RDONLY | constants.O_NOFOLLOW);
      try {
        const current = fstatSync(fd);
        if (current.ino !== stat.ino || current.dev !== stat.dev ||
            current.size !== stat.size || !current.isFile() || current.nlink !== 1)
          throw new Error('npm dependency file changed during verification');
        hash.update('F\0' + relative + '\0' + stat.size + '\0');
        let remaining = stat.size;
        while (remaining > 0) {
          const amount = readSync(fd, chunk, 0, Math.min(chunk.length, remaining), null);
          if (amount <= 0) throw new Error('Incomplete npm dependency file');
          hash.update(chunk.subarray(0, amount));
          remaining -= amount;
        }
        const after = fstatSync(fd);
        if (after.size !== current.size || after.mtimeMs !== current.mtimeMs)
          throw new Error('npm dependency file changed during verification');
      } finally {
        closeSync(fd);
      }
    }
  }
  return { treeDigest: hash.digest('hex'), entries, bytes };
}

/**
 * Isolated npm preparation for explicitly approved owned releases.
 * Never called by the QA checkout or by service discovery.
 */
export class NodeDependencyPreparer {
  private readonly projects: NodeProjectHost;
  private readonly projectRoot: string;
  private readonly releaseInUse: (projectId: string, releaseId: string) => boolean;
  private readonly execute: RunNpm;
  constructor(
    projects: NodeProjectHost,
    projectRoot: string,
    releaseInUse: (projectId: string, releaseId: string) => boolean,
    execute: RunNpm = runNpm,
  ) {
    this.projects = projects;
    this.projectRoot = projectRoot;
    this.releaseInUse = releaseInUse;
    this.execute = execute;
  }

  /** Read-only re-attestation: a proof file without matching package bytes is not success. */
  verifyPrepared(
    projectId: string,
    releaseId: string,
  ): { release: string; dependencyCount: number; verified: true } {
    if (!RELEASE.test(releaseId)) throw new RangeError('Invalid Node release for verification');
    const verified = this.projects.release(projectId, releaseId);
    const filename = path.join(verified.folder, 'node_modules', PROOF_NAME);
    const stat = lstatSync(filename);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 ||
        stat.uid !== process.getuid?.() || (stat.mode & 0o077) !== 0 || stat.size > 2048)
      throw new Error('Untrusted Node dependency proof');
    const fd = openSync(filename, constants.O_RDONLY | constants.O_NOFOLLOW);
    let contents: string;
    try {
      const live = fstatSync(fd);
      if (live.ino !== stat.ino || live.dev !== stat.dev || live.size !== stat.size)
        throw new Error('Node dependency proof changed');
      contents = readFileSync(fd, 'utf8');
    } finally {
      closeSync(fd);
    }
    const proof: unknown = JSON.parse(contents);
    if (!proof || typeof proof !== 'object' || Array.isArray(proof))
      throw new Error('Invalid Node dependency proof');
    const value = proof as Record<string, unknown>;
    const expected = ['bytes', 'dependencyCount', 'entries', 'lockDigest', 'owner',
      'release', 'schema', 'treeDigest'].join(',');
    if (Object.keys(value).sort().join(',') !== expected ||
        value.schema !== 1 || value.owner !== 'pockethost-node-packages' ||
        value.release !== releaseId ||
        value.dependencyCount !== verified.plan.dependencyCount ||
        value.lockDigest !== checksum(verified.source.lock))
      throw new Error('Node dependency proof does not match release');
    const tree = attestPackageTree(path.join(verified.folder, 'node_modules'));
    if (value.treeDigest !== tree.treeDigest ||
        value.entries !== tree.entries || value.bytes !== tree.bytes)
      throw new Error('Node installed dependency tree digest mismatch');
    return { release: releaseId, dependencyCount: verified.plan.dependencyCount, verified: true };
  }

  async prepare(
    projectId: string,
    releaseId: string,
    approved: boolean,
  ): Promise<{ release: string; dependencyCount: number; prepared: true }> {
    if (approved !== true) throw new Error('Explicit owned dependency installation approval required');
    if (!RELEASE.test(releaseId)) throw new RangeError('Invalid Node release for dependency preparation');
    const summary = this.projects.inspect(projectId);
    if (summary.candidateRelease !== releaseId)
      throw new Error('Node candidate changed before package preparation');
    const verified = this.projects.release(projectId, releaseId);
    const { plan } = verified;
    if (plan.dependencyCount === 0)
      throw new Error('Node candidate has no dependencies to prepare');
    const issues = [
      ...plan.lockReview.missingDirectEntries,
      ...plan.lockReview.unreviewedSources,
      ...plan.lockReview.installScripts,
    ];
    if (issues.length) throw new Error('Node dependency lockfile requires manual review');
    if (this.releaseInUse(projectId, releaseId) !== false)
      throw new Error('Active or unverified Node release cannot be prepared');
    privateDirectory(this.projectRoot);
    privateDirectory(verified.projectFolder);
    privateDirectory(verified.folder);

    const globalLock = path.join(this.projectRoot, LOCK_NAME);
    const lock = openSync(globalLock, 'wx', 0o600);
    closeSync(lock);
    let workspace: string | null = null;
    try {
      // Reverify under the same lock as deployment/stage/backup.
      if (this.projects.inspect(projectId).candidateRelease !== releaseId ||
          this.releaseInUse(projectId, releaseId) !== false)
        throw new Error('Node dependency candidate changed during admission');
      const current = this.projects.release(projectId, releaseId);
      if (existsSync(path.join(current.folder, 'node_modules')))
        throw new Error('Existing or ambiguous Node dependency installation refused');
      workspace = path.join(current.projectFolder, '.node-packages-' + randomUUID());
      mkdirSync(workspace, { mode: 0o700 });
      writeFileSync(path.join(workspace, 'package.json'), current.source.manifest,
        { flag: 'wx', mode: 0o600 });
      writeFileSync(path.join(workspace, 'package-lock.json'), current.source.lock,
        { flag: 'wx', mode: 0o600 });

      // Build-capable releases need devDependencies. This step still runs
      // npm ci with lifecycle scripts and binary links disabled; no build runs.
      await this.execute(workspace, plan.commands.build !== null ? BUILD_ARGS : ARGS);
      const modules = path.join(workspace, 'node_modules');
      const tree = attestPackageTree(modules);
      // No npm source or scripts may rewrite the verified input during preparation.
      if (readFileSync(path.join(workspace, 'package.json'), 'utf8') !== current.source.manifest ||
          readFileSync(path.join(workspace, 'package-lock.json'), 'utf8') !== current.source.lock)
        throw new Error('Node package input changed during preparation');
      if (this.projects.inspect(projectId).candidateRelease !== releaseId ||
          this.releaseInUse(projectId, releaseId) !== false)
        throw new Error('Node candidate changed during package preparation');
      this.projects.release(projectId, releaseId);
      // Write the attestation *inside* staged node_modules before a single
      // atomic directory rename. Power loss cannot publish unproven modules.
      writeFileSync(path.join(modules, PROOF_NAME), JSON.stringify({
        schema: 1, owner: 'pockethost-node-packages',
        release: releaseId, lockDigest: checksum(current.source.lock),
        dependencyCount: plan.dependencyCount,
        treeDigest: tree.treeDigest, entries: tree.entries, bytes: tree.bytes,
      }) + '\n', { flag: 'wx', mode: 0o600 });
      const published = path.join(current.folder, 'node_modules');
      renameSync(modules, published);
      try {
        // A successful npm exit is not proof: re-open the *published* tree
        // and verify its attestation before acknowledging the operation.
        this.verifyPrepared(projectId, releaseId);
      } catch (error) {
        // Only the directory freshly created under our exclusive lock may be
        // removed here. No prior release or foreign service is affected.
        rmSync(published, { recursive: true, force: true });
        throw error;
      }
      return { release: releaseId, dependencyCount: plan.dependencyCount, prepared: true };
    } finally {
      if (workspace) rmSync(workspace, { recursive: true, force: true });
      rmSync(globalLock);
    }
  }
}
