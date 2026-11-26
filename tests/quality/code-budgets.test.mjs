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

test('browser module boundary covers dynamic imports, re-exports, aliases and bare builtins', () =>
  withTree((put, root) => {
    const cases = [
      ['lazy.ts', "const load = () => import('node:fs/promises');"],
      ['bare.ts', "import { spawn } from 'child_process';"],
      ['reexport.ts', "export { host } from '../../../../src/modules/host/private.ts';"],
      ['alias.ts', "import('@/../../../src/modules/host/private.ts');"],
      ['plugin.ts', "import('../../plugins/termux-admin-api.ts');"],
      ['require.js', "const host = require('node:os');"],
      ['typed.ts', "type Host = import('node:net').Socket;"],
      ['multiline.ts', "import {\n  readFileSync\n} from 'fs';"],
    ];
    for (const [file, source] of cases) put('apps/admin/src/app/' + file, source);
    const errors = validateCodeBudgets(root);
    assert.equal(errors.length, cases.length);
    for (const [file] of cases) {
      assert.ok(
        errors.some((error) => error.includes('app/' + file + ' (')),
        file,
      );
    }
  }));

test('computed imports are not silently accepted by the browser boundary', () =>
  withTree((put, root) => {
    put('apps/admin/src/app/lazy.ts', 'const load = (name) => import(name);');
    assert.match(validateCodeBudgets(root).join('\n'), /Non-literal module import/);
  }));

test('browser lazy UI imports, shared types and comments remain allowed', () =>
  withTree((put, root) => {
    put(
      'apps/admin/src/app/page.ts',
      [
        "const load = () => import('@/app/other');",
        "import type { Shared } from '../../../../src/shared/types.ts';",
        'const text = "import(\'node:fs\')";',
        "// import('node:fs');",
      ].join('\n'),
    );
    put('apps/admin/plugins/api.ts', "import { readFileSync } from 'node:fs';");
    assert.deepEqual(validateCodeBudgets(root), []);
  }));

test('Node workspace rejects oversized modules, reversed dependencies and view transport', () =>
  withTree((put, root) => {
    const base = 'apps/admin/src/app/projects/';
    put(base + 'page.tsx', '\n'.repeat(120));
    put(base + 'views/large.tsx', '\n'.repeat(350));
    put(base + 'state/controller.ts', "import { View } from '../views/view';");
    put(base + 'views/view.tsx', "fetch('/api/v1/node-projects');");
    const errors = validateCodeBudgets(root).join('\n');
    assert.match(errors, /Node workspace line budget: .*page\.tsx/);
    assert.match(errors, /Node workspace line budget: .*large\.tsx/);
    assert.match(errors, /Node workspace reverse dependency/);
    assert.match(errors, /Node workspace direct transport in view/);
  }));

test('current repository satisfies code budgets', () => {
  assert.deepEqual(validateCodeBudgets(), []);
});
