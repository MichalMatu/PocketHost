import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { validateDocs } from '../../scripts/quality/check-docs.mjs';
import { planChangedChecks } from '../../scripts/dev/changed-checks-policy.mjs';

function fixture() {
  const root = mkdtempSync(path.join(os.tmpdir(), 'pockethost-docs-focus-'));
  mkdirSync(path.join(root, 'docs/checkpoints'), { recursive: true });
  writeFileSync(path.join(root, 'project.structure.json'), JSON.stringify({ modules: [] }));
  writeFileSync(path.join(root, 'docs/README.md'),
    '# Docs\n[Dev](DEV_ITERATION.md)\n[Handoff](HANDOFF_NEXT_CHAT.md)\n' +
    '[Roadmap](ROADMAP.md)\n[Archive](checkpoints/README.md)\n');
  const frontmatter = '---\nstatus: active\nowner: core\nlast_reviewed: 2026-11-14\npurpose: Verification\n---\n\n';
  writeFileSync(path.join(root, 'docs/checkpoints/README.md'),
    frontmatter + '# Checkpoints\n');
  writeFileSync(path.join(root, 'docs/DEV_ITERATION.md'),
    frontmatter + '# Fast flow\n');
  writeFileSync(path.join(root, 'docs/HANDOFF_NEXT_CHAT.md'),
    frontmatter + '# Handoff\n' + 'x'.repeat(7000) + '\n');
  writeFileSync(path.join(root, 'docs/ROADMAP.md'),
    frontmatter + '# Roadmap\n' + 'x'.repeat(10000) + '\n');
  return root;
}

test('focused DEV doc gate checks touched files, full milestone gate still detects old debt', () => {
  const root = fixture();
  try {
    assert.deepEqual(validateDocs(root, ['docs/DEV_ITERATION.md']), []);
    const debt = validateDocs(root);
    assert.ok(debt.some(line => line.includes('docs/HANDOFF_NEXT_CHAT.md')));
    assert.ok(debt.some(line => line.includes('docs/ROADMAP.md')));
    const changedDebt = validateDocs(root, ['docs/HANDOFF_NEXT_CHAT.md']);
    assert.ok(changedDebt.some(line => line.includes('Context budget exceeded')));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('focused validation rejects unsafe, missing, linked and malformed changed docs', () => {
  const root = fixture();
  try {
    for (const name of ['../../secrets.md', 'docs/../README.md', '/tmp/secrets.md',
      'apps/admin/README.md', 'docs/missing.md']) {
      assert.ok(validateDocs(root, [name]).length > 0);
    }
    assert.ok(validateDocs(root, []).length > 0);
    assert.deepEqual(validateDocs(root, ['docs/DEV_ITERATION.md']), []);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('changed Markdown maps to focused docs check while full audit remains explicit', () => {
  const plan = planChangedChecks(['docs/DEV_ITERATION.md']);
  assert.deepEqual(plan.commands.find(cmd => cmd.label === 'docs')?.argv,
    ['node', 'scripts/quality/check-docs.mjs', '--changed', 'docs/DEV_ITERATION.md']);
  assert.deepEqual(plan.review, []);
});
