#!/usr/bin/env node
/**
 * Run only checks affected by an exact Git revision range.
 * Execution is permitted ONLY inside the verified Samsung Termux checkout
 * via the installed Local Agent; --plan is the default.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { planChangedChecks } from './changed-checks-policy.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const flags = process.argv.slice(2);
const baseArg = flags.find((arg) => arg.startsWith('--base='));
const run = flags.includes('--run');
if (!baseArg || !/^--base=[0-9a-f]{7,40}$/.test(baseArg) ||
    flags.some((arg) => arg !== baseArg && arg !== '--run')) {
  console.error('Usage: node scripts/dev/changed-checks.mjs --base=<verified-sha> [--run]');
  process.exit(2);
}
const base = baseArg.slice('--base='.length);

function git(...args) {
  const result = spawnSync('git', args, {
    cwd: root, encoding: 'utf8', timeout: 20000, maxBuffer: 4 * 1024 * 1024,
  });
  if (result.error || result.status !== 0) {
    throw new Error('Git verification failed: ' + args[0] + ' ' + args[1]);
  }
  return result.stdout;
}

function resolveImport(from, spec, tracked) {
  let target;
  if (spec.startsWith('@/')) {
    target = path.join(root, 'apps/admin/src', spec.slice(2));
  } else if (spec.startsWith('./') || spec.startsWith('../')) {
    target = path.resolve(root, path.dirname(from), spec);
  } else return null;
  const relative = path.relative(root, target).split(path.sep).join('/');
  if (!relative || relative.startsWith('../') || path.isAbsolute(relative)) return null;
  for (const candidate of [
    relative, relative + '.ts', relative + '.tsx', relative + '.js',
    relative + '.mjs', relative + '.json', relative + '.css',
    relative + '/index.ts', relative + '/index.tsx',
    relative + '/index.js',
  ]) {
    if (tracked.has(candidate)) return candidate;
  }
  return null;
}

function importDependencies(source, file, tracked) {
  const matches = source.matchAll(
    /\bfrom\s+['"]([^'"]+)['"]|\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)|\bimport\s*['"]([^'"]+)['"]|\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g
  );
  const found = new Set();
  for (const match of matches) {
    const spec = match[1] || match[2] || match[3] || match[4];
    const resolved = resolveImport(file, spec, tracked);
    if (resolved) found.add(resolved);
  }
  return [...found];
}

function buildTestDependencies(head) {
  const cacheDir = path.join(root, '.tmp');
  const cache = path.join(cacheDir, 'changed-checks-' + head + '.json');
  if (existsSync(cache)) {
    try {
      const parsed = JSON.parse(readFileSync(cache, 'utf8'));
      if (parsed.head === head && parsed.dependencies &&
          typeof parsed.dependencies === 'object') return parsed.dependencies;
    } catch { /* Corrupt cache is rebuilt, never treated as evidence. */ }
  }
  const files = git('ls-files', '-z').split('\0').filter(Boolean);
  const tracked = new Set(files);
  const sourceFiles = files.filter((file) =>
    /^(?:src\/|apps\/admin\/src\/|tests\/quality\/|apps\/admin\/tests\/|scripts\/)/.test(file) &&
    /\.(?:ts|tsx|js|jsx|mjs|css)$/.test(file)
  );
  const edges = new Map();
  for (const file of sourceFiles) {
    const full = path.join(root, file);
    if (!existsSync(full)) continue;
    edges.set(file, importDependencies(readFileSync(full, 'utf8'), file, tracked));
  }
  const tests = sourceFiles.filter((file) =>
    /^tests\/quality\/.*\.test\.mjs$/.test(file) ||
    /^apps\/admin\/tests\/.*\.test\.(?:ts|tsx)$/.test(file)
  );
  const dependencies = {};
  for (const test of tests) {
    const visited = new Set();
    const queue = [test];
    while (queue.length) {
      const next = queue.pop();
      if (visited.has(next)) continue;
      visited.add(next);
      for (const imported of edges.get(next) || []) {
        if (!visited.has(imported)) queue.push(imported);
      }
    }
    dependencies[test] = [...visited].sort();
  }
  mkdirSync(cacheDir, { recursive: true });
  writeFileSync(cache, JSON.stringify({ head, dependencies }), { mode: 0o600 });
  return dependencies;
}

function main() {
  if (git('rev-parse', '--show-toplevel').trim() !== root) {
    throw new Error('Not the PocketHost checkout root');
  }
  if (git('status', '--porcelain').trim()) {
    throw new Error('Use a clean exact-SHA checkout; no implicit test of dirty sources');
  }
  const head = git('rev-parse', 'HEAD').trim();
  git('rev-parse', '--verify', base + '^{commit}');
  git('merge-base', '--is-ancestor', base, head);
  const paths = git('diff', '--name-only', '--no-renames',
    '--diff-filter=ACDMRT', '-z', base, head).split('\0').filter(Boolean);
  if (!paths.length) {
    console.log(JSON.stringify({ base, head, changed: [], state: 'NO_CHANGES' }));
    return;
  }
  const plan = planChangedChecks(paths, buildTestDependencies(head));
  console.log(JSON.stringify({ base, head, ...plan, mode: run ? 'run' : 'plan' }, null, 2));
  if (!run) return;
  // Keep the incremental TypeScript cache across Local Agent invocations.
  mkdirSync(path.join(root, '.tmp'), { recursive: true });
  for (const check of plan.commands) {
    const [command, ...args] = check.argv;
    const result = spawnSync(command, args, {
      cwd: path.join(root, check.cwd),
      encoding: 'utf8', timeout: 180000, maxBuffer: 1024 * 1024,
    });
    const ok = !result.error && result.status === 0;
    console.log(JSON.stringify({
      label: check.label, status: ok ? 'PASS' : 'FAIL',
      code: result.status, error: result.error?.message ?? null,
      output: ok ? (result.stdout ?? '').slice(-900) :
        ((result.stdout ?? '') + (result.stderr ?? '')).slice(-5000),
    }));
    if (!ok) { process.exitCode = 1; return; }
  }
  if (plan.review.length) {
    console.error('MANUAL_REVIEW required: ' + plan.review.join('; '));
    process.exitCode = 2;
  }
}
try { main(); } catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 2;
}
