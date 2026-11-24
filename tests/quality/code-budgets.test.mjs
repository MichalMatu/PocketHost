import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { validateCodeBudgets } from '../../scripts/quality/check-code-budgets.mjs';

function withTree(fn) {
  const folder = mkdtempSync(path.join(os.tmpdir(), 'pockethost-quality-'));
  const put = (file, contents) => {
    const absolute = path.join(folder, file);
    mkdirSync(path.dirname(absolute), { recursive: true });
    writeFileSync(absolute, contents);
  };
  try {
    return fn(put, folder);
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
}

test('short isolated modules pass', () =>
  withTree((put, root) => {
    put('src/modules/host/ok.ts', 'export const safe = true;\n');
    put('apps/admin/src/app/ok.ts', 'export const ui = true;\n');
    assert.deepEqual(validateCodeBudgets(root), []);
  }));

test('oversized new source fails closed', () =>
  withTree((put, root) => {
    put('src/modules/host/too-big.ts', 'x'.repeat(24577));
    assert.match(validateCodeBudgets(root).join('\n'), /Oversized code file/);
  }));

test('browser code cannot import host-only Node APIs', () =>
  withTree((put, root) => {
    put('apps/admin/src/app/unsafe.ts', "import { readFileSync } from 'node:fs';\n");
    assert.match(validateCodeBudgets(root).join('\n'), /Host-only import/);
  }));

test('Vite composition has the standard new-source budget', () =>
  withTree((put, root) => {
    put('apps/admin/vite.config.ts', 'x'.repeat(24 * 1024 + 1));
    assert.match(validateCodeBudgets(root).join('\n'), /Oversized code file/);
  }));

test('an oversized legacy file may not grow', () =>
  withTree((put, root) => {
    put('src/modules/host/site-fleet-host.ts', 'x'.repeat(27960));
    assert.match(validateCodeBudgets(root).join('\n'), /Oversized code file/);
  }));
