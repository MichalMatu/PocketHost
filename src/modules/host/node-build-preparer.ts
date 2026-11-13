import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import {
  closeSync, constants, cpSync, existsSync, fstatSync, lstatSync, mkdirSync,
  openSync, readFileSync, readSync, readdirSync, realpathSync, renameSync,
  rmSync, writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { NodeProjectHost } from './node-project-host.ts';
import { NodeDependencyPreparer } from './node-dependency-preparer.ts';

const PREFIX = '/data/data/com.termux/files/usr';
const RELEASE = /^r-[a-f0-9]{32}$/;
const LOCK_NAME = '.node-ports.lock';
const PROOF = '.pockethost-node-build.json';
const MAX_BYTES = 16 * 1024 * 1024;
const MAX_ENTRIES = 512;
type RunBuild = (workspace: string) => Promise<void>;

function digest(contents: string): string {
  return createHash('sha256').update(contents).digest('hex');
}
function privateDir(folder: string): void {
  const stat = lstatSync(folder);
  if (
    !path.isAbsolute(folder) || !stat.isDirectory() || stat.isSymbolicLink() ||
    realpathSync(folder) !== folder || stat.uid !== process.getuid?.() ||
    (stat.mode & 0o077) !== 0
  ) throw new Error('Untrusted private Node build workspace');
}

/** Native, bounded npm invocation. The explicitly approved build script may
 * execute project code under the Termux UID; a private folder is NOT an OS sandbox.
 * Only trusted owner-reviewed code should be approved for this DEV operation.
 */
async function runBuild(workspace: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(PREFIX + '/bin/npm', ['run', 'build', '--ignore-scripts'], {
      cwd: workspace,
      detached: true,
      shell: false,
      env: {
        PATH: PREFIX + '/bin',
        HOME: workspace,
        TMPDIR: PREFIX + '/tmp',
        NODE_ENV: 'production',
        CI: 'true',
        npm_config_cache: path.join(workspace, '.npm-cache'),
        npm_config_audit: 'false',
        npm_config_fund: 'false',
        npm_config_update_notifier: 'false',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = 0;
    let exceeded = false;
    const terminate = () => {
      exceeded = true;
      // Only the freshly spawned, separate process group may be signalled.
      if (child.pid) {
        try { process.kill(-child.pid, 'SIGKILL'); }
        catch { child.kill('SIGKILL'); }
      } else child.kill('SIGKILL');
    };
    const timeout = setTimeout(terminate, 90_000);
    const observe = (chunk: Buffer) => {
      output += chunk.byteLength;
      if (output > 96 * 1024 && !exceeded) terminate();
    };
    child.stdout?.on('data', observe);
    child.stderr?.on('data', observe);
    child.once('error', (error) => {
      clearTimeout(timeout);
      reject(new Error('Owned Node build process unavailable', { cause: error }));
    });
    child.once('close', (status) => {
      clearTimeout(timeout);
      if (exceeded || status !== 0) reject(new Error('Bounded owned Node build failed'));
      else resolve();
    });
  });
}

function outputProof(folder: string): { treeDigest: string; bytes: number; entries: number } {
  const root = lstatSync(folder);
  if (
    !root.isDirectory() || root.isSymbolicLink() ||
    realpathSync(folder) !== folder || root.uid !== process.getuid?.()
  ) throw new Error('Unsafe Node build artifact directory');
  const hash = createHash('sha256');
  const pending = [folder];
  const chunk = Buffer.allocUnsafe(64 * 1024);
  let bytes = 0, entries = 0, files = 0;
  while (pending.length) {
    const parent = pending.pop()!;
    for (const name of readdirSync(parent).sort()) {
      if (parent === folder && name === PROOF) continue;
      const file = path.join(parent, name);
      const relative = path.relative(folder, file);
      const stat = lstatSync(file);
      entries++;
      if (
        entries > MAX_ENTRIES || stat.uid !== process.getuid?.() ||
        stat.isSymbolicLink() || (!stat.isDirectory() && !stat.isFile())
      ) throw new Error('Unsafe Node build artifact entry');
      if (stat.isDirectory()) {
        hash.update('D\0' + relative + '\0');
        pending.push(file);
        continue;
      }
      if (stat.nlink !== 1 || stat.size < 0 || !Number.isSafeInteger(stat.size))
        throw new Error('Unsafe Node build artifact file');
      files++;
      bytes += stat.size;
      if (bytes > MAX_BYTES) throw new RangeError('Node build artifact exceeds 16 MiB');
      const fd = openSync(file, constants.O_RDONLY | constants.O_NOFOLLOW);
      try {
        const live = fstatSync(fd);
        if (
          live.ino !== stat.ino || live.dev !== stat.dev ||
          live.size !== stat.size || !live.isFile() || live.nlink !== 1
        ) throw new Error('Node artifact changed during verification');
        hash.update('F\0' + relative + '\0' + stat.size + '\0');
        let left = stat.size;
        while (left > 0) {
          const n = readSync(fd, chunk, 0, Math.min(chunk.length, left), null);
          if (n <= 0) throw new Error('Incomplete Node artifact');
          hash.update(chunk.subarray(0, n));
          left -= n;
        }
        const after = fstatSync(fd);
        if (after.size !== live.size || after.mtimeMs !== live.mtimeMs)
          throw new Error('Node artifact changed during verification');
      } finally { closeSync(fd); }
    }
  }
  if (files === 0) throw new Error('Node build produced no regular files');
  return { treeDigest: hash.digest('hex'), bytes, entries };
}

/** Explicit, candidate-pinned build. Published dist is not activated here. */
export class NodeBuildPreparer {
  private readonly projects: NodeProjectHost;
  private readonly projectRoot: string;
  private readonly releaseInUse: (projectId: string, release: string) => boolean;
  private readonly execute: RunBuild;
  constructor(
    projects: NodeProjectHost,
    projectRoot: string,
    releaseInUse: (projectId: string, release: string) => boolean,
    execute: RunBuild = runBuild,
  ) {
    this.projects = projects;
    this.projectRoot = projectRoot;
    this.releaseInUse = releaseInUse;
    this.execute = execute;
  }

  buildScript(projectId: string, releaseId: string): string {
    const source = this.projects.release(projectId, releaseId);
    if (!source.plan.commands.build) throw new Error('Node candidate does not require build');
    const manifest = JSON.parse(source.source.manifest) as { scripts: { build: string } };
    return manifest.scripts.build;
  }

  verifyBuilt(projectId: string, releaseId: string): {
    release: string; entries: number; bytes: number; verified: true
  } {
    if (!RELEASE.test(releaseId)) throw new RangeError('Invalid Node build release');
    const source = this.projects.release(projectId, releaseId);
    if (!source.plan.commands.build) throw new Error('Node release has no build');
    const filename = path.join(source.folder, 'dist', PROOF);
    const stat = lstatSync(filename);
    if (
      !stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 ||
      stat.uid !== process.getuid?.() || (stat.mode & 0o077) !== 0 ||
      stat.size > 2048
    ) throw new Error('Untrusted Node build proof');
    const fd = openSync(filename, constants.O_RDONLY | constants.O_NOFOLLOW);
    let contents: string;
    try {
      const live = fstatSync(fd);
      if (live.ino !== stat.ino || live.dev !== stat.dev || live.size !== stat.size)
        throw new Error('Node build proof changed');
      contents = readFileSync(fd, 'utf8');
    } finally { closeSync(fd); }
    const proof: unknown = JSON.parse(contents);
    if (!proof || typeof proof !== 'object' || Array.isArray(proof))
      throw new Error('Invalid Node build proof');
    const p = proof as Record<string, unknown>;
    if (
      Object.keys(p).sort().join(',') !==
        'bytes,entries,lockDigest,manifestDigest,owner,release,schema,sourceDigest,treeDigest' ||
      p.schema !== 1 || p.owner !== 'pockethost-node-build' || p.release !== releaseId ||
      p.lockDigest !== digest(source.source.lock) ||
      p.manifestDigest !== digest(source.source.manifest) ||
      p.sourceDigest !== digest(source.source.server)
    ) throw new Error('Node build proof does not match release');
    const output = outputProof(path.join(source.folder, 'dist'));
    if (
      output.treeDigest !== p.treeDigest || output.bytes !== p.bytes ||
      output.entries !== p.entries
    ) throw new Error('Node build artifact integrity mismatch');
    return { release: releaseId, entries: output.entries, bytes: output.bytes, verified: true };
  }

  async prepare(projectId: string, releaseId: string, approved: boolean): Promise<{
    release: string; entries: number; bytes: number; prepared: true
  }> {
    if (approved !== true) throw new Error('Explicit owned Node build approval required');
    if (!RELEASE.test(releaseId)) throw new RangeError('Invalid Node build release');
    if (this.projects.inspect(projectId).candidateRelease !== releaseId)
      throw new Error('Node candidate changed before build');
    const source = this.projects.release(projectId, releaseId);
    if (!source.plan.commands.build) throw new Error('Node build not required');
    if (this.releaseInUse(projectId, releaseId) !== false)
      throw new Error('Active or unknown Node release cannot be built');
    if (source.plan.dependencyCount > 0)
      new NodeDependencyPreparer(this.projects, this.projectRoot, () => true)
        .verifyPrepared(projectId, releaseId);
    privateDir(this.projectRoot);
    privateDir(source.projectFolder);
    privateDir(source.folder);

    const lock = path.join(this.projectRoot, LOCK_NAME);
    const fd = openSync(lock, 'wx', 0o600);
    closeSync(fd);
    let workspace: string | null = null;
    try {
      if (
        this.projects.inspect(projectId).candidateRelease !== releaseId ||
        this.releaseInUse(projectId, releaseId) !== false
      ) throw new Error('Node build candidate changed during admission');
      const current = this.projects.release(projectId, releaseId);
      if (existsSync(path.join(current.folder, 'dist')))
        throw new Error('Existing or ambiguous Node build artifact refused');
      if (current.plan.dependencyCount > 0)
        new NodeDependencyPreparer(this.projects, this.projectRoot, () => true)
          .verifyPrepared(projectId, releaseId);
      workspace = path.join(current.projectFolder, '.node-build-' + randomUUID());
      mkdirSync(workspace, { mode: 0o700 });
      for (const [name, contents] of [
        ['package.json', current.source.manifest],
        ['package-lock.json', current.source.lock],
        ['server.mjs', current.source.server],
      ] as const) writeFileSync(path.join(workspace, name), contents, { flag: 'wx', mode: 0o600 });
      if (current.plan.dependencyCount > 0) {
        cpSync(path.join(current.folder, 'node_modules'), path.join(workspace, 'node_modules'), {
          recursive: true, force: false, errorOnExist: true, dereference: false,
        });
        // The original release packages must remain unchanged after the copy.
        new NodeDependencyPreparer(this.projects, this.projectRoot, () => true)
          .verifyPrepared(projectId, releaseId);
      }
      await this.execute(workspace);
      if (
        readFileSync(path.join(workspace, 'package.json'), 'utf8') !== current.source.manifest ||
        readFileSync(path.join(workspace, 'package-lock.json'), 'utf8') !== current.source.lock ||
        readFileSync(path.join(workspace, 'server.mjs'), 'utf8') !== current.source.server
      ) throw new Error('Node build modified verified source input');
      const dist = path.join(workspace, 'dist');
      if (existsSync(path.join(dist, PROOF)))
        throw new Error('Build output contains reserved proof filename');
      const proof = outputProof(dist);
      if (
        this.projects.inspect(projectId).candidateRelease !== releaseId ||
        this.releaseInUse(projectId, releaseId) !== false
      ) throw new Error('Node candidate changed during build');
      this.projects.release(projectId, releaseId);
      if (current.plan.dependencyCount > 0)
        new NodeDependencyPreparer(this.projects, this.projectRoot, () => true)
          .verifyPrepared(projectId, releaseId);
      writeFileSync(path.join(dist, PROOF), JSON.stringify({
        schema: 1, owner: 'pockethost-node-build', release: releaseId,
        lockDigest: digest(current.source.lock),
        manifestDigest: digest(current.source.manifest),
        sourceDigest: digest(current.source.server),
        ...proof,
      }) + '\n', { flag: 'wx', mode: 0o600 });
      const published = path.join(current.folder, 'dist');
      renameSync(dist, published);
      try { this.verifyBuilt(projectId, releaseId); }
      catch (error) {
        rmSync(published, { recursive: true, force: true });
        throw error;
      }
      return { release: releaseId, entries: proof.entries, bytes: proof.bytes, prepared: true };
    } finally {
      if (workspace) rmSync(workspace, { recursive: true, force: true });
      rmSync(lock, { force: true });
    }
  }
}
