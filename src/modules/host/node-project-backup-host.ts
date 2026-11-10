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
  private readonly projects: NodeProjectHost;
  private readonly restic: ResticWorkspaceAdmin;

  constructor(
    root = path.join(os.homedir(), 'PocketHost-NodeProjects'),
    state = path.join(os.homedir(), '.local', 'state', 'pockethost', 'node-restic'),
  ) {
    this.projects = new NodeProjectHost(root);
    this.restic = new ResticWorkspaceAdmin(
      new WorkspaceFiles(root), state, 'pockethost-node',
    );
  }
  status(): { initialized: boolean; repositoryPresent: boolean; keyPresent: boolean } {
    return this.restic.status();
  }
  private requireCreatedProjects(): void {
    if (this.projects.list().length === 0) {
      throw new Error('At least one explicitly created PocketHost Node project is required');
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
