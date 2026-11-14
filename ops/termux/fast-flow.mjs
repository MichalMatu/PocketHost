#!/usr/bin/env node
/**
 * One Samsung Local Agent task: code → guarded DEV deployment → read-only
 * live-revision verification and one terminal receipt. Tests are opt-in
 * ONLY after the owner explicitly authorizes them.
 * Never installs dependencies, touches foreign services or runs a new server.
 */
import { spawnSync } from 'node:child_process';
import { lstatSync, readFileSync, realpathSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SHA = /^[0-9a-f]{40}$/;
const ORIGIN = 'https://github.com/MichalMatu/PocketHost.git';
const HOME = os.homedir();
const PREFIX = '/data/data/com.termux/files/usr';
const QA = path.join(HOME, 'Projects/PocketHost-H3-QA-20261107');
const OWNER_FILE = path.join(HOME, 'Projects/PocketHost-P3-Preview-20261106.json');
const RELEASE_SCRIPT = path.join(QA, 'ops/termux/refresh-panel.mjs');

export function parseFastFlowArgs(argv) {
  if (!Array.isArray(argv) || argv.length < 3 || argv.length > 4 ||
      argv.some(value => typeof value !== 'string') ||
      argv.filter(value => value.startsWith('--base=')).length !== 1 ||
      argv.filter(value => value.startsWith('--target=')).length !== 1 ||
      argv.filter(value => value === '--apply').length !== 1 ||
      argv.filter(value => value === '--tests').length > 1 ||
      argv.some(value => !(value.startsWith('--base=') ||
        value.startsWith('--target=') || value === '--apply' ||
        value === '--tests')))
    throw Error('Require --base=<40-hex-SHA> --target=<40-hex-SHA> --apply [--tests]');
  const base = argv.find(value => value.startsWith('--base=')).slice(7);
  const target = argv.find(value => value.startsWith('--target=')).slice(9);
  if (!SHA.test(base) || !SHA.test(target) || base === target)
    throw Error('Source SHAs must be distinct and exactly 40 lowercase hex characters');
  return { base, target, apply: true, tests: argv.includes('--tests') };
}

export function confirmFocusedQa(receipt, base, target) {
  if (!receipt || receipt.kind !== 'PocketHostVerifyChanged' ||
      receipt.status !== 'PASS' || receipt.base !== base ||
      receipt.head !== target || !Array.isArray(receipt.changed) ||
      receipt.changed.length === 0 || !Array.isArray(receipt.checks) ||
      receipt.checks.length === 0 || !Array.isArray(receipt.plannedChecks) ||
      receipt.plannedChecks.length !== receipt.checks.length ||
      receipt.plannedChecks.some((label, index) =>
        label !== receipt.checks[index]?.label ||
        receipt.checks[index]?.status !== 'PASS') ||
      !Array.isArray(receipt.review) || receipt.review.length !== 0)
    throw Error('Missing or mismatched exact-source QA evidence');
  return receipt.checks.map(item => item.label);
}

export function confirmPreflight(info, liveSha) {
  if (!info || info.status !== 'READ_ONLY_READY' || info.mode !== 'read-only' ||
      info.ownedPanel !== 'verified' || info.markerSha !== liveSha ||
      info.checkoutSha !== liveSha || info.sourceDrift !== 'same' ||
      info.panelHttp !== 'reachable' || info.protectedServices !== 'running' ||
      info.deployment !== 'not-performed' || info.restart !== 'not-performed')
    throw Error('Owner or protected-services preflight refused');
  return true;
}

export function confirmRelease(info, sha) {
  if (!info || !['PASS', 'CURRENT'].includes(info.status) || info.sha !== sha ||
      (info.status === 'PASS' && (info.lanHttp !== 200 || info.external !== 'unchanged')))
    throw Error('Guarded refresh did not prove target and service invariants');
  return true;
}

function invoke(binary, argv, cwd, timeoutMs = 20000) {
  const started = Date.now();
  const out = spawnSync(binary, argv, {
    cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
    timeout: timeoutMs, maxBuffer: 2 * 1024 * 1024,
  });
  return { ...out, elapsedMs: Date.now() - started };
}

function git(root, ...argv) {
  const out = invoke(path.join(PREFIX, 'bin/git'), argv, root);
  if (out.error || out.status !== 0)
    throw Error('Git prerequisite failed: ' + argv[0]);
  return out.stdout.trim();
}

function receipt(out, label) {
  try { return JSON.parse(out.stdout.trim()); }
  catch { throw Error(label + ' did not produce one JSON receipt'); }
}

function liveRoot() {
  const stat = lstatSync(OWNER_FILE);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size < 2 || stat.size > 16384)
    throw Error('Owner record not a safe fixed file');
  const owner = JSON.parse(readFileSync(OWNER_FILE, 'utf8'));
  if (owner?.managedBy !== 'termux-runit/pockethost-panel' ||
      typeof owner.cwd !== 'string') throw Error('Live owner not attested');
  const root = path.dirname(path.dirname(owner.cwd));
  if (!root.startsWith(path.join(HOME, 'Projects') + path.sep) ||
      !/^PocketHost-[a-zA-Z0-9-]+$/.test(path.basename(root)) ||
      owner.cwd !== path.join(root, 'apps/admin') || root === QA ||
      lstatSync(root).isSymbolicLink() || realpathSync(root) !== root)
    throw Error('Unexpected live checkout identity');
  return root;
}

async function fastFlow(options) {
  const started = Date.now();
  const report = {
    kind: 'PocketHostFastFlow', baseSha: options.base,
    sourceSha: options.target, status: 'HOLD', stage: 'prerequisites',
    deployment: 'not-started', protectedServices: 'not-modified',
    tests: options.tests ? 'requested-by-owner' : 'not-run', qaChecks: [],
  };
  try {
    const entryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
    if (process.platform !== 'android' || process.cwd() !== QA ||
        realpathSync(QA) !== QA || realpathSync(entryRoot) !== QA)
      throw Error('Only the existing verified Samsung Termux QA checkout can run this flow');
    if (git(QA, 'remote', 'get-url', 'origin') !== ORIGIN ||
        git(QA, 'rev-parse', '--show-toplevel') !== QA ||
        git(QA, 'status', '--porcelain') !== '' ||
        git(QA, 'rev-parse', 'HEAD') !== options.target ||
        git(QA, 'rev-parse', 'FETCH_HEAD') !== options.target)
      throw Error('QA origin, clean pinned source or remote main mismatched');
    const live = liveRoot();
    if (git(live, 'remote', 'get-url', 'origin') !== ORIGIN ||
        git(live, 'status', '--porcelain') !== '' ||
        git(live, 'rev-parse', 'HEAD') !== options.base)
      throw Error('Live owner checkout no longer matches the selected base');
    const ancestor = invoke(path.join(PREFIX, 'bin/git'),
      ['merge-base', '--is-ancestor', options.base, options.target], QA);
    if (ancestor.error || ancestor.status !== 0)
      throw Error('Pinned target is not a descendant of current panel');

    const pre = invoke(process.execPath, [RELEASE_SCRIPT, '--preflight'], live, 60000);
    if (pre.error || pre.status !== 0) throw Error('Owner preflight refused');
    confirmPreflight(receipt(pre, 'Preflight'), options.base);
    if (options.tests) {
      // Never enter this branch in the default code → deploy → verify cycle.
      // The caller must have explicit owner authorization for --tests.
      report.stage = 'owner-authorized-tests';
      const checks = invoke(process.execPath,
        ['scripts/dev/verify-changed.mjs', '--base=' + options.base], QA, 550000);
      if (checks.error || checks.status !== 0) {
        try {
          const failed = receipt(checks, 'Focused QA');
          report.failedCheck = failed.failedAt ?? null;
          report.qaReason = String(failed.reason ?? failed.status ?? 'unknown').slice(0, 130);
        } catch { report.qaReason = 'No valid QA result'; }
        throw Error('Owner-authorized tests failed; release prohibited');
      }
      report.qaChecks = confirmFocusedQa(receipt(checks, 'Focused QA'),
        options.base, options.target);
      report.qaMs = checks.elapsedMs;
      report.tests = 'PASS';
    }

    report.stage = 'guarded-refresh';
    report.deployment = 'attempted';
    const refreshed = invoke(process.execPath, [RELEASE_SCRIPT, options.target], live, 490000);
    const release = receipt(refreshed, 'Guarded refresh');
    report.refreshStatus = release.status;
    report.rollback = release.rollback ?? 'not-reported';
    if (refreshed.error || refreshed.status !== 0)
      throw Error('PocketHost guarded refresh failed');
    confirmRelease(release, options.target);
    report.stage = 'read-only-verification';
    const observedSha = git(live, 'rev-parse', 'HEAD');
    if (observedSha !== options.target)
      throw Error('Live checkout no longer matches approved revision');
    report.liveSha = observedSha;
    report.liveHealth = 'verified-by-guarded-refresh';
    report.releaseMs = refreshed.elapsedMs;
    report.deployment = 'applied';
    report.protectedServices = 'verified-unchanged-by-guarded-refresh';
    report.status = 'PASS';
    report.stage = 'complete';
  } catch (error) {
    report.reason = String(error?.message ?? error).slice(0, 180);
  } finally {
    report.totalMs = Date.now() - started;
  }
  return report;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  let options;
  try { options = parseFastFlowArgs(process.argv.slice(2)); }
  catch (error) {
    console.log(JSON.stringify({
      kind: 'PocketHostFastFlow', status: 'HOLD', stage: 'arguments',
      reason: String(error.message).slice(0, 180),
    }));
    process.exitCode = 2;
  }
  if (options) {
    fastFlow(options).then(result => {
      console.log(JSON.stringify(result));
      if (result.status !== 'PASS') process.exitCode = 1;
    }).catch(error => {
      console.log(JSON.stringify({
        kind: 'PocketHostFastFlow', status: 'HOLD', stage: 'exception',
        reason: String(error?.message ?? error).slice(0, 180),
      }));
      process.exitCode = 1;
    });
  }
}
