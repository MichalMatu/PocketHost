import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import {
  formatRuntimeEvent,
  runtimeEventHistory,
  planRuntimeRecovery,
} from '../../src/shared/runtime-diagnostics.ts';

test('structured events contain a fixed code, never arbitrary raw log payloads', () => {
  const event = formatRuntimeEvent('photomap-test', 'manual-stop-uncertain', new Date('2026-11-07'));
  assert.deepEqual(JSON.parse(event), {
    version: 1,
    timestamp: '2026-11-07T00:00:00.000Z',
    source: 'managed-runtime',
    instanceId: 'photomap-test',
    code: 'manual-stop-uncertain',
  });
  assert.throws(() => formatRuntimeEvent('../foreign', 'manual-stop-completed'));
  assert.throws(() => formatRuntimeEvent('photomap-test', 'secret=opaque'));
});

test('bounded error history drops malformed and legacy lines without executing them', () => {
  const one = formatRuntimeEvent('photomap-test', 'manual-start-health-failed');
  const two = formatRuntimeEvent('photomap-test', 'manual-stop-uncertain');
  assert.deepEqual(
    runtimeEventHistory(['legacy plaintext', '{"unexpected":"line"}', one.trim(), two.trim()])
      .map((item) => item.code),
    ['manual-start-health-failed', 'manual-stop-uncertain'],
  );
  assert.equal(runtimeEventHistory(Array.from({ length: 50 }, () => one.trim())).length, 40);
});

test('dry-run recovery never authorizes foreign state or uncertain PRoot descendants', () => {
  const base = {
    ownership: 'pockethost',
    state: 'stopped',
    markerPresent: true,
    descendantEvidenceComplete: true,
  };
  assert.equal(planRuntimeRecovery(base), 'manual-marker-review');
  assert.equal(
    planRuntimeRecovery({ ...base, descendantEvidenceComplete: false }),
    'manual-evidence-review',
  );
  assert.equal(
    planRuntimeRecovery({ ...base, ownership: 'external' }),
    'manual-evidence-review',
  );
  assert.equal(
    planRuntimeRecovery({ ...base, markerPresent: false }),
    'no-action',
  );
});

test('PhotoMap event recorder is structured and retains error events on failures', () => {
  const source = readFileSync(
    new URL('../../src/modules/host/photomap-runtime-host.ts', import.meta.url),
    'utf8',
  );
  assert.match(source, /formatRuntimeEvent\(OWNED_PHOTOMAP_ID, message\)/);
  assert.match(source, /this\.event\('manual-stop-uncertain'\)/);
  assert.match(source, /this\.event\('manual-start-health-failed'\)/);
});
