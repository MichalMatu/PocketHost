#!/usr/bin/env node
/**
 * PocketHost owner-only DEV UI sync. Manual opt-in; no process restart, no service operations.
 * Syncs only frontend/UI/docs changes from the canonical GitHub main to a clean live checkout.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { classifyUiChanges, isPocketHostOrigin, procStartTicks } from './ui-sync-policy.mjs';

const root = fs.realpathSync(process.cwd());
const args = process.argv.slice(2);
const watch = args.includes('--watch');
const dryRun = args.includes('--dry-run');
const configuredInterval = args.find((arg) => arg.startsWith('--interval-ms='));
const ms = configuredInterval ? Number(configuredInterval.split('=')[1]) : 8000;
if (
  args.some(
    (arg) => !['--watch', '--once', '--dry-run'].includes(arg) && !arg.startsWith('--interval-ms='),
  )
) {
  throw new Error('Only --once, --watch, --dry-run, --interval-ms are supported');
}
if (!Number.isSafeInteger(ms) || ms < 5000 || ms > 120000) {
  throw new Error('Poll interval must be 5000..120000 ms');
}
if (args.includes('--once') && watch) throw new Error('Choose --watch or --once');
const ownerFile =
  process.env.POCKETHOST_DEV_PANEL_RECORD ||
  path.join(path.dirname(root), 'PocketHost-P3-Preview-20261106.json');
// A live DEV checkout can be a Git worktree: its .git is a pointer file.
const gitDirInfo = spawnSync('git', ['rev-parse', '--absolute-git-dir'], {
  cwd: root,
  encoding: 'utf8',
  timeout: 10000,
});
if (gitDirInfo.error || gitDirInfo.status !== 0 || !gitDirInfo.stdout.trim()) {
  throw new Error('Require a verified PocketHost Git checkout');
}
const gitDir = fs.realpathSync(gitDirInfo.stdout.trim());
if (!fs.statSync(gitDir).isDirectory()) {
  throw new Error('Git metadata directory is unavailable');
}
const lockPath = path.join(gitDir, 'pockethost-ui-sync.lock');
const lock = fs.openSync(lockPath, 'wx', 0o600);
fs.writeSync(lock, String(process.pid) + '\n');
let stopped = false;

function cleanExit() {
  try {
    fs.closeSync(lock);
  } catch {
    /* Best-effort cleanup on exit. */
  }
  try {
    fs.unlinkSync(lockPath);
  } catch {
    /* The lock may already be gone. */
  }
}
process.once('exit', cleanExit);
process.once('SIGTERM', () => {
  stopped = true;
});
process.once('SIGINT', () => {
  stopped = true;
});

function git(...argv) {
  const result = spawnSync('git', argv, {
    cwd: root,
    encoding: 'utf8',
    timeout: 50000,
    maxBuffer: 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.error || result.status !== 0) {
    throw new Error('Git command refused: ' + argv[0]);
  }
  return result.stdout.trim();
}

function assertOwnedPanel() {
  if (fs.lstatSync(ownerFile).isSymbolicLink()) throw new Error('Owner record is linked');
  const owner = JSON.parse(fs.readFileSync(ownerFile, 'utf8'));
  if (
    owner.cwd !== path.join(root, 'apps/admin') ||
    owner.port !== 8787 ||
    !Number.isSafeInteger(owner.pid) ||
    owner.pid <= 1 ||
    typeof owner.startTicks !== 'string'
  ) {
    throw new Error('PocketHost panel owner record mismatch');
  }
  const proc = '/proc/' + owner.pid;
  const stat = fs.readFileSync(proc + '/stat', 'utf8');
  if (
    procStartTicks(stat) !== owner.startTicks ||
    fs.realpathSync(proc + '/cwd') !== path.join(root, 'apps/admin')
  ) {
    throw new Error('PocketHost panel process identity changed');
  }
}

function sync() {
  if (!isPocketHostOrigin(git('remote', 'get-url', 'origin'))) {
    throw new Error('Checkout is not the approved PocketHost origin');
  }
  if (git('rev-parse', '--show-toplevel') !== root || git('status', '--porcelain')) {
    throw new Error('Checkout identity changed or worktree is dirty');
  }
  assertOwnedPanel();
  const before = git('rev-parse', 'HEAD');
  git('fetch', '--quiet', '--no-tags', 'origin', 'main');
  const target = git('rev-parse', 'FETCH_HEAD');
  if (!/^[0-9a-f]{40}$/.test(target)) throw new Error('Invalid upstream SHA');
  if (before === target) return { state: 'CURRENT', sha: before };
  git('merge-base', '--is-ancestor', before, target);
  const diff = spawnSync('git', ['diff', '--name-only', '--no-renames', '-z', before, target], {
    cwd: root,
    encoding: 'utf8',
    timeout: 10000,
  });
  if (diff.status !== 0 || diff.error) throw new Error('Cannot inspect source delta');
  const files = diff.stdout.split('\0').filter(Boolean);
  const checked = classifyUiChanges(files);
  if (!checked.allowed) {
    return {
      state: 'MANUAL_REVIEW',
      sha: before,
      target,
      paths: checked.refused.slice(0, 10),
    };
  }
  for (const file of files) {
    const entry = spawnSync('git', ['ls-tree', '-z', target, '--', file], {
      cwd: root,
      encoding: 'utf8',
      timeout: 10000,
    });
    if (entry.status !== 0 || entry.error || entry.stdout.startsWith('120000 ')) {
      throw new Error('Unsupported linked or unreadable UI change');
    }
  }
  if (dryRun) return { state: 'READY', sha: before, target, files: files.length };
  if (git('status', '--porcelain')) throw new Error('Live checkout changed during fetch');
  git('switch', '--quiet', '--detach', target);
  if (git('rev-parse', 'HEAD') !== target || git('status', '--porcelain')) {
    throw new Error('Sync did not reach a clean exact SHA');
  }
  return { state: 'SYNCED', from: before, sha: target, files: files.length };
}

function emit(result) {
  process.stdout.write(
    JSON.stringify({
      at: new Date().toISOString(),
      type: 'pockethost-dev-ui-sync',
      ...result,
    }) + '\n',
  );
}
async function main() {
  let lastFailure = '';
  do {
    try {
      const result = sync();
      if (result.state !== 'CURRENT' || !watch) emit(result);
      lastFailure = '';
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'unknown';
      if (reason !== lastFailure) emit({ state: 'HOLD', reason });
      lastFailure = reason;
      if (!watch) process.exitCode = 1;
    }
    if (!watch || stopped) break;
    await new Promise((resolve) => setTimeout(resolve, ms));
  } while (!stopped);
}
await main();
