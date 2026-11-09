import assert from 'node:assert/strict';
import {
  cpSync,
  mkdtempSync,
  rmSync,
  unlinkSync,
  writeFileSync,
  readFileSync,
  mkdirSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { validateStructure, repositoryRoot } from '../../scripts/quality/check-structure.mjs';
import { validateDocs } from '../../scripts/quality/check-docs.mjs';
import { validateBoundaries } from '../../scripts/quality/check-boundaries.mjs';

function fixture(t) {
  const temp = mkdtempSync(path.join(tmpdir(), 'pockethost-quality-'));
  cpSync(repositoryRoot, temp, {
    recursive: true,
    filter: (source) =>
      !source.split(path.sep).some((name) => ['node_modules', '.git', '.tmp'].includes(name)),
  });
  t.after(() => rmSync(temp, { recursive: true, force: true }));
  return temp;
}

test('foundation: valid project structure', () => {
  assert.deepEqual(validateStructure(), []);
});

test('foundation: valid project documentation', () => {
  assert.deepEqual(validateDocs(), []);
});

test('structure rejects missing module agent policy', (t) => {
  const root = fixture(t);
  unlinkSync(path.join(root, 'src/modules/inventory/AGENTS.md'));
  assert.match(
    validateStructure(root).join('\n'),
    /Missing required file: src\/modules\/inventory\/AGENTS.md/,
  );
});

test('structure rejects unregistered module', (t) => {
  const root = fixture(t);
  mkdirSync(path.join(root, 'src/modules/rogue'));
  assert.match(validateStructure(root).join('\n'), /Unexpected module: rogue/);
});

test('structure rejects source artifacts in the wrong directory', (t) => {
  const root = fixture(t);
  writeFileSync(path.join(root, 'src/untracked.txt'), 'not allowed');
  assert.match(
    validateStructure(root).join('\n'),
    /Unsupported source artifact: src\/untracked.txt/,
  );
});

test('docs enforce compact active context without limiting archived evidence', (t) => {
  const root = fixture(t);
  const start = path.join(root, 'docs/START_HERE.md');
  const handoff = path.join(root, 'docs/HANDOFF_NEXT_CHAT.md');
  writeFileSync(start, readFileSync(start, 'utf8') + 'x'.repeat(4000));
  writeFileSync(handoff, readFileSync(handoff, 'utf8') + 'y'.repeat(7000));
  const failures = validateDocs(root).join('\n');
  assert.match(failures, /Context budget exceeded: docs\/START_HERE\.md/);
  assert.match(failures, /Context budget exceeded: docs\/HANDOFF_NEXT_CHAT\.md/);
});

test('docs reject missing frontmatter', (t) => {
  const root = fixture(t);
  const file = path.join(root, 'docs/PRODUCT.md');
  writeFileSync(file, '# Product\n');
  assert.match(validateDocs(root).join('\n'), /Missing YAML frontmatter: docs\/PRODUCT.md/);
});

test('docs reject broken local link', (t) => {
  const root = fixture(t);
  const file = path.join(root, 'docs/ARCHITECTURE.md');
  writeFileSync(file, `${readFileSync(file, 'utf8')}\n[Bad](non-existent.md)\n`);
  assert.match(validateDocs(root).join('\n'), /Broken Markdown link: docs\/ARCHITECTURE.md/);
});

test('docs reject a missing scoped agent section', (t) => {
  const root = fixture(t);
  const file = path.join(root, 'src/ui/AGENTS.md');
  writeFileSync(file, '# UI\n\n## Scope\n\n## Forbidden\n');
  assert.match(validateDocs(root).join('\n'), /Missing agent section ## Gate: src\/ui\/AGENTS.md/);
});

test('docs preserve upstream admin license without applying project heading rules', (t) => {
  const root = fixture(t);
  const vendor = path.join(root, 'apps/admin');
  mkdirSync(vendor, { recursive: true });
  writeFileSync(
    path.join(vendor, 'LICENSE.upstream.md'),
    'MIT License\n\nCopyright (c) upstream\n',
  );
  assert.deepEqual(validateDocs(root), []);
});

test('docs enforce agent instructions for the admin application boundary', (t) => {
  const root = fixture(t);
  const file = path.join(root, 'apps/AGENTS.md');
  writeFileSync(file, '# Admin\n\n## Scope\n\n## Forbidden\n');
  assert.match(validateDocs(root).join('\n'), /Missing agent section ## Gate: apps\/AGENTS.md/);
});

test('structure rejects TypeScript outside declared modules', (t) => {
  const root = fixture(t);
  writeFileSync(path.join(root, 'src/untracked.ts'), 'export const bad = true;');
  assert.match(validateStructure(root).join('\n'), /Unexpected source location: src\/untracked.ts/);
});

test('foundation: module boundaries are valid', () => {
  assert.deepEqual(validateBoundaries(), []);
});

test('boundaries reject importing another module implementation', (t) => {
  const root = fixture(t);
  writeFileSync(
    path.join(root, 'src/modules/inventory/probe.ts'),
    "import '../runtime/service';\n",
  );
  assert.match(
    validateBoundaries(root).join('\n'),
    /Cross-module import in modules\/inventory\/probe.ts/,
  );
});

test('boundaries reject host I/O outside host adapter', (t) => {
  const root = fixture(t);
  writeFileSync(
    path.join(root, 'src/modules/inventory/probe.ts'),
    "import { execFile } from 'node:child_process';\n",
  );
  assert.match(
    validateBoundaries(root).join('\n'),
    /Host-only import in modules\/inventory\/probe.ts/,
  );
});

test('structure allows only the dedicated host server executable script', (t) => {
  const root = fixture(t);
  assert.deepEqual(validateStructure(root), []);
  writeFileSync(path.join(root, 'src/modules/runtime/foreign-server.mjs'), 'export {};\n');
  assert.match(
    validateStructure(root).join('\n'),
    /Unsupported source artifact: src\/modules\/runtime\/foreign-server\.mjs/,
  );
});

test('boundaries reject HTTP server imports outside the host adapter', (t) => {
  const root = fixture(t);
  writeFileSync(
    path.join(root, 'src/modules/runtime/unapproved-server.ts'),
    "import http from 'node:http';\n",
  );
  assert.match(
    validateBoundaries(root).join('\n'),
    /Host-only import in modules\/runtime\/unapproved-server\.ts: node:http/,
  );
});

test('docs require the checkpoint archive entrypoint', (t) => {
  const root = fixture(t);
  unlinkSync(path.join(root, 'docs/checkpoints/README.md'));
  assert.match(validateDocs(root).join('\n'), /Missing docs\/checkpoints\/README\.md/);
});

test('docs reject historical checkpoints missing from their archive index', (t) => {
  const root = fixture(t);
  const file = path.join(root, 'docs/checkpoints/README.md');
  const original = readFileSync(file, 'utf8');
  assert.match(original, /\(2026-11-05-foundation\.md\)/);
  writeFileSync(file, original.replace('(2026-11-05-foundation.md)', '(missing-foundation.md)'));
  assert.match(
    validateDocs(root).join('\n'),
    /Document missing from checkpoint archive index: docs\/checkpoints\/2026-11-05-foundation\.md/,
  );
});

test('structure allows the checkpoint archive index but rejects non-dated checkpoint files', (t) => {
  const root = fixture(t);
  assert.deepEqual(validateStructure(root), []);
  writeFileSync(path.join(root, 'docs/checkpoints/not-dated.md'), '# Invalid\n');
  assert.match(
    validateStructure(root).join('\n'),
    /Invalid checkpoint filename: docs\/checkpoints\/not-dated\.md/,
  );
});
