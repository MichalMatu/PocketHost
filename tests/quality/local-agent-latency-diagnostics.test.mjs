import assert from 'node:assert/strict';
import test from 'node:test';
import { chmodSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { LocalAgentLatencyHost } from '../../src/modules/host/local-agent-latency-diagnostics.ts';
import { LocalAgentLogHost } from '../../src/modules/host/local-agent-log-diagnostics.ts';

function fixture() {
  const home = mkdtempSync(path.join(os.tmpdir(), 'ph-agent-watch-'));
  const folder = path.join(home, '.local/state/local-agent/termux/observability');
  mkdirSync(folder, { recursive: true, mode: 0o700 });
  const file = path.join(folder, 'task-latency-v1.json');
  const snapshot = {
    version: 1, source: 'termux-agent-local-task-spool', mode: 'event-driven',
    observedAt: '2026-11-14T12:00:00+00:00', sampleCount: 1,
    medianSeconds: 12.4, p95Seconds: 12.4, latestSeconds: 12.4,
    alerts: ['execution-regression'],
    recent: [{ at: '2026-11-14T12:00:00+00:00', seconds: 12.4, status: 'done' }],
    samples: [{ key: '0123456789abcdef01234567', at: '2026-11-14T12:00:00+00:00',
      seconds: 12.4, status: 'done', timeout: false }],
  };
  return { home, folder, file, snapshot };
}
test('reads fixed private timing path and projects only sanitized aggregates', () => {
  const f = fixture();
  try {
    writeFileSync(f.file, JSON.stringify({ ...f.snapshot, secret: 'NEVER_RETURN', tasks: ['private-command'] }),
      { mode: 0o600 });
    const output = new LocalAgentLatencyHost(f.home).inspect();
    assert.equal(output.state, 'ok');
    assert.deepEqual(output.alerts, ['execution-regression']);
    assert.equal(output.p95Seconds, 12.4);
    assert.equal(output.recent[0].seconds, 12.4);
    for (const sensitive of ['NEVER_RETURN', 'private-command', '0123456789abcdef01234567'])
      assert.ok(!JSON.stringify(output).includes(sensitive));
    assert.equal(output.mode, 'event-driven');
  } finally { rmSync(f.home, { recursive: true, force: true }); }
});
test('missing, symlinked, group-readable and oversized files fail closed', () => {
  const f = fixture();
  try {
    const host = new LocalAgentLatencyHost(f.home);
    assert.equal(host.inspect().state, 'missing');
    symlinkSync('/etc/passwd', f.file);
    assert.equal(host.inspect().state, 'unsafe');
    rmSync(f.file);
    writeFileSync(f.file, JSON.stringify(f.snapshot), { mode: 0o644 });
    assert.equal(host.inspect().state, 'unsafe');
    chmodSync(f.file, 0o600);
    assert.equal(host.inspect().state, 'ok');
    writeFileSync(f.file, 'x'.repeat(32769));
    assert.equal(host.inspect().state, 'unsafe');
  } finally { rmSync(f.home, { recursive: true, force: true }); }
});
test('schema corruption and forged performance alarms do not reach browser', () => {
  const f = fixture();
  try {
    const host = new LocalAgentLatencyHost(f.home);
    for (const bad of [
      { ...f.snapshot, alerts: ['fetch-private-secrets'] },
      { ...f.snapshot, latestSeconds: Number.NaN },
      { ...f.snapshot, sampleCount: 9999 },
      { ...f.snapshot, recent: [{ at: 'not-date', seconds: 20, status: 'done' }] },
      { ...f.snapshot, version: 8 },
    ]) {
      writeFileSync(f.file, JSON.stringify(bad), { mode: 0o600 });
      assert.equal(host.inspect().state, 'unsafe');
    }
  } finally { rmSync(f.home, { recursive: true, force: true }); }
});
test('existing log endpoint projection keeps timing optional and read-only', () => {
  const f = fixture();
  try {
    writeFileSync(f.file, JSON.stringify(f.snapshot), { mode: 0o600 });
    const report = new LocalAgentLogHost(f.home).inspect();
    assert.equal(report.latency.state, 'ok');
    assert.deepEqual(report.latency.alerts, ['execution-regression']);
    assert.equal(report.notice, 'sanitized-events-only-no-lifecycle-authority');
    assert.ok(!JSON.stringify(report).includes('0123456789abcdef01234567'));
  } finally { rmSync(f.home, { recursive: true, force: true }); }
});
