import { lstatSync, readdirSync, realpathSync, type Stats } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { NodeProjectHost } from './node-project-host.ts';

const PROJECT_ID = /^node-[a-f0-9]{32}$/;
const CHILD_NAME = /^[\p{L}\p{N}][\p{L}\p{N}._-]*$/u;
const DATA_FOLDERS = new Set(['uploads', 'db', 'state']);
const MAX_FILES = 200;
const MAX_TOTAL_BYTES = 32 * 1024 * 1024;
const MAX_FILE_BYTES = 16 * 1024 * 1024;
const MAX_DEPTH = 6;

export interface NodeProjectDataScopeReport {
  projectId: string;
  state: 'not-configured' | 'owned-private';
  fileCount: number;
  totalBytes: number;
  backupReady: false;
  consistency: 'offline-required';
}

/**
 * Advisory only: a stopped runit observation is not an atomic DB checkpoint.
 * No caller may treat this review as approval to execute a backup.
 */
export function reviewNodeDataOfflinePrerequisites(
  data: NodeProjectDataScopeReport,
  runtime: {
    state: 'not-provisioned' | 'stopped' | 'running' | 'unknown';
    desired: 'stopped' | 'running';
  },
): {
  status: 'data-not-configured' | 'ownership-unverified' | 'project-not-stopped' | 'manual-review-required';
  runtimeState: 'not-provisioned' | 'stopped' | 'running' | 'unknown';
  snapshotEnabled: false;
} {
  const status = data.state !== 'owned-private'
    ? 'data-not-configured'
    : runtime.state === 'unknown' || runtime.state === 'not-provisioned'
      ? 'ownership-unverified'
      : runtime.state !== 'stopped' || runtime.desired !== 'stopped'
        ? 'project-not-stopped'
        : 'manual-review-required';
  return { status, runtimeState: runtime.state, snapshotEnabled: false };
}

/** Read-only inspection: data is separate from immutable Node releases and source Restic. */
export class NodeProjectDataScope {
  private readonly projectRoot: string;
  private readonly dataRoot: string;
  private readonly projects: NodeProjectHost;

  constructor(
    projectRoot = path.join(os.homedir(), 'PocketHost-NodeProjects'),
    dataRoot = path.join(os.homedir(), '.local', 'state', 'pockethost', 'node-project-data'),
  ) {
    if (!path.isAbsolute(projectRoot) || !path.isAbsolute(dataRoot)) {
      throw new RangeError('Node data roots must be absolute');
    }
    const codeRoot = path.resolve(projectRoot);
    const mutableRoot = path.resolve(dataRoot);
    if (
      codeRoot === mutableRoot ||
      codeRoot.startsWith(mutableRoot + path.sep) ||
      mutableRoot.startsWith(codeRoot + path.sep)
    ) {
      throw new RangeError('Mutable Node data must be separate from immutable source');
    }
    this.projectRoot = codeRoot;
    this.dataRoot = mutableRoot;
    this.projects = new NodeProjectHost(this.projectRoot);
  }

  private stat(filename: string): Stats | null {
    try {
      return lstatSync(filename);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw error;
    }
  }

  private privateEntry(filename: string, directory: boolean): Stats {
    const stat = this.stat(filename);
    if (
      !stat ||
      stat.isSymbolicLink() ||
      (directory ? !stat.isDirectory() : !stat.isFile() || stat.nlink !== 1) ||
      stat.uid !== process.getuid?.() ||
      (stat.mode & 0o077) !== 0
    ) {
      throw new Error('Unverified private Node project data entry');
    }
    if (directory && realpathSync(filename) !== filename) {
      throw new Error('Noncanonical Node data directory');
    }
    return stat;
  }

  inspect(projectId: string): NodeProjectDataScopeReport {
    if (!PROJECT_ID.test(projectId)) throw new RangeError('Invalid Node project ID');
    if (this.projects.inspect(projectId).id !== projectId) {
      throw new Error('Node project identity mismatch');
    }
    const result: NodeProjectDataScopeReport = {
      projectId,
      state: 'not-configured',
      fileCount: 0,
      totalBytes: 0,
      backupReady: false,
      consistency: 'offline-required',
    };
    const rootStat = this.stat(this.dataRoot);
    if (!rootStat) return result;
    this.privateEntry(this.dataRoot, true);
    // Reject foreign/surprise top-level entries rather than adopting them as owned data.
    for (const entry of readdirSync(this.dataRoot)) {
      if (!PROJECT_ID.test(entry)) throw new Error('Unknown Node data root entry');
      this.privateEntry(path.join(this.dataRoot, entry), true);
    }
    const projectData = path.join(this.dataRoot, projectId);
    if (!this.stat(projectData)) return result;
    this.privateEntry(projectData, true);

    const visit = (directory: string, depth: number): void => {
      if (depth > MAX_DEPTH) throw new RangeError('Node data nesting limit exceeded');
      this.privateEntry(directory, true);
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        if (!CHILD_NAME.test(entry.name) || entry.name.length > 120) {
          throw new Error('Invalid Node mutable data filename');
        }
        if (depth === 0 && !DATA_FOLDERS.has(entry.name)) {
          throw new Error('Unknown Node mutable data category');
        }
        const absolute = path.join(directory, entry.name);
        if (entry.isDirectory()) {
          visit(absolute, depth + 1);
        } else {
          const file = this.privateEntry(absolute, false);
          if (file.size > MAX_FILE_BYTES) throw new RangeError('Node data file budget exceeded');
          result.fileCount += 1;
          result.totalBytes += file.size;
          if (result.fileCount > MAX_FILES || result.totalBytes > MAX_TOTAL_BYTES) {
            throw new RangeError('Node data backup scope budget exceeded');
          }
        }
      }
    };
    visit(projectData, 0);
    result.state = 'owned-private';
    return result;
  }
}
