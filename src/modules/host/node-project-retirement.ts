import {
  closeSync,
  lstatSync,
  mkdirSync,
  openSync,
  realpathSync,
  renameSync,
  rmSync,
  readdirSync,
} from 'node:fs';
import path from 'node:path';
import { absent, checkedDirectory } from './node-runit-storage.ts';
import type { NodeProjectSummary } from './node-project-host.ts';
import type { RuntimeRecord } from './node-runit-records.ts';

export type RemovalApproval = {
  approved: true;
  expectedRevision: number;
  expectedCandidate: string | null;
  expectedActiveRelease: string | null;
};

function release(value: unknown): boolean {
  return value === null || (typeof value === 'string' && /^r-[a-f0-9]{32}$/.test(value));
}

export function removalApproval(value: unknown): RemovalApproval {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new RangeError('Invalid Node removal approval');
  const v = value as Record<string, unknown>;
  if (
    Object.keys(v).sort().join(',') !==
      'approved,expectedActiveRelease,expectedCandidate,expectedRevision' ||
    v.approved !== true ||
    !Number.isSafeInteger(v.expectedRevision) ||
    Number(v.expectedRevision) < 0 ||
    Number(v.expectedRevision) > 30 ||
    !release(v.expectedCandidate) ||
    !release(v.expectedActiveRelease)
  )
    throw new RangeError('Explicit pinned Node removal approval required');
  return v as RemovalApproval;
}

/** Delete from the active catalog, retain source/data/logs. No recursive deletion. */
export async function retireNodeProject(options: {
  root: string;
  id: string;
  approval: unknown;
  inspect: () => NodeProjectSummary;
  record: () => RuntimeRecord | null;
  stopped: () => Promise<boolean>;
  detach: (destination: string) => Promise<void>;
  catalog: () => NodeProjectSummary[];
}): Promise<{ removed: true; id: string; filesRetained: true }> {
  const { root, id } = options;
  const approval = removalApproval(options.approval);
  if (!/^node-[a-f0-9]{32}$/.test(id)) throw new RangeError('Invalid Node project identity');
  checkedDirectory(root);
  const lock = path.join(root, '.node-ports.lock');
  const fd = openSync(lock, 'wx', 0o600);
  closeSync(fd);
  try {
    const project = options.inspect();
    const state = options.record();
    if (
      project.id !== id ||
      project.deploymentCount !== approval.expectedRevision ||
      project.candidateRelease !== approval.expectedCandidate ||
      (state?.activeRelease ?? null) !== approval.expectedActiveRelease
    )
      throw new Error('Project changed before removal');
    if (
      state &&
      (state.desired !== 'stopped' || state.process !== null || !(await options.stopped()))
    )
      throw new Error('Project must be verifiably stopped');
    const source = path.join(root, id);
    if (!absent(path.join(source, '.node-runtime.lock')))
      throw new Error('Runtime operation pending');
    // Sibling quarantine is outside the active source / Restic scope.
    const quarantine = root + '-retired';
    if (absent(quarantine)) mkdirSync(quarantine, { mode: 0o700 });
    checkedDirectory(quarantine);
    if (
      (lstatSync(quarantine).mode & 0o077) !== 0 ||
      realpathSync(quarantine) !== quarantine ||
      readdirSync(quarantine).length >= 32
    )
      throw new Error('Retired project quarantine unavailable');
    const destination = path.join(quarantine, id);
    if (!absent(destination)) throw new Error('Removal already attempted; inspect quarantine');
    // Hold the global lifecycle lock through detach and catalog readback.
    mkdirSync(destination, { mode: 0o700 });
    if (state) await options.detach(path.join(destination, 'unit'));
    renameSync(source, path.join(destination, 'project'));
    if (!absent(source) || options.catalog().some((p) => p.id === id))
      throw new Error('Node removal readback unconfirmed');
    return { removed: true, id, filesRetained: true };
  } finally {
    // A partially retired project must not be automatically replayed.
    // The destination's existence fences a subsequent removal attempt.
    rmSync(lock);
  }
}
