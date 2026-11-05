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
