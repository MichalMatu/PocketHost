import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseFastFlowArgs, confirmFocusedQa, confirmPreflight, confirmRelease,
} from '../../ops/termux/fast-flow.mjs';
import { planChangedChecks } from '../../scripts/dev/changed-checks-policy.mjs';

const base = 'a'.repeat(40);
const target = 'b'.repeat(40);
const goodQa = {
  kind: 'PocketHostVerifyChanged', base, head: target, status: 'PASS',
  changed: ['apps/admin/src/app/termux/page.tsx'],
  plannedChecks: ['ui tests'],
  checks: [{ label: 'ui tests', status: 'PASS' }], review: [],
};

test('one pinned source and explicit --apply; reject duplicate or foreign flags', () => {
  assert.deepEqual(parseFastFlowArgs(['--target=' + target, '--base=' + base, '--apply']),
    { base, target, apply: true, tests: false });
  assert.deepEqual(parseFastFlowArgs(['--apply', '--base=' + base, '--target=' + target,
    '--tests']), { base, target, apply: true, tests: true });
  for (const argv of [
    ['--base=' + base, '--target=' + base, '--apply'],
    ['--base=' + base, '--base=' + base, '--target=' + target, '--apply'],
    ['--base=' + base, '--target=' + target, '--apply', '--apply'],
    ['--base=HEAD', '--target=' + target, '--apply'],
    ['--target=' + target, '--apply'],
    ['--base=' + base, '--target=' + target],
    ['--base=' + base, '--target=' + target, '--apply', '--tests', '--tests'],
    ['--base=' + base, '--target=' + target, '--apply', '--restart-all'],
  ]) assert.throws(() => parseFastFlowArgs(argv));
});

test('focused QA is bound to the exact diff, all planned checks and no manual review', () => {
  assert.deepEqual(confirmFocusedQa(goodQa, base, target), ['ui tests']);
  for (const bad of [
    { ...goodQa, head: base }, { ...goodQa, status: 'MANUAL_REVIEW' },
    { ...goodQa, changed: [] }, { ...goodQa, checks: [] },
    { ...goodQa, plannedChecks: ['node tests'] },
    { ...goodQa, checks: [{ label: 'ui tests', status: 'FAIL' }] },
    { ...goodQa, review: ['unmapped'] }, { ...goodQa, kind: 'wrong' },
  ]) assert.throws(() => confirmFocusedQa(bad, base, target));
});

test('preflight must be same owner baseline, healthy panel and unchanged services', () => {
  const ok = {
    status: 'READ_ONLY_READY', mode: 'read-only', ownedPanel: 'verified',
    markerSha: base, checkoutSha: base, sourceDrift: 'same',
    panelHttp: 'reachable', protectedServices: 'running',
    deployment: 'not-performed', restart: 'not-performed',
  };
  assert.equal(confirmPreflight(ok, base), true);
  for (const bad of [
    { ...ok, checkoutSha: target }, { ...ok, markerSha: target },
    { ...ok, sourceDrift: 'verified-ui-hmr-only' },
    { ...ok, panelHttp: 'unavailable' },
    { ...ok, protectedServices: 'not-all-running' },
    { ...ok, ownedPanel: 'unverified' },
  ]) assert.throws(() => confirmPreflight(bad, base));
});

test('release must prove exact source, 200 loopback and same protected services', () => {
  const valid = { status: 'PASS', sha: target, lanHttp: 200, external: 'unchanged' };
  assert.equal(confirmRelease(valid, target), true);
  assert.equal(confirmRelease({ status: 'CURRENT', sha: target }, target), true);
  for (const bad of [
    { ...valid, sha: base }, { ...valid, status: 'HOLD' },
    { ...valid, lanHttp: 500 }, { ...valid, external: 'changed' },
    { status: 'CURRENT', sha: base },
  ]) assert.throws(() => confirmRelease(bad, target));
});

test('only the explicitly-reviewed orchestration entrypoint is auto-mapped', () => {
  const mapped = planChangedChecks(['ops/termux/fast-flow.mjs']);
  assert.deepEqual(mapped.review, []);
  assert.ok(mapped.commands.some(item => item.label === 'node tests' &&
    item.argv.includes('tests/quality/dev-fast-flow.test.mjs')));
  const other = planChangedChecks(['ops/termux/untrusted-command.mjs']);
  assert.ok(other.review.some(item => item.includes('Explicit impact review')));
});
