import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  classifyAgentLogLine, LocalAgentLogHost,
} from '../../src/modules/host/local-agent-log-diagnostics.ts';

const sample = '2026-11-13T20:45:00Z task_budget_exhausted PRIVATE_TOKEN=secret-SUPER ' +
  'task=important command=cat ~/.ssh/id_ed25519';

function fixture() {
  const home = mkdtempSync(path.join(os.tmpdir(), 'ph-agent-log-'));
  const folder = path.join(home, '.local/state/local-agent/termux/runit/logs/agent');
  mkdirSync(folder, { recursive: true });
  return { home, folder, current: path.join(folder, 'current') };
}

test('classifies safe Agent event codes without copying secret log content', () => {
  const event = classifyAgentLogLine(sample);
  assert.deepEqual(event, {
    kind: 'budget', message: 'Task stopped by execution budget',
    timestamp: '2026-11-13T20:45:00.000Z',
  });
  assert.equal(classifyAgentLogLine('ACCESS_TOKEN=secret with no event'), null);
  assert.equal(classifyAgentLogLine('2026-11-13T20:45:00Z git push error PRIVATE_SECRET=abc')?.kind,
    'failed');
});

test('reads a bounded private svlogd tail and excludes arbitrary bytes', () => {
  const f = fixture();
  try {
    writeFileSync(f.current, sample + '\n' +
      '@4000000068f0000000000000 publishing a result secret=xyz\n' +
      'private data with bearer ACCESS_TOKEN=abc\n');
    const result = new LocalAgentLogHost(f.home, () => '2026-11-13T20:48:00.000Z').inspect();
    assert.equal(result.state, 'ok');
    assert.equal(result.source, 'private-runit-svlogd');
    assert.deepEqual(result.events.map(e => e.kind), ['budget', 'published']);
    assert.equal(result.unclassifiedLines, 1);
    assert.ok(!JSON.stringify(result).includes('secret-'));
    assert.ok(!JSON.stringify(result).includes('ACCESS_TOKEN'));
    assert.ok(!JSON.stringify(result).includes('id_ed25519'));
    assert.equal(result.notice, 'sanitized-events-only-no-lifecycle-authority');
  } finally { rmSync(f.home, { recursive: true, force: true }); }
});

test('missing and symlinked log sources fail closed, never follow foreign paths', () => {
  const f = fixture();
  try {
    assert.equal(new LocalAgentLogHost(f.home).inspect().state, 'missing');
    symlinkSync('/etc/passwd', f.current);
    assert.equal(new LocalAgentLogHost(f.home).inspect().state, 'unsafe-log');
    rmSync(f.current);
    rmSync(f.folder, { recursive: true });
    symlinkSync('/etc', f.folder);
    assert.equal(new LocalAgentLogHost(f.home).inspect().state, 'unsafe-log');
  } finally { rmSync(f.home, { recursive: true, force: true }); }
});

test('oversized log file cannot be streamed into browser', () => {
  const f = fixture();
  try {
    writeFileSync(f.current, 'x'.repeat(32 * 1024 * 1024 + 1));
    const result = new LocalAgentLogHost(f.home).inspect();
    assert.equal(result.state, 'unsafe-log');
    assert.deepEqual(result.events, []);
  } finally { rmSync(f.home, { recursive: true, force: true }); }
});

test('also supports a private service-local svlogd main/current layout', () => {
  const f = fixture();
  try {
    const serviceLog = path.join(f.home,
      '.local/state/local-agent/termux/runit/services/termux-agent/log/main');
    mkdirSync(serviceLog, { recursive: true });
    writeFileSync(path.join(serviceLog, 'current'), sample + '\n');
    const result = new LocalAgentLogHost(f.home).inspect();
    assert.equal(result.state, 'ok');
    assert.deepEqual(result.events.map(event => event.kind), ['budget']);
    assert.ok(!JSON.stringify(result).includes('PRIVATE_TOKEN'));
  } finally { rmSync(f.home, { recursive: true, force: true }); }
});

test('installed Samsung svlogd path is preferred over legacy locations', () => {
  const f = fixture();
  try {
    const legacy = path.join(f.home,
      '.local/state/local-agent/termux/runit/log/termux-agent');
    mkdirSync(legacy, { recursive: true });
    writeFileSync(path.join(legacy, 'current'),
      '2026-11-13T20:45:00Z task failed legacy-only secret=abc\n');
    writeFileSync(f.current, sample + '\n');
    const result = new LocalAgentLogHost(f.home).inspect();
    assert.equal(result.state, 'ok');
    assert.deepEqual(result.events.map(event => event.kind), ['budget']);
  } finally { rmSync(f.home, { recursive: true, force: true }); }
});
