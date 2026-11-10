import { readdirSync, existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { NodeProjectHost } from './node-project-host.ts';
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
  private requireCreatedProjects(): void {
    const projects = this.projects.list();
    if (projects.length === 0) {
      throw new Error('At least one explicitly created PocketHost Node project is required');
    }
    // Scope is exact, not the whole Termux HOME or a directory containing
    // an unrelated application. Refuse in-flight deployments and foreign files.
    if (!path.isAbsolute(this.root) || this.root.includes('..')) {
      throw new Error('Unsafe Node backup source root');
    }
    const projectIds = new Set(projects.map((project) => project.id));
    const exact = (folder: string, allowed: ReadonlySet<string>, directories: ReadonlySet<string>) => {
      for (const entry of readdirSync(folder, { withFileTypes: true })) {
        if (!allowed.has(entry.name) || entry.isSymbolicLink()) {
          throw new Error('Unexpected entry in private Node backup scope');
        }
        if (directories.has(entry.name) ? !entry.isDirectory() : !entry.isFile()) {
          throw new Error('Invalid owned Node backup entry');
        }
      }
    };
    exact(this.root, projectIds, projectIds);
    const marker = new Set(['.pockethost-node.json', '.pockethost-node-runtime.json', 'releases']);
    const releaseFiles = new Set([
      'package.json', 'package-lock.json', 'server.mjs', '.pockethost-node-source.json',
    ]);
    for (const project of projects) {
      const folder = path.join(this.root, project.id);
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
    if (existsSync(path.join(this.root, '.node-ports.lock'))) {
      throw new Error('Node deployment in progress: backup refused');
    }
  }
  async backup(
    approved: boolean, run: Exec = executeFixed,
  ): Promise<{ output: string }> {
    if (approved !== true) throw new Error('Explicit Node backup approval required');
    this.requireCreatedProjects();
    const result = await this.restic.backup(run);
    if (result.exit !== 0) throw new Error('Owned Node Restic backup failed');
    return { output: result.output };
  }
  async snapshots(run: Exec = executeFixed) {
    return this.restic.snapshots(run);
  }
  async restoreToStaging(
    snapshot: string, approved: boolean, run: Exec = executeFixed,
  ): Promise<{ restoredTo: string }> {
    if (approved !== true) throw new Error('Explicit Node restore approval required');
    return this.restic.restoreToStaging(snapshot, run);
  }
  async check(run: Exec = executeFixed) {
    return this.restic.check(run);
  }
}
