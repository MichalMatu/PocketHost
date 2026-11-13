import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import {
  closeSync, existsSync, lstatSync, mkdirSync, openSync,
  readFileSync, renameSync, rmSync, writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { NodeProjectHost } from './node-project-host.ts';

const PREFIX = '/data/data/com.termux/files/usr';
const RELEASE = /^r-[a-f0-9]{32}$/;
const LOCK_NAME = '.node-ports.lock';
const PROOF_NAME = '.pockethost-node-packages.json';
const ARGS = ['ci', '--ignore-scripts', '--no-bin-links', '--no-audit', '--no-fund', '--omit=dev'] as const;

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
      stat.uid !== process.getuid?.() || (stat.mode & 0o077) !== 0)
    throw new Error('Untrusted private Node dependency directory');
}

function checksum(source: string): string {
  return createHash('sha256').update(source).digest('hex');
}

/**
 * Never exposed to API by default. A future, separately approved endpoint
 * must supply exact live ownership (not a guessed PID) and an explicit opt-in.
 * Do not use this to install dependencies in the ChatGPT QA checkout.
 */
export class NodeDependencyPreparer {
  constructor(
    private readonly projects: NodeProjectHost,
    private readonly projectRoot: string,
    private readonly releaseInUse: (projectId: string, releaseId: string) => boolean,
    private readonly execute: RunNpm = runNpm,
  ) {}

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
    if (plan.dependencyCount === 0 || plan.commands.build !== null)
      throw new Error('Only no-build Node dependency candidates can be prepared');
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
      if (existsSync(path.join(current.folder, PROOF_NAME)) ||
          existsSync(path.join(current.folder, 'node_modules')))
        throw new Error('Existing or ambiguous Node dependency installation refused');
      workspace = path.join(current.projectFolder, '.node-packages-' + randomUUID());
      mkdirSync(workspace, { mode: 0o700 });
      writeFileSync(path.join(workspace, 'package.json'), current.source.manifest,
        { flag: 'wx', mode: 0o600 });
      writeFileSync(path.join(workspace, 'package-lock.json'), current.source.lock,
        { flag: 'wx', mode: 0o600 });

      await this.execute(workspace, ARGS);
      const modules = path.join(workspace, 'node_modules');
      const info = lstatSync(modules);
      if (!info.isDirectory() || info.isSymbolicLink() || info.uid !== process.getuid?.())
        throw new Error('Unsafe npm installation result');
      // No npm source or scripts may rewrite the verified input during preparation.
      if (readFileSync(path.join(workspace, 'package.json'), 'utf8') !== current.source.manifest ||
          readFileSync(path.join(workspace, 'package-lock.json'), 'utf8') !== current.source.lock)
        throw new Error('Node package input changed during preparation');
      if (this.projects.inspect(projectId).candidateRelease !== releaseId ||
          this.releaseInUse(projectId, releaseId) !== false)
        throw new Error('Node candidate changed during package preparation');
      this.projects.release(projectId, releaseId);
      renameSync(modules, path.join(current.folder, 'node_modules'));
      writeFileSync(path.join(current.folder, PROOF_NAME), JSON.stringify({
        schema: 1, owner: 'pockethost-node-packages',
        release: releaseId, lockDigest: checksum(current.source.lock),
        dependencyCount: plan.dependencyCount,
      }) + '\n', { flag: 'wx', mode: 0o600 });
      return { release: releaseId, dependencyCount: plan.dependencyCount, prepared: true };
    } finally {
      if (workspace) rmSync(workspace, { recursive: true, force: true });
      rmSync(globalLock);
    }
  }
}
