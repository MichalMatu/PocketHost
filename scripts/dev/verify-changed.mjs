#!/usr/bin/env node
/**
 * One-shot Samsung Local Agent gate. Reuses the existing changed-checks
 * dependency graph. PLAN ONLY unless an independent, owner-approved exact-SHA
 * --execute invocation is provided. Never called by FAST FLOW deployment.
 * NEVER installs packages, deploys, restarts processes, or changes services.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { prepareChangedVerification, runChangedVerification } from './verify-changed-policy.mjs';
import { resolveTermuxCheckCommand } from './termux-check-command.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const argv = process.argv.slice(2);
const baseFlag = argv.filter((x) => x.startsWith('--base='));
const executeFlags = argv.filter((x) => x === '--execute');
const approvalFlags = argv.filter((x) => x.startsWith('--approved-head='));
const execute = executeFlags.length === 1;
const approvedHead = approvalFlags[0]?.slice('--approved-head='.length);
const planOnly = !execute;
const adminLint = argv.includes('--admin-lint');
const timeoutFlag = argv.filter((x) => x.startsWith('--timeout-ms='));
const allowed = argv.every(
  (x) =>
    x.startsWith('--base=') ||
    x.startsWith('--timeout-ms=') ||
    x === '--plan' ||
    x === '--admin-lint' ||
    x === '--execute' ||
    x.startsWith('--approved-head='),
);
const base = baseFlag[0]?.slice('--base='.length);
const timeoutMs = timeoutFlag.length
  ? Number(timeoutFlag[0].slice('--timeout-ms='.length))
  : 180000;
const optionsValid =
  allowed &&
  baseFlag.length === 1 &&
  /^[0-9a-f]{7,40}$/.test(base ?? '') &&
  executeFlags.length <= 1 &&
  approvalFlags.length <= 1 &&
  (execute ? approvalFlags.length === 1 && /^[0-9a-f]{40}$/.test(approvedHead ?? '') : approvalFlags.length === 0) &&
  !(execute && argv.includes('--plan')) &&
  timeoutFlag.length <= 1 &&
  Number.isSafeInteger(timeoutMs) &&
  timeoutMs >= 30000 &&
  timeoutMs <= 300000;

function command(file, args, cwd, timeout = timeoutMs) {
  return spawnSync(file, args, {
    cwd,
    encoding: 'utf8',
    timeout,
    maxBuffer: 2 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function emit(report, code) {
  const receipt = { kind: 'PocketHostVerifyChanged', ...report };
  if (!planOnly && process.platform === 'android') {
    const dir = path.join(root, '.tmp');
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, 'verify-changed-last.json'), JSON.stringify(receipt) + '\n', {
      mode: 0o600,
    });
  }
  console.log(JSON.stringify(receipt));
  process.exitCode = code;
}

function tail(output) {
  // Compact terminal evidence; never print full command output.
  const ansi = new RegExp(String.fromCharCode(27) + '\\[[0-9;]*m', 'g');
  return String(output ?? '')
    .replace(ansi, '')
    .slice(-1800);
}

if (!optionsValid) {
  emit(
    {
      status: 'INVALID_ARGUMENTS',
      reason:
        'Plan only by default. Tests: --base=<sha> --execute --approved-head=<exact-40-hex-target-sha> (only after fresh explicit owner consent)',
    },
    2,
  );
} else if (!planOnly && process.platform !== 'android') {
  emit(
    {
      status: 'HOLD',
      reason:
        'Manual testing is allowed only on Samsung Termux through Local Agent with fresh owner approval.',
    },
    2,
  );
} else {
  try {
    const started = Date.now();
    const preview = command(
      process.execPath,
      ['scripts/dev/changed-checks.mjs', '--base=' + base, ...(adminLint ? ['--admin-lint'] : [])],
      root,
      60000,
    );
    if (preview.error || preview.status !== 0) {
      throw new Error(
        'Changed-source planning failed: ' +
          tail(preview.stderr || preview.error?.message || preview.stdout),
      );
    }
    const plan = JSON.parse(preview.stdout);
    if (!/^[0-9a-f]{40}$/.test(plan.head ?? '')) throw new Error('Invalid planned HEAD');
    if (execute && plan.head !== approvedHead)
      throw new Error('Test approval is pinned to another source SHA; no tests executed');
    const prepared = prepareChangedVerification(plan);
    const common = {
      base,
      head: plan.head,
      changed: plan.changed,
      review: prepared.review,
      plannedChecks: prepared.checks.map((x) => x.label),
      adminLint: adminLint ? 'opt-in' : 'deferred',
    };
    if (prepared.review.length) {
      emit(
        {
          ...common,
          status: 'MANUAL_REVIEW',
          reason: 'Unmapped or high-risk changes require explicit review; no checks executed.',
          durationMs: Date.now() - started,
        },
        planOnly ? 0 : 2,
      );
    } else if (planOnly) {
      emit(
        {
          ...common,
          status: plan.changed.length ? 'PLAN' : 'NO_CHANGES',
          durationMs: Date.now() - started,
        },
        0,
      );
    } else if (plan.changed.length === 0) {
      emit({ ...common, status: 'NO_CHANGES', checks: [], durationMs: Date.now() - started }, 0);
    } else {
      const before = command('git', ['rev-parse', 'HEAD'], root, 10000);
      const clean = command('git', ['status', '--porcelain'], root, 10000);
      if (
        before.status !== 0 ||
        before.stdout.trim() !== plan.head ||
        clean.status !== 0 ||
        clean.stdout.trim()
      ) {
        throw new Error('Checkout changed after the plan; verification refused');
      }
      const result = runChangedVerification(prepared.checks, (check) => {
        const began = Date.now();
        const resolved = resolveTermuxCheckCommand(check, root, process.execPath);
        const output = command(resolved.file, resolved.args, path.join(root, check.cwd));
        const ok = !output.error && output.status === 0;
        const diagnosticOutput = [output.stdout, output.stderr, output.error?.message]
          .filter(Boolean)
          .join('\n');
        return {
          ok,
          code: output.status,
          elapsedMs: Date.now() - began,
          ...(ok ? {} : { error: tail(diagnosticOutput || 'Command failed') }),
        };
      });
      emit(
        { ...common, ...result, durationMs: Date.now() - started },
        result.status === 'PASS' ? 0 : 1,
      );
    }
  } catch (error) {
    emit({ status: 'HOLD', base, reason: String(error?.message ?? error).slice(0, 2200) }, 2);
  }
}
