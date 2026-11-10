import { readdirSync, existsSync, lstatSync, openSync, closeSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { NodeProjectHost, type NodeProjectSummary } from './node-project-host.ts';
import { WorkspaceFiles, type Exec, executeFixed } from './termux-admin.ts';
import { ResticWorkspaceAdmin } from './termux-restic-admin.ts';

/**
 * M2 scoped, independent encrypted Restic repository for PocketHost-created
 * Node projects. Reuses the existing Restic adapter, never backs up HOME,
 * Termux PREFIX or externally managed applications.
 *
 * Restores are staging-only: never overwrite live source or process markers.
 * All mutating methods need a separate explicit caller approval.
 */
export class NodeProjectBackupHost {
  private readonly root: string;
  private readonly projects: NodeProjectHost;
  private readonly restic: ResticWorkspaceAdmin;

  constructor(
    root = path.join(os.homedir(), 'PocketHost-NodeProjects'),
    state = path.join(os.homedir(), '.local', 'state', 'pockethost', 'node-restic'),
  ) {
    this.root = root;
    this.projects = new NodeProjectHost(root);
    this.restic = new ResticWorkspaceAdmin(
      new WorkspaceFiles(root), state, 'pockethost-node',
    );
  }
  status(): { initialized: boolean; repositoryPresent: boolean; keyPresent: boolean } {
    return this.restic.status();
  }
  private inspectScope(root: string, projects: readonly NodeProjectSummary[]): void {
    if (projects.length === 0) {
      throw new Error('At least one explicitly created PocketHost Node project is required');
    }
    // Scope is exact, not the whole Termux HOME or a directory containing
    // an unrelated application. Refuse in-flight deployments and foreign files.
    if (!path.isAbsolute(root) || root.includes('..')) {
      throw new Error('Unsafe Node backup source root');
    }
    const projectIds = new Set(projects.map((project) => project.id));
    const exact = (folder: string, allowed: ReadonlySet<string>, directories: ReadonlySet<string>) => {
      for (const entry of readdirSync(folder, { withFileTypes: true })) {
        if (!allowed.has(entry.name) || entry.isSymbolicLink()) {
          throw new Error('Unexpected entry in private Node backup scope');
        }
        const stat = lstatSync(path.join(folder, entry.name));
        if (stat.uid !== process.getuid?.() || (stat.mode & 0o077) !== 0 ||
          (directories.has(entry.name)
            ? !entry.isDirectory()
            : !entry.isFile() || stat.nlink !== 1)) {
          throw new Error('Invalid owned Node backup entry');
        }
      }
    };
    exact(root, projectIds, projectIds);
    const marker = new Set(['.pockethost-node.json', '.pockethost-node-runtime.json', 'releases']);
    const releaseFiles = new Set([
      'package.json', 'package-lock.json', 'server.mjs', '.pockethost-node-source.json',
    ]);
    for (const project of projects) {
      const folder = path.join(root, project.id);
      exact(folder, marker, new Set(['releases']));
      const releases = path.join(folder, 'releases');
      for (const item of readdirSync(releases, { withFileTypes: true })) {
        if (!/^r-[a-f0-9]{32}$/.test(item.name) ||
          !item.isDirectory() || item.isSymbolicLink()) {
          throw new Error('Unexpected release in private Node backup scope');
        }
        const dir = path.join(releases, item.name);
        exact(dir, releaseFiles, new Set());
      }
    }
    if (existsSync(path.join(root, '.node-ports.lock'))) {
      throw new Error('Node deployment in progress: backup refused');
    }
  }
  private requireCreatedProjects(): void {
    this.inspectScope(this.root, this.projects.list());
  }
  private inspectRestored(root: string): number {
    const restored = new NodeProjectHost(root);
    const projects = restored.list();
    this.inspectScope(root, projects);
    for (const project of projects) {
      const releases = restored.candidates(project.id);
      for (const candidate of releases) {
        if (candidate.sourceIntegrity !== 'verified') {
          throw new Error('Restored Node source lacks verified digest');
        }
        restored.release(project.id, candidate.id);
      }
    }
    return projects.length;
  }
  async backup(
    approved: boolean, run: Exec = executeFixed,
  ): Promise<{ output: string }> {
    if (approved !== true) throw new Error('Explicit Node backup approval required');
    this.requireCreatedProjects();
    // The same exclusive lock is used by Node runtime deploy/stop.
    // A crash leaves the lock in place for manual owner reconciliation.
    const lock = path.join(this.root, '.node-ports.lock');
    const fd = openSync(lock, 'wx', 0o600);
    closeSync(fd);
    try {
      const result = await this.restic.backup(run);
      if (result.exit !== 0) throw new Error('Owned Node Restic backup failed');
      return { output: result.output };
    } finally {
      rmSync(lock);
    }
  }
  async snapshots(run: Exec = executeFixed) {
    return this.restic.snapshots(run);
  }
  async restoreToStaging(
    snapshot: string, approved: boolean, run: Exec = executeFixed,
  ): Promise<{ restoredTo: string; verifiedProjects: number }> {
    if (approved !== true) throw new Error('Explicit Node restore approval required');
    const restored = await this.restic.restoreToStaging(snapshot, run);
    // The repo snapshots exactly the private project root basename.
    // Never apply the contents to a live source directory or runit unit.
    const entries = readdirSync(restored.restoredTo);
    if (entries.length !== 1 || entries[0] !== path.basename(this.root)) {
      throw new Error('Unexpected restored Node scope structure');
    }
    const verifiedProjects = this.inspectRestored(
      path.join(restored.restoredTo, path.basename(this.root)),
    );
    return { restoredTo: restored.restoredTo, verifiedProjects };
  }
  async check(run: Exec = executeFixed) {
    return this.restic.check(run);
  }
}
