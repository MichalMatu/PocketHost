import { spawnSync } from 'node:child_process';
import { lstatSync, realpathSync } from 'node:fs';
import path from 'node:path';

const GIT = '/data/data/com.termux/files/usr/bin/git';
export interface GitWorkspaceObservation {
  version: 1;
  mode: 'read-only';
  scope: 'running-panel-checkout';
  observedAt: string;
  git: 'available' | 'unavailable';
  checkout: 'clean' | 'dirty' | 'unverified';
  branch: 'attached' | 'detached' | 'unverified';
  origin: 'github' | 'other' | 'missing' | 'unverified';
  head: string | null;
  credentials: 'not-checked';
  remoteConnectivity: 'not-checked';
  operations: 'none';
}

/** One fixed local repository, no user paths, Git hooks or network access. */
export function inspectLocalGitWorkspace(): GitWorkspaceObservation {
  const observed: GitWorkspaceObservation = {
    version: 1,
    mode: 'read-only',
    scope: 'running-panel-checkout',
    observedAt: new Date().toISOString(),
    git: 'unavailable',
    checkout: 'unverified',
    branch: 'unverified',
    origin: 'unverified',
    head: null,
    credentials: 'not-checked',
    remoteConnectivity: 'not-checked',
    operations: 'none',
  };
  try {
    const admin = process.cwd();
    const root = path.resolve(admin, '../..');
    if (path.basename(admin) !== 'admin' || path.basename(path.dirname(admin)) !== 'apps')
      return observed;
    const uid = process.getuid?.();
    if (typeof uid !== 'number') return observed;
    for (const directory of [root, path.join(root, 'apps'), admin]) {
      const s = lstatSync(directory);
      if (
        !s.isDirectory() ||
        s.isSymbolicLink() ||
        s.uid !== uid ||
        (s.mode & 0o022) !== 0 ||
        realpathSync(directory) !== directory
      )
        return observed;
    }
    const binary = lstatSync(GIT);
    if (!binary.isFile() || binary.isSymbolicLink() || (binary.mode & 0o111) === 0) return observed;
    const command = (args: string[]) =>
      spawnSync(GIT, ['--no-optional-locks', '-c', 'core.fsmonitor=false', ...args], {
        cwd: root,
        encoding: 'utf8',
        shell: false,
        timeout: 1800,
        maxBuffer: 8192,
        env: { ...process.env, GIT_OPTIONAL_LOCKS: '0', GIT_TERMINAL_PROMPT: '0' },
      });
    const top = command(['rev-parse', '--show-toplevel']);
    if (top.error || top.status !== 0 || top.stdout.trim() !== root) return observed;
    observed.git = 'available';
    const head = command(['rev-parse', '--verify', 'HEAD']);
    if (!head.error && head.status === 0 && /^[a-f0-9]{40}$/.test(head.stdout.trim()))
      observed.head = head.stdout.trim();
    const status = command(['status', '--porcelain=v1', '--untracked-files=normal']);
    if (!status.error && status.status === 0)
      observed.checkout = status.stdout.length === 0 ? 'clean' : 'dirty';
    const branch = command(['symbolic-ref', '-q', '--short', 'HEAD']);
    if (!branch.error && (branch.status === 0 || branch.status === 1))
      observed.branch = branch.status === 0 ? 'attached' : 'detached';
    const remote = command(['config', '--local', '--get', 'remote.origin.url']);
    if (!remote.error && (remote.status === 0 || remote.status === 1)) {
      const url = remote.stdout.trim();
      const github =
        /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\.git)?\/?$/.test(url) ||
        /^git@github\.com:[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\.git)?$/.test(url);
      observed.origin = remote.status === 1 ? 'missing' : github ? 'github' : 'other';
    }
  } catch {
    // Never disclose errors, host paths, branch names or remote credentials.
  }
  return observed;
}
